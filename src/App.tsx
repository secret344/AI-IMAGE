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

  const tabs = useMemo(() => {
    // Generate better names for blank tasks
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

  const handleAddNewTask = useCallback(() => {
    const newTaskId = `upload-${Date.now()}`;
    setOpenTaskTabs((prev) => [...prev, newTaskId]);
    setCurrentTaskId(newTaskId);
  }, [setCurrentTaskId]);

  const uploadChat = useUploadChat({
    taskId: effectiveTaskId,
    imageName: taskState.selectedFileName || 'untitled',
    agentStyle: agentLocale?.name ?? '通用分析',
    agentPhotographer: agentLocale?.photographer,
    imageBase64: taskState.processedImage?.base64 || '',
    taskSettings
  });

  return (
    <div className="grid min-w-0 w-full h-full items-start gap-4 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)] overflow-hidden">
      {/* Left: History Panel */}
      <div className="min-w-0 h-full overflow-hidden">
        <HistoryPanel />
      </div>

      {/* Right: Task Detail Area with Tab Bar */}
      <div className="min-w-0 h-full flex flex-col gap-3 overflow-hidden">
        <TaskTabsBar
          tabs={tabs}
          activeId={effectiveTaskId}
          onSelect={handleSelectTab}
          onClose={handleCloseTab}
          onAddNew={handleAddNewTask}
        />

        {/* Task Content: Left (Upload + Result + Custom Agents) | Right (Chat) */}
        <div className="grid min-w-0 flex-1 gap-4 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
          {/* Left Column: Upload/Image Preview + Evaluation Results + Custom Agents */}
          <div className="min-w-0 h-full flex flex-col gap-3 overflow-hidden">
            {/* Upload/Preview takes majority of space */}
            <div className="flex-[2] min-h-0 overflow-y-auto">
              <UploadPanel uploadChat={uploadChat} />
            </div>
            {/* Evaluation Results */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              <ResultPanel />
            </div>
            {/* Custom Agents Panel */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              <CustomAgentsPanel />
            </div>
          </div>

          {/* Right Column: Chat Component */}
          <div className="min-w-0 h-full overflow-hidden">
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
