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

const OPEN_TABS_STORAGE_KEY = 'ai-image:open-task-tabs';

/**
 * Manages tab state for multi-task workflow
 * Handles: tab creation/deletion, task summaries loading, tab label generation
 * Persists and restores open tabs from localStorage
 * Falls back to most recent history record if no cached tabs exist
 */
export function useTaskTabs(options: UseTaskTabsOptions) {
  const { effectiveTaskId, onTaskChange } = options;
  const { t } = useTranslation();
  const [taskSummaries, setTaskSummaries] = useState<Record<string, TaskRecord>>({});
  const [openTaskTabs, setOpenTaskTabs] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize openTaskTabs: cached > most recent history > default
  useEffect(() => {
    if (isInitialized) {
      return;
    }

    const initializeTabs = async () => {
      try {
        // Try to load cached tabs first
        const stored = localStorage.getItem(OPEN_TABS_STORAGE_KEY);
        if (stored) {
          const parsed: string[] = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setOpenTaskTabs(parsed);
            // Switch to first cached tab to sync currentTaskId
            onTaskChange(parsed[0]);
            setIsInitialized(true);
            return;
          }
        }
      } catch {
        // Silently fail on parse error
      }

      // No cached tabs, try to load most recent history record
      try {
        const tasks = await listTasks();
        if (tasks.length > 0) {
          const mostRecentTask = tasks[0]; // listTasks returns sorted by most recent first
          setOpenTaskTabs([mostRecentTask.taskId]);
          onTaskChange(mostRecentTask.taskId);
          setIsInitialized(true);
          return;
        }
      } catch {
        // Silently fail on history load error
      }

      // Fallback: use effectiveTaskId as default
      if (effectiveTaskId) {
        setOpenTaskTabs([effectiveTaskId]);
      }
      setIsInitialized(true);
    };

    void initializeTabs();
  }, [isInitialized, effectiveTaskId, onTaskChange]);

  // Persist openTaskTabs to localStorage whenever it changes (after initialization)
  useEffect(() => {
    if (!isInitialized) {
      return;
    }
    try {
      localStorage.setItem(OPEN_TABS_STORAGE_KEY, JSON.stringify(openTaskTabs));
    } catch {
      // Silently fail on storage error
    }
  }, [openTaskTabs, isInitialized]);

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
      // Ensure tab exists, add it if not present
      setOpenTaskTabs((prev) => {
        if (!prev.includes(taskId)) {
          return [...prev, taskId];
        }
        return prev;
      });
      onTaskChange(taskId);
    },
    [effectiveTaskId, onTaskChange]
  );

  // Handle tab closure
  const handleCloseTab = useCallback(
    (taskId: string) => {
      setOpenTaskTabs((prev) => {
        if (prev.length <= 1) {
          // All tabs about to close, create a new unnamed task as fallback
          const newDefaultTaskId = `upload-${Date.now()}`;
          onTaskChange(newDefaultTaskId);
          return [newDefaultTaskId];
        }

        const next = prev.filter((id) => id !== taskId);
        
        // Only switch tab if we're closing the currently active tab
        if (taskId === effectiveTaskId && next.length > 0) {
          // Switch to the last tab in the list
          const fallback = next[next.length - 1];
          onTaskChange(fallback);
        }
        // If closing a non-current tab, keep displaying the current tab (don't change)

        return next;
      });
    },
    [effectiveTaskId, onTaskChange]
  );

  // Handle new task creation - remove old unnamed tab if exists
  const handleAddNewTask = useCallback(() => {
    const newTaskId = `upload-${Date.now()}`;
    setOpenTaskTabs((prev) => {
      // Remove all unnamed tabs (tabs without fileName in taskSummaries or not in taskSummaries)
      const namedTabs = prev.filter((id) => {
        const task = taskSummaries[id];
        return task && task.fileName; // Keep only tabs with fileName
      });
      return [...namedTabs, newTaskId];
    });
    onTaskChange(newTaskId);
  }, [onTaskChange, taskSummaries]);

  return {
    tabs,
    handleSelectTab,
    handleCloseTab,
    handleAddNewTask
  };
}
