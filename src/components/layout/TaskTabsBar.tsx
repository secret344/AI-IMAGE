/**
 * 任务标签栏组件
 * 职责：展示已打开的任务标签并支持切换/关闭
 * 特点：Lightroom 风格，横向滚动，轻量交互
 */

import type { MouseEvent } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export interface TaskTabItem {
  /** 任务唯一 ID */
  id: string;
  /** 标签显示名称 */
  label: string;
}

export interface TaskTabsBarProps {
  /** 标签列表 */
  tabs: TaskTabItem[];
  /** 当前激活任务 ID */
  activeId: string | null;
  /** 切换标签回调 */
  onSelect: (taskId: string) => void;
  /** 关闭标签回调 */
  onClose: (taskId: string) => void;
}

/**
 * Task tabs bar with closeable tabs
 * @param {TaskTabsBarProps} props - Component properties
 * @return {JSX.Element} Task tabs bar element
 */
export function TaskTabsBar({ tabs, activeId, onSelect, onClose }: TaskTabsBarProps): JSX.Element {
  return (
    <div className="rounded-xl border border-border/50 bg-card/60 shadow-sm">
      <ScrollArea className="w-full">
        <div className="flex items-center gap-2 px-3 py-2">
          {tabs.map((tab) => {
            const isActive = tab.id === activeId;
            return (
              <div
                key={tab.id}
                className={cn(
                  'flex items-center gap-1 rounded-full border px-2 py-1 text-xs transition',
                  isActive
                    ? 'border-primary/40 bg-primary/10 text-foreground'
                    : 'border-border/60 bg-background/40 text-muted-foreground hover:text-foreground'
                )}
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => onSelect(tab.id)}
                >
                  {tab.label}
                </Button>
                {tabs.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 px-0 text-xs"
                    onClick={(event: MouseEvent<HTMLButtonElement>) => {
                      event.stopPropagation();
                      onClose(tab.id);
                    }}
                  >
                    x
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
