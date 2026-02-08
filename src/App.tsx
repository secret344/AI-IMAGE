import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Layout } from '@/components/Layout';
import { UploadPanel } from '@/components/UploadPanel';
import { ResultPanel } from '@/components/ResultPanel';
import { HistoryPanel } from '@/components/HistoryPanel';
import { CustomAgentsPanel } from '@/components/CustomAgentsPanel';
import { useAppStore } from '@/state/useAppStore';
import { TaskProvider } from '@/state/TaskContext';
import { useTaskContext } from '@/state/TaskContext';
import { useUploadChat } from '@/hooks/useUploadChat';
import { UploadChatWrapper } from '@/components/upload/UploadChatWrapper';
import { getAgentById } from '@/modules/agent/recommendAgents';
import { resolveAgentLocale } from '@/config/agents';

function AppContent() {
  const { setIsOnline } = useAppStore();
  const { currentTaskId, setCurrentTaskId, taskSettings, taskState, isHydrated, hasHistory } =
    useTaskContext();
  const [localTaskId] = useState<string>(() => `upload-${Date.now()}`);
  const effectiveTaskId = currentTaskId ?? localTaskId;
  const { i18n } = useTranslation();

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

  const uploadChat = useUploadChat({
    taskId: effectiveTaskId,
    imageName: taskState.selectedFileName || 'untitled',
    agentStyle: agentLocale?.name ?? '通用分析',
    agentPhotographer: agentLocale?.photographer,
    imageBase64: taskState.processedImage?.base64 || '',
    taskSettings
  });

  return (
    <div className="grid min-w-0 w-full items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,360px)]">
      <div className="min-w-0 space-y-6">
        <UploadPanel uploadChat={uploadChat} />
        <HistoryPanel />
        <CustomAgentsPanel />
      </div>
      <div className="min-w-0 lg:sticky lg:top-0 lg:h-[calc(100vh-3rem)] lg:overflow-hidden">
        <ResultPanel />
      </div>
      <div className="min-w-0 lg:sticky lg:top-0 lg:h-[calc(100vh-3rem)] lg:overflow-hidden">
        {taskState.processedImage && (
          <UploadChatWrapper
            chatState={uploadChat}
            imageName={taskState.selectedFileName || 'untitled'}
            disabled={!taskState.processedImage}
          />
        )}
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
