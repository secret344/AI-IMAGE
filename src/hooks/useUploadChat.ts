import { useCallback, useMemo, useRef, useState } from 'react';
import type { ChatMessage } from '@/types/conversation';
import type { ProviderSettings } from '@/modules/storage/settings';
import { useTaskContext } from '@/state/TaskContext';
import { handleUploadChatMessage } from '@/modules/evaluation/uploadChatIntegration';
import { limitConversationMessages } from '@/modules/ai/limitConversationMessages';

/**
 * 上传聊天 hook 的配置选项
 */
export interface UseUploadChatOptions {
  taskId: string;
  agentStyle: string;
  agentPhotographer?: string;
  imageName: string;
  imageBase64: string; // 上传图片的 base64 数据
  evaluationResultSummary?: string;
  /** API密钥密码短语（可选，用于解密存储的API密钥） */
  apiKeyPassphrase?: string;
  /** 任务级设置（跟随任务，不使用全局配置） */
  taskSettings?: ProviderSettings | null;
}

/**
 * 上传聊天 hook 的返回值
 * 包含消息列表、加载状态、错误和各种操作方法
 */
export interface UseUploadChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  lastLatencyMs: number | null;
  analysisSuggestion: string | null;
  shouldShowAnalysisSuggestion: boolean;
  activeAssistantId: string | null;
  sendMessage: (message: string) => Promise<void>;
  cancelCurrent: () => void;
  confirmAnalysis: () => void;
  rollbackToCheckpointAt: (index: number) => void;
  clearError: () => void;
  clearMessages: () => void;
}

