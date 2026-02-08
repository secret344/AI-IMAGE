/**
 * 低耦合的风格分析触发模块
 * 职责：接收用户输入（手动触发或聊天触发）并执行风格分析
 * 特点：不依赖UI组件，易于测试和重用
 */

import type { ChatMessage } from '@/types/conversation';
import type { LanguageCode } from '@/config/i18n-config';
import { recognizeStyle } from './recognizeStyle';

export interface AnalyzeStyleOptions {
  base64Image: string;
  userLanguage: LanguageCode;
  passphrase?: string;
  chatHistory?: ChatMessage[];
  providerSettings?: import('@/modules/storage/settings').ProviderSettings;
  onStart?: () => void;
  onProgress?: (stage: string) => void;
  onSuccess?: (result: any) => void;
  onError?: (error: Error) => void;
}

/**
 * 执行风格分析
 * 支持多种触发方式：用户点击按钮、聊天中建议触发等
 */
export async function analyzeStyleWithChat(options: AnalyzeStyleOptions): Promise<any> {
  const {
    base64Image,
    userLanguage,
    passphrase,
    chatHistory,
    providerSettings,
    onStart,
    onProgress,
    onSuccess,
    onError
  } = options;

  try {
    onStart?.();

    onProgress?.('识别图片风格中...');
    const styleResult = await recognizeStyle(
      base64Image,
      userLanguage,
      passphrase,
      chatHistory,
      providerSettings
    );

    onSuccess?.(styleResult);
    return styleResult;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    onError?.(err);
    throw err;
  }
}

/**
 * 判断聊天消息是否包含分析请求
 * 用于在聊天中自动识别AI的分析建议
 */
export function shouldTriggerAnalysisFromChat(
  lastAssistantMessage: ChatMessage | undefined
): boolean {
  if (!lastAssistantMessage || lastAssistantMessage.role !== 'assistant') {
    return false;
  }

  const analysisKeywords = [
    '让我分析',
    'let me analyze',
    '我来分析',
    '我将分析',
    '分析一下',
    'analyze',
    '风格识别',
    'style'
  ];

  const content = lastAssistantMessage.content.toLowerCase();
  return analysisKeywords.some((keyword) => content.includes(keyword));
}

/**
 * 从聊天消息中提取分析建议
 * 返回是否应该自动触发分析，以及建议文案
 */
export function extractAnalysisSuggestion(lastAssistantMessage: ChatMessage | undefined): {
  shouldAnalyze: boolean;
  suggestion: string;
} {
  if (!lastAssistantMessage || lastAssistantMessage.role !== 'assistant') {
    return { shouldAnalyze: false, suggestion: '' };
  }

  const hasAnalysisKeywords = shouldTriggerAnalysisFromChat(lastAssistantMessage);

  if (hasAnalysisKeywords) {
    // 提取建议文本（通常是消息的最后一句）
    const lines = lastAssistantMessage.content.split('\n');
    const suggestion = lines[lines.length - 1] || lastAssistantMessage.content;

    return { shouldAnalyze: true, suggestion };
  }

  return { shouldAnalyze: false, suggestion: '' };
}
