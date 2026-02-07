/**
 * 聊天API调用层 (低耦合设计)
 * 职责：调用 AI 提供商的聊天接口，处理多模型配置
 * 特点：与业务逻辑解耦，易于扩展新模型
 */

import type { ChatMessage, ChatRequestConfig, ChatContext } from '@/types/conversation';
import { loadProviderSettings } from '@/modules/storage/settings';
import { callAiProvider } from './client';

/**
 * AI 提供商的聊天系统提示词
 * [预留] 不同 modelType 可使用不同提示词
 */
const CHAT_SYSTEM_PROMPTS: Record<string, string> = {
  'evaluation-chat': `你是一位资深摄影评论助手。基于当前的评估结果，
你可以与用户讨论评分理由、修图建议、拍摄技巧等。

重要：
1. 基于原始评估结果，不更改整体评分
2. 可深入讨论具体维度的改进方向
3. 提供实操性的修图反馈
4. 考虑用户的创意意图和风格偏好`,

  'refinement-chat': `你是修图优化专家。帮助用户优化修图计划，
讨论参数调整、工作流优化等。`,

  'deepdive-chat': `你是摄影理论家。进行深度的美学和技法讨论。`,
};

/**
 * 构建聊天提示词
 */
function buildChatPrompt(context: ChatContext, modelType?: string): string {
  const basePrompt =
    CHAT_SYSTEM_PROMPTS[modelType || 'evaluation-chat'] ||
    CHAT_SYSTEM_PROMPTS['evaluation-chat'];

  let contextInfo = `\n\n【当前评估信息】\n`;
  contextInfo += `- 评估角色: ${context.agentStyle}\n`;
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
  config: ChatRequestConfig
): Promise<ChatMessage> {
  const settings = loadProviderSettings();
  if (!settings) throw new Error('Settings not found');

  // 获取 API 密钥 (需要从调用者获取密钥或从本地存储获取)
  // 注：这是简化版本，实际应该通过 config 或其他方式传入
  const apiKey = config.apiKey;
  if (!apiKey) {
    throw new Error(`API key not provided for provider: ${config.provider}`);
  }

  const systemPrompt = buildChatPrompt(context, config.modelType);

  // 构建对话历史 (最后10条消息用于上下文)
  const recentMessages = context.conversationHistory.slice(-10);
  const conversationText = recentMessages
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n');

  const fullUserPrompt = conversationText 
    ? `Previous conversation:\n${conversationText}\n\nUser: ${userMessage}`
    : userMessage;

  let responseContent: string;

  try {
    // 调用通用的 AI 提供商接口
    responseContent = await callAiProvider({
      base64Image: '', // 聊天时通常不需要图片，但保留接口兼容性
      systemPrompt,
      userPrompt: fullUserPrompt,
      apiKey,
      provider: config.provider,
      model: 'gpt-4-turbo-preview', // 默认模型，可通过 config 扩展
      baseUrl: settings.baseUrl || 'https://api.openai.com/v1',
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 1000,
      timeoutMs: 30000,
    });
  } catch (error) {
    console.error('Chat API call failed:', error);
    throw new Error(`Failed to call ${config.provider} chat API`);
  }

  // 返回新消息对象 (存储层会生成 id 和 timestamp)
  return {
    id: '',  // 存储层会生成
    role: 'assistant',
    content: responseContent,
    timestamp: 0,  // 存储层会设置
    modelUsed: config.provider,
  };
}
