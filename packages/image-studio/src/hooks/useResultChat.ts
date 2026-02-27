import { useCallback, useMemo, useRef, useState } from 'react';
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
import { limitConversationMessages } from '@/modules/ai/limitConversationMessages';
import { normalizeThinkingResult } from '@/utils/thinking';

export interface UseResultChatOptions {
  taskId: string | null;
  agentStyle: string;
  agentPhotographer?: string;
  evaluation: EvaluationResult | null;
  imageBase64?: string | null;
  passphrase?: string;
  taskSettings?: ProviderSettings | null;
}

export interface UseResultChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (message: string) => Promise<void>;
  clearError: () => void;
}

/**
 * Hook for managing chat in the result evaluation panel with real-time streaming
 * Displays messages from storage plus real-time chunks as they arrive
 * @param {UseResultChatOptions} options - Configuration options for the result chat
 * @return {UseResultChatReturn} Chat state and handlers for messaging in result panel
 */
export function useResultChat(options: UseResultChatOptions): UseResultChatReturn {
  const { taskState, addChatMessage } = useTaskContext();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamingMessage, setStreamingMessage] = useState<ChatMessage | null>(null);
  const streamingAssistantIdRef = useRef<string | null>(null);
  const contentBufferRef = useRef<string>('');
  const thinkingBufferRef = useRef<string>('');

  const evaluationSummary = useMemo(
    () => (options.evaluation ? generateEvaluationSummary(options.evaluation) : ''),
    [options.evaluation]
  );

  const displayedMessages = useMemo(
    () =>
      streamingMessage
        ? [...(taskState.chatMessages ?? []), streamingMessage]
        : (taskState.chatMessages ?? []),
    [streamingMessage, taskState.chatMessages]
  );

  const applyContentChunk = useCallback(
    (chunk: string) => {
      if (!chunk) return;
      contentBufferRef.current += chunk;
      const currentId = streamingAssistantIdRef.current;

      if (!currentId) {
        const nextId =
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `stream-${Date.now()}`;
        streamingAssistantIdRef.current = nextId;
        const msgPayload = {
          id: nextId,
          role: 'assistant' as const,
          content: contentBufferRef.current,
          thinking: thinkingBufferRef.current || undefined,
          timestamp: Date.now(),
          modelUsed: options.taskSettings?.provider
        };
        setStreamingMessage(msgPayload);
        return;
      }

      setStreamingMessage((prev) => {
        return prev && prev.id === currentId
          ? { ...prev, content: contentBufferRef.current }
          : prev;
      });
    },
    [options.taskSettings?.provider]
  );

  const applyThinkingChunk = useCallback(
    (chunk: string) => {
      if (!chunk) return;
      thinkingBufferRef.current += chunk;
      const currentId = streamingAssistantIdRef.current;

      if (!currentId) {
        const nextId =
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `stream-${Date.now()}`;
        streamingAssistantIdRef.current = nextId;
        const msgPayload = {
          id: nextId,
          role: 'assistant' as const,
          content: contentBufferRef.current,
          thinking: thinkingBufferRef.current || undefined,
          timestamp: Date.now(),
          modelUsed: options.taskSettings?.provider
        };
        setStreamingMessage(msgPayload);
        return;
      }

      setStreamingMessage((prev) => {
        return prev && prev.id === currentId
          ? { ...prev, thinking: thinkingBufferRef.current }
          : prev;
      });
    },
    [options.taskSettings?.provider]
  );

  const sendMessage = useCallback(
    async (message: string) => {
      if (!message.trim()) return;
      if (!options.taskId) {
        setError('No active task');
        return;
      }

      setError(null);
      setIsLoading(true);
      setStreamingMessage(null);
      streamingAssistantIdRef.current = null;
      contentBufferRef.current = '';
      thinkingBufferRef.current = '';

      try {
        const settings = options.taskSettings ?? loadProviderSettings();
        if (!settings) throw new Error('Settings not found');

        const apiKey =
          settings.provider === 'ollama'
            ? ''
            : await loadApiKey(settings.keyLabel || settings.provider, options.passphrase || '');
        const conversationHistory = limitConversationMessages(
          taskState.chatMessages ?? [],
          settings.contextMaxChars
        );

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
          onToken: applyContentChunk,
          onThinkingToken: applyThinkingChunk
        };

        await addChatMessage({ role: 'user', content: message });

        const assistantMessage = await processChatMessage(
          message,
          chatContext,
          chatConfig,
          conversationHistory
        );

        streamingAssistantIdRef.current = null;
        setStreamingMessage(null);
        contentBufferRef.current = '';
        thinkingBufferRef.current = '';

        if (assistantMessage?.content) {
          const normalized = normalizeThinkingResult(
            assistantMessage.content,
            assistantMessage.thinking
          );
          await addChatMessage({
            role: 'assistant',
            content: normalized.content,
            thinking: normalized.thinking || undefined,
            modelUsed: assistantMessage.modelUsed ?? settings.provider
          });
        }
      } catch (err) {
        streamingAssistantIdRef.current = null;
        setStreamingMessage(null);
        contentBufferRef.current = '';
        thinkingBufferRef.current = '';
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    },
    [
      addChatMessage,
      applyContentChunk,
      applyThinkingChunk,
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

  return {
    messages: displayedMessages,
    isLoading,
    error,
    sendMessage,
    clearError: useCallback(() => setError(null), [])
  };
}
