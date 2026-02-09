/**
 * 任务标签栏组件
 * 职责：展示已打开的任务标签并支持切换/关闭
 * 特点：Lightroom 风格，使用 shadcn/ui Tabs 组件，支持新建任务
 */

import type { MouseEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, Plus } from 'lucide-react';

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
  /** 新建任务回调 */
  onAddNew?: () => void;
}

/**
 * Task tabs bar with closeable tabs using shadcn/ui Tabs component
 * @param {TaskTabsBarProps} props - Component properties
 * @return {JSX.Element} Task tabs bar element
 */
export function TaskTabsBar({ tabs, activeId, onSelect, onClose, onAddNew }: TaskTabsBarProps): JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <Tabs
        value={activeId ?? undefined}
        onValueChange={onSelect}
        className="flex-1"
      >
        <TabsList className="inline-flex h-auto w-full justify-start gap-1 rounded-xl border border-border/50 bg-card/60 p-1.5 shadow-sm">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="relative rounded-lg px-3 py-1.5 text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <span className="pr-5">{tab.label}</span>
              {tabs.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-1/2 h-5 w-5 -translate-y-1/2 p-0 hover:bg-destructive/20 hover:text-destructive"
                  onClick={(event: MouseEvent<HTMLButtonElement>) => {
                    event.stopPropagation();
                    onClose(tab.id);
                  }}
                  aria-label={`Close ${tab.label}`}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {onAddNew && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 w-9 rounded-lg border-border/50 bg-card/60 p-0 hover:bg-primary/10 hover:border-primary/40"
          onClick={onAddNew}
          aria-label="New task"
          title="New task"
        >
          <Plus className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
