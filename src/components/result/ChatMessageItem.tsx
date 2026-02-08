/**
 * 聊天消息项组件
 */

import type { ChatMessage } from '@/types/conversation';
import { cn } from '@/lib/utils';
import { TypewriterContent } from '@/components/chat/TypewriterContent';

/**
 * Format timestamp to human-readable format
 * @param {number} timestamp - Millisecond timestamp
 * @return {string} Formatted time string
 */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  // 1 分钟内
  if (diff < 60000) return '刚刚';
  // 1 小时内
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  // 今天
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  // 其他
  return date.toLocaleDateString('zh-CN');
}

/**
 * 聊天消息项组件的 Props
 */
export interface ChatMessageProps {
  message: ChatMessage;
  isLatestAssistant?: boolean;
  isStreaming?: boolean;
}

export function ChatMessageItem({
  message,
  isLatestAssistant = false,
  isStreaming = false
}: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex gap-2 mb-3', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-xs px-3 py-2 rounded-lg text-sm break-words whitespace-pre-wrap',
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-none'
            : 'bg-muted text-foreground rounded-bl-none'
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <TypewriterContent text={message.content} isActive={isLatestAssistant && isStreaming} />
        )}
      </div>
      <div className="text-xs text-muted-foreground flex items-end pb-1">
        {formatTime(message.timestamp)}
      </div>
    </div>
  );
}
