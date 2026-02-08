/**
 * 上传阶段的聊天集成模块
 * 职责：处理用户上传阶段的聊天交互，支持AI建议风格分析
 * 特点：低耦合，提供回调接口给UI
 */

import type { ChatMessage, ChatContext, ChatRequestConfig } from '@/types/conversation';
import type { ProviderSettings } from '@/modules/storage/settings';
import { callAgentChat } from '@/modules/ai/chatClient';
import { loadProviderSettings } from '@/modules/storage/settings';
import { loadApiKey } from '@/modules/storage/keys';
import { extractAnalysisSuggestion } from '@/modules/style/analyzeStyleWithChat';

export interface UploadChatIntegrationCallbacks {
  onMessageReceived: (message: ChatMessage) => void;
  onAnalysisSuggested: (suggestion: string) => void;
  onError: (error: Error) => void;
  onStreamChunk?: (chunk: string) => void;
}

/**
 * 在上传阶段处理聊天消息
 * 支持：
 * 1. 用户手动输入消息
 * 2. AI响应
 * 3. AI自动建议分析
 * 4. 用户确认后触发分析
 */
export async function handleUploadChatMessage(
  userMessage: string,
  conversationHistory: ChatMessage[],
  imageBase64: string,
  config: {
    taskId: string;
    agentStyle: string;
    agentPhotographer?: string;
    imageName: string;
    evaluationResultSummary?: string;
    taskSettings?: ProviderSettings | null;
  },
  callbacks: UploadChatIntegrationCallbacks,
  passphrase?: string,
  signal?: AbortSignal
): Promise<void> {
  try {
    // 使用任务级设置，如果没有则使用全局设置
    const settings = config.taskSettings || loadProviderSettings();
    if (!settings) throw new Error('Settings not found');

    // 获取API密钥
    // 注意：如果没有提供密码短语，则使用空字符串（用于未加密的密钥存储）
    // 不检查 apiKey 是否存在，直接传入下一层处理
    const apiKey = await loadApiKey(settings.keyLabel || settings.provider, passphrase || '');

    // 构建聊天上下文
    const chatContext: ChatContext = {
      taskId: config.taskId,
      agentStyle: config.agentStyle,
      agentPhotographer: config.agentPhotographer,
      conversationHistory,
      evaluationResultSummary: config.evaluationResultSummary,
      imageBase64
    };

    // 构建聊天配置（使用任务设置或全局设置，不使用缓存）
    const chatConfig: ChatRequestConfig = {
      provider: settings.provider as 'openai' | 'gemini' | 'claude' | 'ollama',
      apiKey,
      model: settings.model,
      baseUrl: settings.baseUrl,
      temperature: settings.temperature,
      maxTokens: settings.maxTokens,
      timeoutMs: settings.timeoutMs,
      contextMaxChars: settings.contextMaxChars,
      onToken: callbacks.onStreamChunk,
      includeThinking: true
    };

    // 调用AI聊天
    const aiMessage = await callAgentChat(chatContext, userMessage, chatConfig, signal);

    // 返回AI消息给UI
    callbacks.onMessageReceived(aiMessage);

    // 检查AI消息是否包含分析建议
    const { shouldAnalyze, suggestion } = extractAnalysisSuggestion(aiMessage);

    if (shouldAnalyze) {
      // AI建议分析，通知UI显示建议和确认按钮
      callbacks.onAnalysisSuggested(suggestion);
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    callbacks.onError(err);
  }
}

/**
 * 用户手动要求分析
 * 在聊天中检测到分析请求关键词时触发
 */
export function detectAnalysisRequest(userMessage: string): boolean {
  const analysisKeywords = ['分析', 'analyze', '风格', 'style', '我来看看', '看看', 'check'];

  const lowerMessage = userMessage.toLowerCase();
  return analysisKeywords.some((keyword) => lowerMessage.includes(keyword));
}
