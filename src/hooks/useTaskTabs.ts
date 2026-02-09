import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listTasks } from '@/modules/storage/history';
import type { TaskRecord } from '@/modules/storage/db';

interface UseTaskTabsOptions {
  effectiveTaskId: string;
  onTaskChange: (taskId: string) => void;
}

export interface TaskTabItem {
  id: string;
  label: string;
}

/**
 * Manages tab state for multi-task workflow
 * Handles: tab creation/deletion, task summaries loading, tab label generation
 */
export function useTaskTabs(options: UseTaskTabsOptions) {
  const { effectiveTaskId, onTaskChange } = options;
  const { t } = useTranslation();
  const [openTaskTabs, setOpenTaskTabs] = useState<string[]>(() => [effectiveTaskId]);
  const [taskSummaries, setTaskSummaries] = useState<Record<string, TaskRecord>>({});

  // Load task summaries from IndexedDB
  const loadTaskSummaries = useCallback(async () => {
    const tasks = await listTasks();
    const next = tasks.reduce<Record<string, TaskRecord>>((acc, task) => {
      acc[task.taskId] = task;
      return acc;
    }, {});
    setTaskSummaries(next);
  }, []);

  // Auto-load task summaries on mount and subscribe to history updates
  useEffect(() => {
    void loadTaskSummaries();
    const handler = () => void loadTaskSummaries();
    window.addEventListener('history-updated', handler);
    return () => window.removeEventListener('history-updated', handler);
  }, [loadTaskSummaries]);

  // Auto-add tab when effectiveTaskId changes
  useEffect(() => {
    if (!effectiveTaskId) {
      return;
    }
    setOpenTaskTabs((prev) =>
      prev.includes(effectiveTaskId) ? prev : [...prev, effectiveTaskId]
    );
  }, [effectiveTaskId]);

  // Generate tab display items with labels
  const tabs = useMemo(() => {
    const untitledTasks: string[] = [];
    return openTaskTabs.map((taskId) => {
      const fileName = taskSummaries[taskId]?.fileName;
      if (fileName) {
        return { id: taskId, label: fileName };
      }
      // Tasks without file names: generate sequence numbers
      untitledTasks.push(taskId);
      const index = untitledTasks.length;
      return {
        id: taskId,
        label: index === 1 ? t('history.untitled') : `${t('history.untitled')} ${index}`
      };
    });
  }, [openTaskTabs, taskSummaries, t]);

  // Handle tab selection
  const handleSelectTab = useCallback(
    (taskId: string) => {
      if (taskId === effectiveTaskId) {
        return;
      }
      onTaskChange(taskId);
    },
    [effectiveTaskId, onTaskChange]
  );

  // Handle tab closure
  const handleCloseTab = useCallback(
    (taskId: string) => {
      setOpenTaskTabs((prev) => {
        if (prev.length <= 1) {
          return prev;
        }
        const next = prev.filter((id) => id !== taskId);
        if (taskId === effectiveTaskId) {
          const fallback = next[next.length - 1];
          if (fallback) {
            onTaskChange(fallback);
          }
        }
        return next;
      });
    },
    [effectiveTaskId, onTaskChange]
  );

  // Handle new task creation
  const handleAddNewTask = useCallback(() => {
    const newTaskId = `upload-${Date.now()}`;
    setOpenTaskTabs((prev) => [...prev, newTaskId]);
    onTaskChange(newTaskId);
  }, [onTaskChange]);

  return {
    tabs,
    handleSelectTab,
    handleCloseTab,
    handleAddNewTask
  };
}