export function useUploadChat(options: UseUploadChatOptions): UseUploadChatReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);
  const [analysisSuggestion, setAnalysisSuggestion] = useState<string | null>(null);
  const [shouldShowAnalysisSuggestion, setShouldShowAnalysisSuggestion] = useState(false);
  const [activeAssistantId, setActiveAssistantId] = useState<string | null>(null);
  const [streamingMessage, setStreamingMessage] = useState<ChatMessage | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamingAssistantIdRef = useRef<string | null>(null);

  // Get messages from TaskContext instead of local state
  const { taskState, addChatMessage, clearChatMessages, setChatMessages } = useTaskContext();
  const storedMessages = taskState.chatMessages ?? [];
  const messages = useMemo(
    () => (streamingMessage ? [...storedMessages, streamingMessage] : storedMessages),
    [streamingMessage, storedMessages]
  );

  const appendAssistantMessage = useCallback(
    async (content: string, modelUsed?: string, replaceId?: string | null) => {
      if (!content.trim()) {
        return;
      }

      // 清除流消息（replaceId 表示需要替换的流消息ID，不为 null 则清除）
      if (replaceId) {
        setStreamingMessage(null);
      }

      try {
        const stored = await addChatMessage({
          role: 'assistant',
          content,
          modelUsed
        });
        setActiveAssistantId(replaceId ? null : stored.id);
      } catch (error) {
        console.error('Failed to store assistant message:', error);
        // 出错时只用临时消息显示，不重复添加到存储
        const fallbackId =
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `fallback-${Date.now()}`;
        const fallbackMessage: ChatMessage = {
          id: fallbackId,
          role: 'assistant',
          content,
          timestamp: Date.now(),
          modelUsed
        };
        setStreamingMessage(fallbackMessage);
        setActiveAssistantId(replaceId ? null : fallbackId);
      }
    },
    [addChatMessage]
  );

  const applyStreamChunk = useCallback(
    (chunk: string) => {
      if (!chunk) {
        return;
      }
      const currentId = streamingAssistantIdRef.current;
      if (!currentId) {
        const nextId =
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `stream-${Date.now()}`;
        streamingAssistantIdRef.current = nextId;
        const message: ChatMessage = {
          id: nextId,
          role: 'assistant',
          content: chunk,
          timestamp: Date.now(),
          modelUsed: options.taskSettings?.provider
        };
        setStreamingMessage(message);
        setActiveAssistantId(null);
        return;
      }

      setStreamingMessage((prev) =>
        prev && prev.id === currentId ? { ...prev, content: `${prev.content}${chunk}` } : prev
      );
    },
    [options.taskSettings?.provider]
  );

  const sendMessage = useCallback(
    async (userMessage: string) => {
      if (!userMessage.trim()) return;

      setError(null);
      setIsLoading(true);
      setActiveAssistantId(null);
      const startTime = Date.now();
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        // 立即添加用户消息到界面
        const historySnapshot = storedMessages;
        await addChatMessage({
          role: 'user',
          content: userMessage
        });
        const nextHistory = limitConversationMessages(
          historySnapshot,
          options.taskSettings?.contextMaxChars
        );

        // 调用聊天处理，传递图片、任务设置和密码短语
        await handleUploadChatMessage(
          userMessage,
          nextHistory,
          options.imageBase64,
          {
            taskId: options.taskId,
            agentStyle: options.agentStyle,
            agentPhotographer: options.agentPhotographer,
            imageName: options.imageName,
            evaluationResultSummary: options.evaluationResultSummary,
            taskSettings: options.taskSettings
          },
          {
            onMessageReceived: (aiMessage: ChatMessage) => {
              const replaceId = streamingAssistantIdRef.current;
              streamingAssistantIdRef.current = null;
              void appendAssistantMessage(aiMessage.content, aiMessage.modelUsed, replaceId);
            },
            onAnalysisSuggested: (suggestion: string) => {
              setAnalysisSuggestion(suggestion);
              setShouldShowAnalysisSuggestion(true);
            },
            onError: (err: Error) => {
              if (!controller.signal.aborted) {
                const replaceId = streamingAssistantIdRef.current;
                streamingAssistantIdRef.current = null;
                setStreamingMessage((prev) => (prev && prev.id === replaceId ? null : prev));
                setError(err.message);
                void appendAssistantMessage(err.message);
              }
            },
            onStreamChunk: applyStreamChunk
          },
          options.apiKeyPassphrase,
          controller.signal
        );
      } catch (err) {
        if (!controller.signal.aborted) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          const replaceId = streamingAssistantIdRef.current;
          streamingAssistantIdRef.current = null;
          setStreamingMessage((prev) => (prev && prev.id === replaceId ? null : prev));
          setError(errorMessage);
          void appendAssistantMessage(errorMessage);
        }
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        setLastLatencyMs(Date.now() - startTime);
        setIsLoading(false);
      }
    },
    [addChatMessage, appendAssistantMessage, applyStreamChunk, options, storedMessages]
  );

  const cancelCurrent = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsLoading(false);
  }, []);

  const confirmAnalysis = useCallback(() => {
    setShouldShowAnalysisSuggestion(false);
    setAnalysisSuggestion(null);
  }, []);

  const rollbackToCheckpointAt = useCallback(
    (index: number) => {
      if (index < 0) {
        return;
      }
      const snapshot = storedMessages.slice(0, index + 1);
      setStreamingMessage(null);
      streamingAssistantIdRef.current = null;
      void setChatMessages(snapshot);
      setActiveAssistantId(null);
      setAnalysisSuggestion(null);
      setShouldShowAnalysisSuggestion(false);
      setError(null);
    },
    [storedMessages, setChatMessages]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearMessages = useCallback(() => {
    setAnalysisSuggestion(null);
    setShouldShowAnalysisSuggestion(false);
    setActiveAssistantId(null);
    setStreamingMessage(null);
    streamingAssistantIdRef.current = null;
    void clearChatMessages();
  }, [clearChatMessages]);

  return {
    messages,
    isLoading,
    error,
    lastLatencyMs,
    analysisSuggestion,
    shouldShowAnalysisSuggestion,
    activeAssistantId,
    sendMessage,
    cancelCurrent,
    confirmAnalysis,
    rollbackToCheckpointAt,
    clearError,
    clearMessages
  };
}
