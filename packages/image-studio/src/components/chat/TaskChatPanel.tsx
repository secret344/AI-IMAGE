/**
 * 任务聊天面板组件
 * 职责：独立的聊天框，用于单任务的用户交互
 * 特点：Material Design 3 风格，国际化支持，完全低耦合
 */

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@ui/card';
import { Button } from '@ui/button';
import { Textarea } from '@ui/textarea';
import { ScrollArea } from '@ui/scroll-area';
import { Alert, AlertDescription } from '@ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@ui/dialog';
import { Send, MessageCircle, Loader2, RotateCcw, Square } from 'lucide-react';
import type { ChatMessage } from '@/types/conversation';
import { TypewriterContent } from '@/components/chat/TypewriterContent';

export interface TaskChatPanelProps {
  /** 聊天消息列表 */
  messages: ChatMessage[];
  /** 发送消息回调 */
  onSend: (message: string) => void;
  /** 重试上一条消息 */
  onRetry?: () => void;
  /** 是否可重试 */
  canRetry?: boolean;
  /** 上次请求耗时 */
  lastLatencyMs?: number | null;
  /** 失败原因提示 */
  retryHint?: string | null;
  /** 取消当前请求 */
  onCancel?: () => void;
  /** 当前激活的 AI 回复 ID */
  activeAssistantId?: string | null;
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
  /** 回退到指定检查点 */
  onRollbackCheckpointAt?: (index: number) => void;
}

