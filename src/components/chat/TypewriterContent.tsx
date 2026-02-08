/**
 * 思考内容展示组件 - 重构版
 * 职责：展示模型思考过程与最终答复
 * 数据流：props → useMemo(有效数据) → useState(显示状态) → useEffect(动画控制) → render
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { normalizeThinkingResult } from '@/utils/thinking';

interface TypewriterContentProps {
  content: string;
  thinking?: string;
  isActive: boolean;
  speedMs?: number;
  thinkingSpeedMs?: number;
  messageId?: string;
}

export function TypewriterContent({
  content,
  thinking,
  isActive,
  speedMs = 8,
  thinkingSpeedMs,
  messageId
}: TypewriterContentProps) {
  const { t } = useTranslation();
  const resolvedThinkingSpeedMs = thinkingSpeedMs ?? Math.max(4, Math.floor(speedMs * 0.6));

  // Step 1: 提取有效内容（不会在render中重复计算）
  const { effectiveContent, effectiveThinking } = useMemo(() => {
    if (thinking) {
      return { effectiveContent: content, effectiveThinking: thinking };
    }
    if (!content) {
      return { effectiveContent: '', effectiveThinking: '' };
    }
    if (!isActive) {
      return { effectiveContent: content, effectiveThinking: '' };
    }
    const normalized = normalizeThinkingResult(content);
    return {
      effectiveContent: normalized.content,
      effectiveThinking: normalized.thinking
    };
  }, [content, isActive, thinking]);

  // Step 2: 显示状态（独立管理）
  const [displayText, setDisplayText] = useState(effectiveContent);
  const [displayThinking, setDisplayThinking] = useState(effectiveThinking);
  const [isThinkingOpen, setIsThinkingOpen] = useState(isActive && Boolean(effectiveThinking));

  // 用于判断内容是否发生变化
  const prevContentRef = useRef(effectiveContent);
  const prevThinkingRef = useRef(effectiveThinking);
  const contentIntervalRef = useRef<number | null>(null);
  const thinkingIntervalRef = useRef<number | null>(null);
  const segmentDelayMs = 70;
  const autoOpenedRef = useRef(false);
  const userToggledRef = useRef(false);
  const lastMessageIdRef = useRef(messageId ?? null);

  useEffect(() => {
    const nextId = messageId ?? null;
    if (lastMessageIdRef.current !== nextId) {
      lastMessageIdRef.current = nextId;
      autoOpenedRef.current = false;
      userToggledRef.current = false;
      setIsThinkingOpen(isActive && Boolean(effectiveThinking));
      prevContentRef.current = effectiveContent;
      prevThinkingRef.current = effectiveThinking;
    }
  }, [effectiveContent, effectiveThinking, isActive, messageId]);

  const renderSegments = (text: string) => {
    return text
      .split(/\n{2,}/)
      .filter((segment) => segment.trim().length > 0)
      .map((segment, index) => (
        <div
          key={`${segment.slice(0, 16)}-${index}`}
          className="animate-in fade-in"
          style={{ animationDelay: `${index * segmentDelayMs}ms` }}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{segment}</ReactMarkdown>
        </div>
      ));
  };

  const renderCursor = () => (
    <span className="inline-block h-4 w-1.5 animate-pulse rounded-sm bg-foreground/70 align-text-bottom" />
  );

  // Step 3: 内容动画控制
  useEffect(() => {
    if (!effectiveContent) {
      setDisplayText('');
      return;
    }

    if (!isActive) {
      // 非活跃状态直接设置
      setDisplayText(effectiveContent);
      prevContentRef.current = effectiveContent;
      if (contentIntervalRef.current) {
        clearInterval(contentIntervalRef.current);
        contentIntervalRef.current = null;
      }
      return;
    }

    // 活跃状态下，内容变化时才启动动画
    if (prevContentRef.current !== effectiveContent) {
      const currentLength = displayText.length;
      const shouldAppend = effectiveContent.startsWith(displayText);
      if (!shouldAppend) {
        setDisplayText('');
      }
      let index = shouldAppend ? currentLength : 0;
      contentIntervalRef.current = window.setInterval(() => {
        index += 1;
        setDisplayText(effectiveContent.slice(0, index));
        if (index >= effectiveContent.length) {
          if (contentIntervalRef.current) {
            clearInterval(contentIntervalRef.current);
            contentIntervalRef.current = null;
          }
        }
      }, speedMs);
      prevContentRef.current = effectiveContent;
    }

    return () => {
      if (contentIntervalRef.current) {
        clearInterval(contentIntervalRef.current);
      }
    };
  }, [effectiveContent, isActive, speedMs]);

  // Step 4: 思考内容动画控制
  useEffect(() => {
    if (!effectiveThinking) {
      setDisplayThinking('');
      if (thinkingIntervalRef.current) {
        clearInterval(thinkingIntervalRef.current);
        thinkingIntervalRef.current = null;
      }
      return;
    }

    if (!isActive) {
      // 非活跃状态直接显示
      setDisplayThinking(effectiveThinking);
      prevThinkingRef.current = effectiveThinking;
      if (thinkingIntervalRef.current) {
        clearInterval(thinkingIntervalRef.current);
        thinkingIntervalRef.current = null;
      }
      return;
    }

    // 活跃状态下，思考内容变化时启动动画
    if (prevThinkingRef.current !== effectiveThinking) {
      const currentLength = displayThinking.length;
      const shouldAppend = effectiveThinking.startsWith(displayThinking);
      if (!shouldAppend) {
        setDisplayThinking('');
      }
      let index = shouldAppend ? currentLength : 0;
      thinkingIntervalRef.current = window.setInterval(() => {
        index += 1;
        setDisplayThinking(effectiveThinking.slice(0, index));
        if (index >= effectiveThinking.length) {
          if (thinkingIntervalRef.current) {
            clearInterval(thinkingIntervalRef.current);
            thinkingIntervalRef.current = null;
          }
        }
      }, resolvedThinkingSpeedMs);
      prevThinkingRef.current = effectiveThinking;
    }

    return () => {
      if (thinkingIntervalRef.current) {
        clearInterval(thinkingIntervalRef.current);
      }
    };
  }, [effectiveThinking, isActive, resolvedThinkingSpeedMs, speedMs, displayThinking]);

  // Step 5: 自动打开思考面板
  useEffect(() => {
    if (!isActive && autoOpenedRef.current && !userToggledRef.current) {
      setIsThinkingOpen(false);
    }
    if (isActive && effectiveThinking && !isThinkingOpen && !autoOpenedRef.current) {
      autoOpenedRef.current = true;
      setIsThinkingOpen(true);
    }
  }, [isActive, effectiveThinking, isThinkingOpen]);

  // Step 6: 渲染
  // 如果没有思考内容，只显示回复
  if (!effectiveThinking) {
    return (
      <div className="whitespace-pre-wrap break-words">
        {isActive ? (
          <>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayText}</ReactMarkdown>
            {renderCursor()}
          </>
        ) : (
          renderSegments(displayText)
        )}
      </div>
    );
  }

  // 有思考内容时，显示折叠面板 + 回复
  return (
    <div className="space-y-2">
      <Collapsible
        open={isThinkingOpen}
        onOpenChange={(open) => {
          userToggledRef.current = true;
          setIsThinkingOpen(open);
        }}
      >
        <div className="flex items-center gap-2">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
              {isThinkingOpen
                ? t('chat.thinking.hide') || '收起思考'
                : t('chat.thinking.show') || '展开思考'}
            </Button>
          </CollapsibleTrigger>
          <span className="text-xs text-muted-foreground">
            {t('chat.thinking.label') || '思考过程'}
          </span>
        </div>
        <CollapsibleContent className="mt-2 rounded-md border border-border/50 bg-background/60 p-2 text-xs leading-relaxed whitespace-pre-wrap break-words">
          {isActive && !effectiveThinking ? (
            <div className="space-y-2">
              <div className="h-3 w-5/6 animate-pulse rounded bg-muted/60" />
              <div className="h-3 w-4/6 animate-pulse rounded bg-muted/60" />
              <div className="h-3 w-3/6 animate-pulse rounded bg-muted/60" />
            </div>
          ) : isActive ? (
            <>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayThinking}</ReactMarkdown>
              {renderCursor()}
            </>
          ) : (
            renderSegments(displayThinking)
          )}
        </CollapsibleContent>
      </Collapsible>
      {displayText ? (
        <div className="whitespace-pre-wrap break-words">
          {isActive ? (
            <>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayText}</ReactMarkdown>
              {renderCursor()}
            </>
          ) : (
            renderSegments(displayText)
          )}
        </div>
      ) : null}
    </div>
  );
}
