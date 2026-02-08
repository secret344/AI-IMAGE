/**
 * 聊天API调用层 (低耦合设计)
 * 职责：调用 AI 提供商的聊天接口，处理多模型配置
 * 特点：与业务逻辑解耦，易于扩展新模型
 */

import type { ChatMessage, ChatRequestConfig, ChatContext } from '@/types/conversation';
import {
  EVALUATION_DIMENSIONS,
  EVALUATION_SCORE_RANGE,
  LIGHTROOM_PARAM_RANGES
} from '@/config/evaluationConstants';
import { STYLE_TAGS } from '@/config/style-tags';
import { normalizeLanguage } from '@/config/i18n-config';
import i18n from '@/i18n';
import { callAiProvider } from './client';

/**
 * AI 提供商的聊天系统提示词
 * [预留] 不同 modelType 可使用不同提示词
 */
const SCORE_RANGE_TEXT = `${EVALUATION_SCORE_RANGE.min}-${EVALUATION_SCORE_RANGE.max}`;
const DIMENSION_KEY_MAP: Record<(typeof EVALUATION_DIMENSIONS)[number], string> = {
  Composition: 'composition',
  Lighting: 'lighting',
  Color: 'color',
  Subject: 'subject'
};
const getDimensionListText = (language?: string): string => {
  const normalized = normalizeLanguage(language);
  const separator = normalized === 'zh' ? '、' : ', ';
  return EVALUATION_DIMENSIONS.map((dimension) =>
    i18n.t(`dimensions.${DIMENSION_KEY_MAP[dimension]}`, { lng: normalized })
  ).join(separator);
};
const formatRange = (range: { min: number; max: number }) => `${range.min} ~ ${range.max}`;
const LIGHTROOM_RANGE_TEXT = `  - Exposure: ${formatRange(LIGHTROOM_PARAM_RANGES.Exposure)}
  - Contrast: ${formatRange(LIGHTROOM_PARAM_RANGES.Contrast)}
  - Highlights: ${formatRange(LIGHTROOM_PARAM_RANGES.Highlights)}
  - Shadows: ${formatRange(LIGHTROOM_PARAM_RANGES.Shadows)}`;

const buildChatOutputGuard = (language?: string): string => {
  const normalized = normalizeLanguage(language);
  if (normalized === 'zh') {
    return `
【输出约束】
- 禁止输出思考过程或自我反思，只输出最终答复。
- 禁止循环或重复同一内容；回答完成后立刻停止。
- 如需要列表，请保持简洁。
- 避免无意义填充或延展，确保信息密度。`;
  }
  return `
[Output Constraints]
- Do not output chain-of-thought or self-reflection; provide only the final answer.
- Do not loop or repeat the same content; stop immediately after completing the answer.
- If a list is needed, keep it concise.
- Avoid padding or rambling; keep the response dense and relevant.`;
};

const getStyleTagsText = (language?: string): string => {
  const normalized = normalizeLanguage(language);
  const separator = normalized === 'zh' ? '、' : ', ';
  return STYLE_TAGS.map((tag) => i18n.t(`styleTags.${tag}`, { lng: normalized })).join(separator);
};

const buildEvaluationChatPrompt = (language?: string): string => {
  const styleTagsText = getStyleTagsText(language);
  const dimensionListText = getDimensionListText(language);
  return `你是一位资深摄影评论助手。基于当前的评估结果，
你可以与用户讨论评分理由、修图建议、拍摄技巧等。

重要：
1. 基于原始评估结果，不更改整体评分
2. 可深入讨论具体维度的改进方向
3. 提供实操性的修图反馈
4. 考虑用户的创意意图和风格偏好

【系统默认常量与范围】
- 所有评分范围：${SCORE_RANGE_TEXT}
- 维度评分：${dimensionListText}，均为 ${SCORE_RANGE_TEXT}
- 可用风格标签：${styleTagsText}
- Lightroom 参数范围：
${LIGHTROOM_RANGE_TEXT}
- 其他参数请给出合理范围，避免夸张值

【摄影师风格设置】
- 若用户选择了摄影师/风格设定，请严格遵循对应审美与评价侧重点${buildChatOutputGuard(language)}`;
};