export function TaskChatPanel({
  messages,
  onSend,
  onRetry,
  canRetry = false,
  lastLatencyMs = null,
  retryHint = null,
  onCancel,
  activeAssistantId = null,
  isLoading = false,
  error = null,
  onClearError,
  disabled = false,
  title,
  emptyStateText,
  onRollbackCheckpointAt
}: TaskChatPanelProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [isRollbackOpen, setIsRollbackOpen] = useState(false);
  const [rollbackIndex, setRollbackIndex] = useState<number | null>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true); // 是否应该自动滚动
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasFailure = Boolean(error || retryHint);
  const statusLabel = isLoading
    ? t('chat.status.loading')
    : hasFailure
      ? t('chat.status.failed')
      : lastLatencyMs !== null
        ? t('chat.status.success')
        : null;
  const failureSummary = retryHint || error;
  const failureDetail = retryHint && error && retryHint !== error ? error : null;

  const activeMessageId = activeAssistantId;

  // 监听滚动事件，检测用户是否手动滚动
  useEffect(() => {
    const root = scrollRootRef.current;
    if (!root) return;

    const viewport = root.querySelector(
      '[data-radix-scroll-area-viewport]'
    ) as HTMLDivElement | null;
    if (!viewport) return;
    scrollViewportRef.current = viewport;

    const handleScroll = () => {
      // 如果滚动距离底部超过100px，认为用户在向上滚动
      const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      if (distanceFromBottom > 100) {
        setShouldAutoScroll(false);
      } else {
        // 在底部区域，恢复自动滚动
        setShouldAutoScroll(true);
      }
    };

    viewport.addEventListener('scroll', handleScroll);
    return () => viewport.removeEventListener('scroll', handleScroll);
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    if (!shouldAutoScroll) return;

    const viewport = scrollViewportRef.current;
    if (!viewport) return;
    viewport.scrollTop = viewport.scrollHeight;
  }, [messages, shouldAutoScroll]);

  // 处理发送消息
  const handleSend = () => {
    if (input.trim() && !disabled) {
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
          <div className="ml-auto flex items-center gap-2">
            {isLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
          </div>
        </CardTitle>
        {(statusLabel || lastLatencyMs !== null) && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground/80">
            {statusLabel && (
              <span>
                {t('chat.statusLabel') || '状态'}: {statusLabel}
              </span>
            )}
            {lastLatencyMs !== null && (
              <span>
                {t('chat.lastLatency') || '上次耗时'}: {lastLatencyMs}ms
              </span>
            )}
          </div>
        )}
      </CardHeader>

      {!isLoading && !hasFailure && lastLatencyMs !== null && (
        <Alert className="mx-4 mt-3 border-border/50 bg-primary/5">
          <AlertDescription className="text-xs text-muted-foreground/80">
            {t('chat.successHint', { latency: lastLatencyMs }) ||
              `上次响应已完成（${lastLatencyMs}ms），可继续对话或重试。`}
          </AlertDescription>
        </Alert>
      )}

      {/* 中间：消息区域 */}
      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        <ScrollArea ref={scrollRootRef} className="flex-1 p-4 sm:p-5">
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
                <div key={msg.id || idx} className="space-y-2">
                  <div
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
                      {msg.role === 'assistant' ? (
                        <TypewriterContent
                          messageId={msg.id}
                          content={msg.content}
                          thinking={msg.thinking}
                          isActive={msg.id === activeMessageId}
                        />
                      ) : (
                        <span className="whitespace-pre-wrap">{msg.content}</span>
                      )}
                    </div>
                  </div>
                  {msg.role === 'assistant' && (
                    <div className="flex items-center justify-between gap-2 px-1">
                      <span className="text-xs text-muted-foreground/80">
                        {t('chat.checkpoint.label') || '检查点'} ·{' '}
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={disabled || isLoading || !onRollbackCheckpointAt}
                        className="h-7 px-2 text-xs"
                        onClick={() => {
                          setRollbackIndex(idx);
                          setIsRollbackOpen(true);
                        }}
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1" />
                        {t('chat.checkpoint.rollback') || '回退到检查点'}
                      </Button>
                    </div>
                  )}
                  {msg.role === 'assistant' && hasFailure && idx === messages.length - 1 && (
                    <div className="space-y-1 px-1">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <span className="text-xs text-muted-foreground/70">
                          {t('chat.retryHint') || '本条回复失败，可重试'}
                        </span>
                        <span className="inline-flex items-center rounded-full border border-destructive/40 bg-destructive/15 px-2 py-0.5 text-[11px] text-destructive">
                          {failureSummary}
                        </span>
                        {onRetry && canRetry && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={onRetry}
                            disabled={disabled || isLoading}
                            className="h-7 px-2 text-xs"
                          >
                            <RotateCcw className="h-3.5 w-3.5 mr-1" />
                            {t('chat.retry') || '重试'}
                          </Button>
                        )}
                      </div>
                      {failureDetail && (
                        <div className="text-xs text-muted-foreground/80 text-right">
                          {failureDetail}
                        </div>
                      )}
                    </div>
                  )}
                  {msg.role === 'assistant' && idx < messages.length - 1 && (
                    <div className="border-t border-dashed border-border/50" />
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <Dialog open={isRollbackOpen} onOpenChange={setIsRollbackOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('chat.checkpoint.confirmTitle') || '确认回退'}</DialogTitle>
              <DialogDescription>
                {t('chat.checkpoint.confirmDescription') ||
                  '回退将丢弃检查点之后的消息。此操作不可撤销。'}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsRollbackOpen(false)}>
                {t('chat.checkpoint.cancelAction') || '取消'}
              </Button>
              <Button
                onClick={() => {
                  if (rollbackIndex !== null) {
                    onRollbackCheckpointAt?.(rollbackIndex);
                  }
                  setIsRollbackOpen(false);
                }}
              >
                {t('chat.checkpoint.confirmAction') || '确认回退'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {failureSummary && onClearError && (
          <div className="mx-4 mt-2 flex justify-end">
            <Button variant="ghost" size="sm" onClick={onClearError} className="h-6 px-2 text-xs">
              {t('chat.cancel') || '关闭'}
            </Button>
          </div>
        )}

        {/* 底部：输入区域 */}
        <div className="border-t border-border/30 p-4 sm:p-5 bg-background/60">
          <div className="flex gap-2 items-end">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('chat.inputPlaceholder') || '输入消息... (Cmd+Enter 发送)'}
              disabled={isLoading || disabled}
              className="min-h-[40px] max-h-[120px] resize-none"
              rows={2}
            />
            <div className="flex flex-col gap-2">
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isLoading || disabled}
                className="px-3"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
              {isLoading && onCancel && (
                <Button onClick={onCancel} variant="outline" size="sm" className="px-3">
                  <Square className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
