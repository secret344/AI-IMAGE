import { useEffect } from 'react';

interface UseTaskInitializationOptions {
  isHydrated: boolean;
  hasHistory: boolean;
  currentTaskId: string | null;
  localTaskId: string;
  onInitialize: (taskId: string) => void;
}

/**
 * Handles initial task setup when app hydrates
 * Ensures a task is selected based on hydration state and history
 */
export function useTaskInitialization(options: UseTaskInitializationOptions) {
  const { isHydrated, hasHistory, currentTaskId, localTaskId, onInitialize } = options;

  useEffect(() => {
    if (!isHydrated || hasHistory) {
      return;
    }
    if (!currentTaskId) {
      onInitialize(localTaskId);
    }
  }, [currentTaskId, hasHistory, isHydrated, localTaskId, onInitialize]);
}
