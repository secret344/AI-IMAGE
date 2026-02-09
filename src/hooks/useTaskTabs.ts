import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

const OPEN_TABS_STORAGE_KEY = 'ai-image:open-task-tabs';

/**
 * Manages tab state for multi-task workflow
 * Handles: tab creation/deletion, task summaries loading, tab label generation
 * Persists and restores open tabs from localStorage
 */
export function useTaskTabs(options: UseTaskTabsOptions) {
  const { effectiveTaskId, onTaskChange } = options;
  const { t } = useTranslation();
  const [taskSummaries, setTaskSummaries] = useState<Record<string, TaskRecord>>({});
  const hasInitializedRef = useRef(false);

  // Initialize openTaskTabs from localStorage or fallback to effectiveTaskId
  const [openTaskTabs, setOpenTaskTabs] = useState<string[]>(() => {
    if (hasInitializedRef.current) {
      return [effectiveTaskId];
    }

    try {
      const stored = localStorage.getItem(OPEN_TABS_STORAGE_KEY);
      if (stored) {
        const parsed: string[] = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          hasInitializedRef.current = true;
          return parsed;
        }
      }
    } catch {
      // Silently fail on parse error
    }

    // Fallback: use effectiveTaskId
    hasInitializedRef.current = true;
    return [effectiveTaskId];
  });

  // Persist openTaskTabs to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(OPEN_TABS_STORAGE_KEY, JSON.stringify(openTaskTabs));
    } catch {
      // Silently fail on storage error
    }
  }, [openTaskTabs]);

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

  // Ensure effectiveTaskId is in openTaskTabs
  // If all tabs were closed and now there's a new task, add it
  useEffect(() => {
    if (!effectiveTaskId) {
      return;
    }
    setOpenTaskTabs((prev) => {
      if (prev.includes(effectiveTaskId)) {
        return prev;
      }
      // Don't add default task if there are other tabs open
      // Only add if this is the first time or all tabs were closed
      return prev.length === 0 ? [effectiveTaskId] : prev;
    });
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
          // All tabs about to close, create a new default task as fallback
          const newDefaultTaskId = `upload-${Date.now()}`;
          onTaskChange(newDefaultTaskId);
          return [newDefaultTaskId];
        }

        const next = prev.filter((id) => id !== taskId);
        if (taskId === effectiveTaskId && next.length > 0) {
          // Current tab closed, switch to last tab in list
          const fallback = next[next.length - 1];
          onTaskChange(fallback);
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
