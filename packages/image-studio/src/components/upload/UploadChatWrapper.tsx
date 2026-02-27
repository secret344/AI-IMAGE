/**
 * 上传阶段的聊天包装组件
 * 职责：整合聊天面板与上传流程的接口
 * 特点：Material Design 3，完全国际化，自包含
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TaskChatPanel } from '@/components/chat/TaskChatPanel';
import type { UseUploadChatReturn } from '@/hooks/useUploadChat';
import { useAppStore } from '@/state/useAppStore';
import { getDefaultProviderSettings } from '@/modules/storage/settings';
import { recordChatFailure } from '@/modules/storage/chatAnalytics';

export interface UploadChatWrapperProps {
  /** 聊天hook返回值 */
  chatState: UseUploadChatReturn;
  /** 图片文件名 */
  imageName?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 自定义标题 */
  title?: string;
}

/**
 * Upload chat wrapper component encapsulating chat panel and upload process
 * @param {UploadChatWrapperProps} props - Component properties
 * @return {JSX.Element} Upload chat wrapper element
 */
export function UploadChatWrapper({
  chatState,
  imageName = 'untitled',
  disabled = false,
  title
}: UploadChatWrapperProps) {
  const { t } = useTranslation();
  const [lastUserMessage, setLastUserMessage] = useState<string | null>(null);
  const lastLoggedErrorRef = useRef<string | null>(null);
  const settings =
    useAppStore((state) => state.globalProviderSettings) ?? getDefaultProviderSettings();

  // 处理发送消息 - 添加API密钥密码短语支持
  const handleSend = useCallback(
    async (message: string) => {
      // 注：密码短语应从用户输入或会话中获取
      // 当前实现使用空字符串（向后兼容无密码存储的密钥）
      setLastUserMessage(message);
      await chatState.sendMessage(message);
    },
    [chatState]
  );

  const handleRetry = useCallback(async () => {
    if (!lastUserMessage || disabled || chatState.isLoading) {
      return;
    }
    await chatState.sendMessage(lastUserMessage);
  }, [chatState, disabled, lastUserMessage]);

  // 处理清除错误
  const handleClearError = useCallback(() => {
    chatState.clearError();
  }, [chatState]);

  const classifyFailure = useCallback(
    (message: string | null) => {
      if (!message) {
        return { category: 'unknown' as const, label: null };
      }
      const lower = message.toLowerCase();
      if (lower.includes('timeout') || message.includes('超时')) {
        return { category: 'timeout' as const, label: t('chat.failure.timeout') };
      }
      if (lower.includes('network') || message.includes('网络')) {
        return { category: 'network' as const, label: t('chat.failure.network') };
      }
      if (lower.includes('abort') || message.includes('取消')) {
        return { category: 'canceled' as const, label: t('chat.failure.canceled') };
      }
      return { category: 'unknown' as const, label: t('chat.failure.unknown') };
    },
    [t]
  );

  useEffect(() => {
    if (!chatState.error || chatState.isLoading) {
      return;
    }
    if (chatState.error === lastLoggedErrorRef.current) {
      return;
    }
    const { category } = classifyFailure(chatState.error);
    recordChatFailure(category, chatState.error);
    lastLoggedErrorRef.current = chatState.error;
  }, [chatState.error, chatState.isLoading, classifyFailure]);

  return (
    <TaskChatPanel
      messages={chatState.messages}
      onSend={handleSend}
      onRetry={handleRetry}
      canRetry={Boolean(lastUserMessage)}
      lastLatencyMs={chatState.lastLatencyMs}
      retryHint={classifyFailure(chatState.error).label}
      onCancel={chatState.cancelCurrent}
      isLoading={chatState.isLoading}
      error={chatState.error}
      onClearError={handleClearError}
      onRollbackCheckpointAt={chatState.rollbackToCheckpointAt}
      activeAssistantId={chatState.activeAssistantId}
      disabled={disabled || !settings}
      title={title || `${t('chat.title') || '与智能体讨论'} · ${imageName}`}
      emptyStateText={t('chat.emptyState')}
    />
  );
}
