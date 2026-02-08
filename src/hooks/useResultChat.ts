import { useCallback, useMemo, useState } from 'react';
import type { ChatMessage, ChatContext, ChatRequestConfig } from '@/types/conversation';
import type { EvaluationResult } from '@/types/evaluation';
import type { ProviderSettings } from '@/modules/storage/settings';
import { useTaskContext } from '@/state/TaskContext';
import { loadApiKey } from '@/modules/storage/keys';
import { loadProviderSettings } from '@/modules/storage/settings';
import {
  generateEvaluationSummary,
  processChatMessage
} from '@/modules/evaluation/chatIntegration';

/**
 * 结果聊天 hook 的配置选项
 */
export interface UseResultChatOptions {
  taskId: string | null;
  agentStyle: string;
  agentPhotographer?: string;
  evaluation: EvaluationResult | null;
  imageBase64?: string | null;
  passphrase?: string;
  taskSettings?: ProviderSettings | null;
}

/**
 * 结果聊天 hook 的返回值
 * 包含消息列表、加载状态和错误信息
 */
export interface UseResultChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (message: string) => Promise<void>;
  clearError: () => void;
}

/**
 * Result chat hook for evaluation result discussion
 * @param {UseResultChatOptions} options - Hook configuration options
 * @return {UseResultChatReturn} Chat state and message operations
 */
export function useResultChat(options: UseResultChatOptions): UseResultChatReturn {
  const { taskState, addChatMessage } = useTaskContext();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const evaluationSummary = useMemo(
    () => (options.evaluation ? generateEvaluationSummary(options.evaluation) : ''),
    [options.evaluation]
  );

  const sendMessage = useCallback(
    async (message: string) => {
      if (!message.trim()) {
        return;
      }
      if (!options.taskId) {
        setError('No active task');
        return;
      }

      setError(null);
      setIsLoading(true);

      try {
        const settings = options.taskSettings ?? loadProviderSettings();
        if (!settings) {
          throw new Error('Settings not found');
        }

        const apiKey =
          settings.provider === 'ollama'
            ? ''
            : await loadApiKey(settings.keyLabel || settings.provider, options.passphrase || '');

        const conversationHistory = taskState.chatMessages ?? [];

        const chatContext: ChatContext = {
          taskId: options.taskId,
          agentStyle: options.agentStyle,
          agentPhotographer: options.agentPhotographer,
          evaluationResultSummary: evaluationSummary,
          conversationHistory,
          imageBase64: options.imageBase64 ?? undefined
        };

        const chatConfig: ChatRequestConfig = {
          provider: settings.provider as ChatRequestConfig['provider'],
          apiKey,
          model: settings.model,
          baseUrl: settings.baseUrl,
          temperature: settings.temperature,
          maxTokens: settings.maxTokens,
          timeoutMs: settings.timeoutMs,
          contextMaxChars: settings.contextMaxChars,
          includeThinking: true
        };

        await addChatMessage({ role: 'user', content: message });

        const assistantMessage = await processChatMessage(
          message,
          chatContext,
          chatConfig,
          conversationHistory
        );

        if (assistantMessage?.content) {
          await addChatMessage({
            role: 'assistant',
            content: assistantMessage.content,
            modelUsed: assistantMessage.modelUsed ?? settings.provider
          });
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [
      addChatMessage,
      evaluationSummary,
      options.agentPhotographer,
      options.agentStyle,
      options.imageBase64,
      options.passphrase,
      options.taskId,
      options.taskSettings,
      taskState.chatMessages
    ]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    messages: taskState.chatMessages ?? [],
    isLoading,
    error,
    sendMessage,
    clearError
  };
}
