/**
 * 聊天消息项组件
 */

import type { ChatMessage } from '@/types/conversation';
import { formatTime } from '@/lib/utils';
import { cn } from '@/lib/utils';

export interface ChatMessageProps {
  message: ChatMessage;
}

export function ChatMessageItem({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex gap-2 mb-3', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-xs px-3 py-2 rounded-lg text-sm break-words',
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-none'
            : 'bg-muted text-foreground rounded-bl-none'
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>
      <div className="text-xs text-muted-foreground flex items-end pb-1">
        {formatTime(message.timestamp)}
      </div>
    </div>
  );
}
