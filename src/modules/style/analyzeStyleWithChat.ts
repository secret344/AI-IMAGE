/**
 * 低耦合的风格分析触发模块
 * 职责：接收用户输入（手动触发或聊天触发）并执行风格分析
 * 特点：不依赖UI组件，易于测试和重用
 */

import type { ChatMessage } from '@/types/conversation';
import type { LanguageCode } from '@/config/i18n-config';
import { recognizeStyle } from './recognizeStyle';
import type { StyleRecognitionResult } from './recognizeStyle';

/**
 * 风格分析选项
 * 包含图片数据、语言、提供商设置和回调函数
 */
export interface AnalyzeStyleOptions {
  base64Image: string;
  userLanguage: LanguageCode;
  passphrase?: string;
  chatHistory?: ChatMessage[];
  providerSettings?: import('@/modules/storage/settings').ProviderSettings;
  onStart?: () => void;
  onProgress?: (stage: string) => void;
  onSuccess?: (result: StyleRecognitionResult) => void;
  onError?: (error: Error) => void;
}

/**
 * Execute style analysis from user input
 * @param {AnalyzeStyleOptions} options - Analysis configuration with image, language, provider settings
 * @return {Promise<StyleRecognitionResult>} Style recognition result with tags and analysis
 */
export async function analyzeStyleWithChat(
  options: AnalyzeStyleOptions
): Promise<StyleRecognitionResult> {
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
 * Detect if chat message contains analysis suggestion
 * @param {ChatMessage|undefined} lastAssistantMessage - Last assistant message to check
 * @return {boolean} True if analysis should be triggered
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
 * Extract analysis suggestion from assistant message
 * @param {ChatMessage|undefined} lastAssistantMessage - Last assistant message to extract from
 * @return {Object} Object with shouldAnalyze flag and suggestion text
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
