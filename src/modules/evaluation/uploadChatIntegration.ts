/**
 * 上传阶段的聊天集成模块
 * 职责：处理用户上传阶段的聊天交互，支持AI建议风格分析
 * 特点：低耦合，提供回调接口给UI
 */

import type { ChatMessage, ChatContext, ChatRequestConfig } from '@/types/conversation';
import { callAgentChat } from '@/modules/ai/chatClient';
import { loadProviderSettings } from '@/modules/storage/settings';
import { loadApiKey } from '@/modules/storage/keys';
import { extractAnalysisSuggestion } from '@/modules/style/analyzeStyleWithChat';

export interface UploadChatIntegrationCallbacks {
  onMessageReceived: (message: ChatMessage) => void;
  onAnalysisSuggested: (suggestion: string) => void;
  onError: (error: Error) => void;
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
  config: {
    taskId: string;
    agentStyle: string;
    imageName: string;
    evaluationResultSummary?: string;
  },
  callbacks: UploadChatIntegrationCallbacks,
  passphrase?: string
): Promise<void> {
  try {
    const settings = loadProviderSettings();
    if (!settings) throw new Error('Settings not found');

    // 获取API密钥
    // 注意：如果没有提供密码短语，则使用空字符串（用于未加密的密钥存储）
    const apiKey = await loadApiKey(settings.keyLabel || settings.provider, passphrase || '');
    
    // 如果没有配置API key，返回友好的提示而不是抛出错误
    // 这允许用户在没有配置API密钥的情况下继续使用应用
    if (!apiKey) {
      callbacks.onError(
        new Error(
          'API key not configured. Please configure your API key in settings to enable chat feature.'
        )
      );
      return;
    }

    // 构建聊天上下文
    const chatContext: ChatContext = {
      taskId: config.taskId,
      agentStyle: config.agentStyle,
      conversationHistory,
      evaluationResultSummary: config.evaluationResultSummary,
    };

    // 构建聊天配置
    const chatConfig: ChatRequestConfig = {
      provider: settings.provider as any,
      apiKey,
      temperature: 0.7,
      maxTokens: 1000,
    };

    // 调用AI聊天
    const aiMessage = await callAgentChat(chatContext, userMessage, chatConfig);

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
  const analysisKeywords = [
    '分析',
    'analyze',
    '风格',
    'style',
    '我来看看',
    '看看',
    'check',
  ];

  const lowerMessage = userMessage.toLowerCase();
  return analysisKeywords.some(keyword => lowerMessage.includes(keyword));
}
