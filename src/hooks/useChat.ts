/**
 * 聊天状态管理 Hook (低耦合设计)
 * 职责：聊天 UI 的状态管理，不涉及业务逻辑
 * 特点：独立的 Hook，可在任何组件中使用
 */

import { useState, useCallback } from 'react';
import type { ChatMessage, ConversationThread } from '@/types/conversation';

export interface UseChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  currentThreadId: string;
}

export interface UseChatActions {
  addMessage: (message: ChatMessage) => void;
  addUserMessage: (content: string) => ChatMessage;
  clearMessages: () => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
}

/**
 * 聊天状态 Hook
 * 用法：
 * const chat = useChat(initialMessages);
 * chat.addUserMessage('你认为这张图片的构图如何？');
 */
export function useChat(initialMessages: ChatMessage[] = []): UseChatState & UseChatActions {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentThreadId] = useState<string>('main');

  const addMessage = useCallback((message: ChatMessage) => {
    setMessages(prev => [...prev, message]);
  }, []);

  const addUserMessage = useCallback(
    (content: string): ChatMessage => {
      const message: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'user',
        content,
        timestamp: Date.now(),
        threadId: currentThreadId,
      };
      addMessage(message);
      return message;
    },
    [addMessage, currentThreadId]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    currentThreadId,
    addMessage,
    addUserMessage,
    clearMessages,
    setError,
    setLoading,
  };
}
