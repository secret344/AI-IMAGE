/**
 * useUploadChat Hook
 * 管理上传阶段的聊天状态和交互
 * 低耦合：与UI组件分离，易于测试
 */

import { useCallback, useState } from 'react';
import type { ChatMessage } from '@/types/conversation';
import {
  handleUploadChatMessage,
} from '@/modules/evaluation/uploadChatIntegration';

export interface UseUploadChatOptions {
  taskId: string;
  agentStyle: string;
  imageName: string;
  imageBase64: string; // 上传图片的 base64 数据
  evaluationResultSummary?: string;
  /** API密钥密码短语（可选，用于解密存储的API密钥） */
  apiKeyPassphrase?: string;
}

export interface UseUploadChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  analysisSuggestion: string | null;
  shouldShowAnalysisSuggestion: boolean;
  sendMessage: (message: string) => Promise<void>;
  confirmAnalysis: () => void;
  clearError: () => void;
  clearMessages: () => void;
}

export function useUploadChat(options: UseUploadChatOptions): UseUploadChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisSuggestion, setAnalysisSuggestion] = useState<string | null>(null);
  const [shouldShowAnalysisSuggestion, setShouldShowAnalysisSuggestion] =
    useState(false);

  const sendMessage = useCallback(
    async (userMessage: string) => {
      if (!userMessage.trim()) return;

      setError(null);
      setIsLoading(true);

      try {
        // 立即添加用户消息到界面
        const userMsg: ChatMessage = {
          id: `msg-user-${Date.now()}`,
          role: 'user',
          content: userMessage,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, userMsg]);

        // 调用聊天处理，传递图片和密码短语
        await handleUploadChatMessage(
          userMessage,
          messages,
          options.imageBase64,
          {
            taskId: options.taskId,
            agentStyle: options.agentStyle,
            imageName: options.imageName,
            evaluationResultSummary: options.evaluationResultSummary,
          },
          {
            onMessageReceived: (aiMessage: ChatMessage) => {
              setMessages(prev => [...prev, aiMessage]);
            },
            onAnalysisSuggested: (suggestion: string) => {
              setAnalysisSuggestion(suggestion);
              setShouldShowAnalysisSuggestion(true);
            },
            onError: (err: Error) => {
              setError(err.message);
            },
          },
          options.apiKeyPassphrase
        );
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, options]
  );

  const confirmAnalysis = useCallback(() => {
    setShouldShowAnalysisSuggestion(false);
    setAnalysisSuggestion(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setAnalysisSuggestion(null);
    setShouldShowAnalysisSuggestion(false);
  }, []);

  return {
    messages,
    isLoading,
    error,
    analysisSuggestion,
    shouldShowAnalysisSuggestion,
    sendMessage,
    confirmAnalysis,
    clearError,
    clearMessages,
  };
}
