/**
 * 上传阶段的聊天面板组件
 * 职责：独立的聊天框，用于上传阶段的图片讨论
 * 特点：Material Design 3 风格，国际化支持，完全低耦合
 */

import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Send, MessageCircle, Loader2 } from 'lucide-react';
import type { ChatMessage } from '@/types/conversation';

export interface UploadChatPanelProps {
  /** 聊天消息列表 */
  messages: ChatMessage[];
  /** 发送消息回调 */
  onSend: (message: string) => void;
  /** 是否加载中 */
  isLoading?: boolean;
  /** 错误消息 */
  error?: string | null;
  /** 清除错误回调 */
  onClearError?: () => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 自定义标题 */
  title?: string;
  /** 自定义空状态文本 */
  emptyStateText?: string;
}

export function UploadChatPanel({
  messages,
  onSend,
  isLoading = false,
  error = null,
  onClearError,
  disabled = false,
  title,
  emptyStateText,
}: UploadChatPanelProps) {
  const { t } = useTranslation();
  const [input, setInput] = React.useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    const timer = setTimeout(() => {
      if (scrollRef.current?.parentElement) {
        scrollRef.current.parentElement.scrollTop = scrollRef.current.parentElement.scrollHeight;
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [messages]);

  // 处理发送消息
  const handleSend = () => {
    if (input.trim() && !isLoading && !disabled) {
      onSend(input);
      setInput('');
      inputRef.current?.focus();
    }
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd+Enter 或 Ctrl+Enter 发送
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Card className="h-full flex flex-col border-l border-border/50 bg-card/30 backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow">
      {/* 顶部：标题栏 */}
      <CardHeader className="pb-3 sm:pb-4 border-b border-border/30 bg-gradient-to-r from-primary/5 via-transparent to-transparent">
        <CardTitle className="text-base sm:text-lg flex items-center gap-3">
          <MessageCircle className="h-5 w-5 text-primary/70" />
          <span>{title || t('chat.title') || '与智能体讨论'}</span>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-primary ml-auto" />}
        </CardTitle>
      </CardHeader>

      {/* 中间：消息区域 */}
      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        <ScrollArea className="flex-1 p-4 sm:p-5">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <MessageCircle className="h-12 w-12 text-muted-foreground/20 mb-3" />
              <p className="text-sm text-muted-foreground">
                {emptyStateText || t('chat.emptyState') || '开始与智能体讨论吧'}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-2">
                {t('chat.emptyHint') || '你可以问问AI对这张图片的看法'}
              </p>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {messages.map((msg, idx) => (
                <div
                  key={msg.id || idx}
                  className={`flex gap-2 sm:gap-3 animate-in fade-in slide-in-from-bottom-2 ${
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-xs sm:max-w-sm px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-none shadow-sm'
                        : 'bg-muted/60 text-foreground rounded-bl-none border border-border/30 backdrop-blur-sm'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              <div ref={scrollRef} />
            </div>
          )}
        </ScrollArea>

        {/* 错误提示 */}
        {error && (
          <Alert variant="destructive" className="m-4 mt-2 border-destructive/50 bg-destructive/10">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <AlertDescription className="ml-2 flex items-center justify-between gap-2">
              <span className="text-sm line-clamp-2">{error}</span>
              {onClearError && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClearError}
                  className="h-6 px-2 text-xs hover:bg-destructive/20"
                >
                  {t('common.close') || '关闭'}
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* 底部：输入框 */}
        <div className="border-t border-border/30 bg-gradient-to-r from-background/50 via-background/30 to-background/50 p-3 sm:p-4 space-y-2">
          <div className="flex gap-2">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('chat.inputPlaceholder') || '输入消息... (Cmd+Enter 发送)'}
              disabled={isLoading || disabled}
              className="min-h-10 max-h-24 resize-none text-sm rounded-lg border-border/50 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
              rows={1}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading || disabled}
              size="sm"
              className="h-10 w-10 p-0 flex-shrink-0 rounded-lg"
              title={t('chat.sendButton') || '发送'}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground/60 px-1">
            {t('chat.shortcut') || '按 Cmd+Enter 或 Ctrl+Enter 快速发送'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

import React from 'react';
