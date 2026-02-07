/**
 * 聊天面板组件
 */

import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatMessageItem } from './ChatMessageItem';
import { ChatInput } from './ChatInput';
import { useTranslation } from 'react-i18next';
import { AlertCircle, MessageCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { ChatMessage } from '@/types/conversation';

export interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (message: string) => void;
  isLoading?: boolean;
  error?: string | null;
  onClearError?: () => void;
  disabled?: boolean;
}

export function ChatPanel({
  messages,
  onSend,
  isLoading = false,
  error = null,
  onClearError,
  disabled = false,
}: ChatPanelProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    const timer = setTimeout(() => {
      if (scrollRef.current) {
        const parent = scrollRef.current.parentElement;
        if (parent) {
          parent.scrollTop = parent.scrollHeight;
        }
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [messages]);

  return (
    <Card className="h-full flex flex-col border-l">
      <CardHeader className="pb-3 border-b">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageCircle className="h-4 w-4" />
          {t('chat.title') || '与智能体讨论'}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        {/* 消息列表 */}
        <ScrollArea className="flex-1 p-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              {t('chat.emptyState') || '开始与智能体讨论吧'}
            </div>
          ) : (
            <div>
              {messages.map((msg, idx) => (
                <ChatMessageItem key={msg.id || idx} message={msg} />
              ))}
              <div ref={scrollRef} />
            </div>
          )}
        </ScrollArea>

        {/* 错误提示 */}
        {error && (
          <Alert variant="destructive" className="m-4 mt-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>{error}</span>
              {onClearError && (
                <button
                  onClick={onClearError}
                  className="text-xs underline ml-2 hover:opacity-70"
                >
                  关闭
                </button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* 输入框 */}
        <div className="p-4 border-t">
          <ChatInput
            onSend={onSend}
            isLoading={isLoading}
            disabled={disabled}
          />
        </div>
      </CardContent>
    </Card>
  );
}
