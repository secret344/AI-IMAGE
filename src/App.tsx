import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Layout } from '@/components/Layout';
import { UploadPanel } from '@/components/UploadPanel';
import { ResultPanel } from '@/components/ResultPanel';
import { HistoryPanel } from '@/components/HistoryPanel';
import { CustomAgentsPanel } from '@/components/CustomAgentsPanel';
import { TaskTabsBar } from '@/components/layout/TaskTabsBar';
import { useAppStore } from '@/state/useAppStore';
import { TaskProvider } from '@/state/TaskContext';
import { useTaskContext } from '@/state/TaskContext';
import { useUploadChat } from '@/hooks/useUploadChat';
import { UploadChatWrapper } from '@/components/upload/UploadChatWrapper';
import { getAgentById } from '@/modules/agent/recommendAgents';
import { resolveAgentLocale } from '@/config/agents';
import { listTasks } from '@/modules/storage/history';
import type { TaskRecord } from '@/modules/storage/db';

function AppContent() {
  const { setIsOnline } = useAppStore();
  const { currentTaskId, setCurrentTaskId, taskSettings, taskState, isHydrated, hasHistory } =
    useTaskContext();
  const [localTaskId] = useState<string>(() => `upload-${Date.now()}`);
  const effectiveTaskId = currentTaskId ?? localTaskId;
  const [openTaskTabs, setOpenTaskTabs] = useState<string[]>(() => [effectiveTaskId]);
  const [taskSummaries, setTaskSummaries] = useState<Record<string, TaskRecord>>({});
  const { i18n, t } = useTranslation();

  const agentLocale = useMemo(() => {
    if (!taskState.selectedAgentId) {
      return null;
    }
    const agent = getAgentById(taskState.selectedAgentId);
    return agent ? resolveAgentLocale(agent, i18n.language) : null;
  }, [i18n.language, taskState.selectedAgentId]);

  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, [setIsOnline]);

  useEffect(() => {
    if (!isHydrated || hasHistory) {
      return;
    }
    if (!currentTaskId) {
      setCurrentTaskId(localTaskId);
    }
  }, [currentTaskId, hasHistory, isHydrated, localTaskId, setCurrentTaskId]);

  const loadTaskSummaries = useCallback(async () => {
    const tasks = await listTasks();
    const next = tasks.reduce<Record<string, TaskRecord>>((acc, task) => {
      acc[task.taskId] = task;
      return acc;
    }, {});
    setTaskSummaries(next);
  }, []);

  useEffect(() => {
    void loadTaskSummaries();
    const handler = () => void loadTaskSummaries();
    window.addEventListener('history-updated', handler);
    return () => window.removeEventListener('history-updated', handler);
  }, [loadTaskSummaries]);

  useEffect(() => {
    if (!effectiveTaskId) {
      return;
    }
    setOpenTaskTabs((prev) =>
      prev.includes(effectiveTaskId) ? prev : [...prev, effectiveTaskId]
    );
  }, [effectiveTaskId]);

  const tabs = useMemo(
    () =>
      openTaskTabs.map((taskId) => ({
        id: taskId,
        label: taskSummaries[taskId]?.fileName ?? t('history.untitled')
      })),
    [openTaskTabs, taskSummaries, t]
  );

  const handleSelectTab = useCallback(
    (taskId: string) => {
      if (taskId === effectiveTaskId) {
        return;
      }
      setCurrentTaskId(taskId);
    },
    [effectiveTaskId, setCurrentTaskId]
  );

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
            setCurrentTaskId(fallback);
          }
        }
        return next;
      });
    },
    [effectiveTaskId, setCurrentTaskId]
  );

  const uploadChat = useUploadChat({
    taskId: effectiveTaskId,
    imageName: taskState.selectedFileName || 'untitled',
    agentStyle: agentLocale?.name ?? '通用分析',
    agentPhotographer: agentLocale?.photographer,
    imageBase64: taskState.processedImage?.base64 || '',
    taskSettings
  });

  return (
    <div className="grid min-w-0 w-full items-start gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-6">
        <HistoryPanel />
      </div>
      <div className="min-w-0 flex flex-col gap-4">
        <TaskTabsBar
          tabs={tabs}
          activeId={effectiveTaskId}
          onSelect={handleSelectTab}
          onClose={handleCloseTab}
        />
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
          <div className="min-w-0 flex flex-col gap-4">
            <UploadPanel uploadChat={uploadChat} />
            <ResultPanel />
            <CustomAgentsPanel />
          </div>
          <div className="min-w-0">
            <UploadChatWrapper
              chatState={uploadChat}
              imageName={taskState.selectedFileName || t('history.untitled')}
              disabled={!taskState.processedImage}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function App() {
  return (
    <Layout>
      <TaskProvider>
        <AppContent />
      </TaskProvider>
    </Layout>
  );
}
