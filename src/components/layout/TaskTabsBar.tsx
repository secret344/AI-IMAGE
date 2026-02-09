/**
 * 任务标签栏组件
 * 职责：展示已打开的任务标签并支持切换/关闭/拖拽排序
 * 特点：使用 react-dnd 实现拖拽排序，支持新建任务
 */

import type { MouseEvent } from 'react';
import { useMemo } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, Plus } from 'lucide-react';

export interface TaskTabItem {
  /** 任务唯一 ID */
  id: string;
  /** 标签显示名称 */
  label: string;
}

interface DragItem {
  type: string;
  id: string;
  index: number;
}

interface TabItemProps {
  tab: TaskTabItem;
  index: number;
  onSelect: (taskId: string) => void;
  onClose: (taskId: string) => void;
  canClose: boolean;
  onMove: (dragIndex: number, dropIndex: number) => void;
}

/**
 * Draggable tab item component
 */
function DraggableTabItem({
  tab,
  index,
  onSelect,
  onClose,
  canClose,
  onMove
}: TabItemProps): JSX.Element {
  const ref = useMemo(() => ({ current: null as HTMLDivElement | null }), []);

  const [{ isDragging }, drag] = useDrag({
    type: 'tab',
    item: () => ({
      type: 'tab',
      id: tab.id,
      index
    }),
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging()
    })
  });

  const [{ isOver }, drop] = useDrop({
    accept: 'tab',
    hover: (item: DragItem) => {
      if (!ref.current) {
        return;
      }
      const dragIndex = item.index;
      const hoverIndex = index;

      if (dragIndex === hoverIndex) {
        return;
      }

      onMove(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
    collect: (monitor) => ({
      isOver: !!monitor.isOver({ shallow: true })
    })
  });

  drop(drag(ref));

  return (
    <div
      ref={ref}
      className={`relative transition-all ${isDragging ? 'opacity-50' : ''} ${
        isOver ? 'ml-1 border-l-2 border-primary/50' : ''
      }`}
    >
      <TabsTrigger
        value={tab.id}
        onClick={() => onSelect(tab.id)}
        className="relative rounded-lg px-3 py-1.5 text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-foreground data-[state=active]:shadow-sm select-none"
      >
        <span className={canClose ? 'pr-6' : ''}>{tab.label}</span>
      </TabsTrigger>
      {canClose && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-0.5 top-1/2 h-5 w-5 -translate-y-1/2 p-0 hover:bg-destructive/20 hover:text-destructive"
          onClick={(event: MouseEvent<HTMLButtonElement>) => {
            event.stopPropagation();
            onClose(tab.id);
          }}
          aria-label={`Close ${tab.label}`}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
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
  /** 标签排序回调 */
  onReorder?: (newTabIds: string[]) => void;
}

/**
 * Task tabs bar with closeable tabs and drag-to-reorder using react-dnd
 * @param {TaskTabsBarProps} props - Component properties
 * @return {JSX.Element} Task tabs bar element
 */
export function TaskTabsBar({
  tabs,
  activeId,
  onSelect,
  onClose,
  onAddNew,
  onReorder
}: TaskTabsBarProps): JSX.Element {
  const handleMove = (dragIndex: number, dropIndex: number) => {
    if (!onReorder) {
      return;
    }

    const newTabs = [...tabs];
    const dragItem = newTabs[dragIndex];
    newTabs.splice(dragIndex, 1);
    newTabs.splice(dropIndex, 0, dragItem);

    onReorder(newTabs.map((t) => t.id));
  };

  return (
    <div className="flex items-center gap-2">
      <Tabs
        value={activeId ?? undefined}
        onValueChange={onSelect}
        className="flex-1"
      >
        <TabsList className="inline-flex h-auto w-full justify-start gap-1 rounded-xl border border-border/50 bg-card/60 p-1.5 shadow-sm">
          {tabs.map((tab, index) => (
            <DraggableTabItem
              key={tab.id}
              tab={tab}
              index={index}
              onSelect={onSelect}
              onClose={onClose}
              canClose={tabs.length > 1}
              onMove={handleMove}
            />
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