const CHAT_SYSTEM_PROMPTS: Record<string, string> = {
  'evaluation-chat': '',

  'refinement-chat': `你是修图优化专家。帮助用户优化修图计划，
讨论参数调整、工作流优化等。`,

  'deepdive-chat': `你是摄影理论家。进行深度的美学和技法讨论。`
};

function sanitizeChatContent(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.replace(/\s+/g, ' ').trim();
}

function buildConversationMessages(messages: ChatMessage[], maxChars?: number): ChatMessage[] {
  if (!Array.isArray(messages) || messages.length === 0) {
    return [];
  }

  const limit = typeof maxChars === 'number' && maxChars > 0 ? maxChars : null;
  const selected: ChatMessage[] = [];
  let totalLength = 0;

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    const content = sanitizeChatContent(message.content);
    if (!content) {
      continue;
    }
    const nextLength = totalLength === 0 ? content.length : totalLength + content.length + 2;
    if (limit && nextLength > limit) {
      break;
    }
    selected.push({ ...message, content });
    totalLength = nextLength;
  }

  return selected.reverse();
}

/**
 * 构建聊天提示词
 */
function buildChatPrompt(context: ChatContext, modelType?: string): string {
  const normalizedLanguage = normalizeLanguage(i18n.language);
  const basePrompt =
    modelType === 'evaluation-chat' || !modelType
      ? buildEvaluationChatPrompt(normalizedLanguage)
      : CHAT_SYSTEM_PROMPTS[modelType]
        ? `${CHAT_SYSTEM_PROMPTS[modelType]}${buildChatOutputGuard(normalizedLanguage)}`
        : buildEvaluationChatPrompt(normalizedLanguage);

  let contextInfo = `\n\n【当前评估信息】\n`;
  contextInfo += `- 评估角色: ${context.agentStyle}\n`;
  if (context.agentPhotographer) {
    contextInfo += `- 摄影师/风格参考: ${context.agentPhotographer}\n`;
  }
  contextInfo += `- 任务ID: ${context.taskId}\n`;

  if (context.evaluationResultSummary) {
    contextInfo += `\n【原始评估摘要】\n${context.evaluationResultSummary}\n`;
  }

  return basePrompt + contextInfo;
}

/**
 * 核心聊天函数 - 与 AI 进行对话
 * 低耦合：只需传入 context 和配置，返回单条消息
 */
export async function callAgentChat(
  context: ChatContext,
  userMessage: string,
  config: ChatRequestConfig,
  signal?: AbortSignal
): Promise<ChatMessage> {
  // 获取 API 密钥
  const apiKey = config.apiKey;

  const systemPrompt = buildChatPrompt(context, config.modelType);

  // 构建对话历史 (使用设置的上下文长度限制)
  const recentMessages = Array.isArray(context.conversationHistory)
    ? context.conversationHistory
    : [];
  const conversationMessages = buildConversationMessages(recentMessages, config.contextMaxChars);

  let responseContent: string;

  try {
    // 使用配置模型，如果未配置则使用供应商默认模型
    const defaultModels: Record<string, string> = {
      openai: 'gpt-4-turbo-preview',
      gemini: 'gemini-pro-vision',
      claude: 'claude-3-opus-20240229',
      ollama: 'mistral'
    };

    const modelName = config.model || defaultModels[config.provider] || 'mistral';

    responseContent = await callAiProvider({
      base64Image: context.imageBase64 || '',
      systemPrompt,
      userPrompt: userMessage,
      messages: conversationMessages.map((message) => ({
        role: message.role,
        content: message.content
      })),
      apiKey,
      provider: config.provider,
      model: modelName,
      baseUrl: config.baseUrl,
      temperature: config.temperature ?? 0.2,
      maxTokens: config.maxTokens ?? 1024,
      timeoutMs: config.timeoutMs ?? 30000,
      signal,
      onToken: config.onToken,
      includeThinking: config.includeThinking
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Chat API call failed (${config.provider}):`, error);
    throw new Error(`Failed to call ${config.provider} chat API: ${errorMessage}`);
  }

  // 返回新消息对象 (存储层会生成 id 和 timestamp)
  return {
    id: '', // 存储层会生成
    role: 'assistant',
    content: responseContent,
    timestamp: 0, // 存储层会设置
    modelUsed: config.provider
  };
}
