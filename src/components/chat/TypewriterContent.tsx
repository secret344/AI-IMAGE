import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const THINKING_START_MARKER = '[[THINKING]]';
const THINKING_END_MARKER = '[[/THINKING]]';
const THINK_TAG_REGEX = /<think>[\s\S]*?<\/think>/i;
const THINK_FENCE_REGEX = /```(?:thinking|think|thoughts)[\s\S]*?```/i;

function splitThinkingContent(text: string): {
  hasThinking: boolean;
  thinking: string;
  answer: string;
} {
  const startIndex = text.indexOf(THINKING_START_MARKER);
  const endIndex = text.indexOf(THINKING_END_MARKER);

  if (startIndex >= 0) {
    const thinkingStart = startIndex + THINKING_START_MARKER.length;
    const thinkingEnd = endIndex >= 0 ? endIndex : text.length;
    const thinking = text.slice(thinkingStart, thinkingEnd).trim();
    const answerStart = endIndex >= 0 ? endIndex + THINKING_END_MARKER.length : text.length;
    const answer = text.slice(answerStart).trimStart();
    return { hasThinking: true, thinking, answer };
  }

  const tagMatch = text.match(THINK_TAG_REGEX);
  if (tagMatch) {
    const thinking = tagMatch[0].replace(/<\/?think>/gi, '').trim();
    const answer = text.replace(THINK_TAG_REGEX, '').trimStart();
    return { hasThinking: true, thinking, answer };
  }

  const fenceMatch = text.match(THINK_FENCE_REGEX);
  if (fenceMatch) {
    const thinking = fenceMatch[0]
      .replace(/```(?:thinking|think|thoughts)/i, '')
      .replace(/```$/, '')
      .trim();
    const answer = text.replace(THINK_FENCE_REGEX, '').trimStart();
    return { hasThinking: true, thinking, answer };
  }

  return { hasThinking: false, thinking: '', answer: text };
}

interface TypewriterContentProps {
  text: string;
  isActive: boolean;
  speedMs?: number;
}

export function TypewriterContent({ text, isActive, speedMs = 14 }: TypewriterContentProps) {
  const { t } = useTranslation();
  const [displayText, setDisplayText] = useState(text);
  const [isThinkingOpen, setIsThinkingOpen] = useState(true);
  const prevThinkingEndRef = useRef(false);

  useEffect(() => {
    if (!isActive) {
      setDisplayText(text);
      return;
    }
    setDisplayText('');
    let index = 0;
    const interval = window.setInterval(() => {
      index += 1;
      setDisplayText(text.slice(0, index));
      if (index >= text.length) {
        window.clearInterval(interval);
      }
    }, speedMs);
    return () => window.clearInterval(interval);
  }, [isActive, speedMs, text]);

  const { hasThinking, thinking, answer } = useMemo(
    () => splitThinkingContent(displayText),
    [displayText]
  );
  const hasThinkingEnd = useMemo(() => {
    if (!hasThinking) {
      return false;
    }
    if (displayText.includes(THINKING_END_MARKER)) {
      return true;
    }
    return THINK_TAG_REGEX.test(displayText) || THINK_FENCE_REGEX.test(displayText);
  }, [displayText, hasThinking]);

  useEffect(() => {
    if (!hasThinking) {
      prevThinkingEndRef.current = false;
      return;
    }

    if (!hasThinkingEnd) {
      prevThinkingEndRef.current = false;
      return;
    }

    if (!prevThinkingEndRef.current) {
      setIsThinkingOpen(false);
    }
    prevThinkingEndRef.current = true;
  }, [hasThinking, hasThinkingEnd]);

  if (!hasThinking) {
    return (
      <div className="whitespace-pre-wrap break-words">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayText}</ReactMarkdown>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Collapsible open={isThinkingOpen} onOpenChange={setIsThinkingOpen}>
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
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{thinking}</ReactMarkdown>
        </CollapsibleContent>
      </Collapsible>
      {answer ? (
        <div className="whitespace-pre-wrap break-words">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown>
        </div>
      ) : null}
    </div>
  );
}
