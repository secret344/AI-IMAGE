/**
 * 上传阶段的聊天包装组件
 * 职责：整合聊天面板与上传流程的接口
 * 特点：Material Design 3，完全国际化，自包含
 */

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { UploadChatPanel } from '@/components/upload/UploadChatPanel';
import type { UseUploadChatReturn } from '@/hooks/useUploadChat';
import { loadProviderSettings } from '@/modules/storage/settings';

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
 * 封装聊天面板与上传流程的集成
 * 处理本地化、错误处理、样式等
 */
export function UploadChatWrapper({
  chatState,
  imageName = 'untitled',
  disabled = false,
  title,
}: UploadChatWrapperProps) {
  const { t } = useTranslation();
  const settings = loadProviderSettings();

  // 处理发送消息 - 添加API密钥密码短语支持
  const handleSend = useCallback(
    async (message: string) => {
      // 注：密码短语应从用户输入或会话中获取
      // 当前实现使用空字符串（向后兼容无密码存储的密钥）
      await chatState.sendMessage(message);
    },
    [chatState]
  );

  // 处理清除错误
  const handleClearError = useCallback(() => {
    chatState.clearError();
  }, [chatState]);

  return (
    <UploadChatPanel
      messages={chatState.messages}
      onSend={handleSend}
      isLoading={chatState.isLoading}
      error={chatState.error}
      onClearError={handleClearError}
      disabled={disabled || !settings}
      title={title || `${t('chat.title') || '与智能体讨论'} · ${imageName}`}
      emptyStateText={t('chat.emptyState')}
    />
  );
}
