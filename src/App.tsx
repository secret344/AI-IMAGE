import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Layout } from '@/components/Layout';
import { UploadPanel } from '@/components/UploadPanel';
import { ResultPanel } from '@/components/ResultPanel';
import { HistoryPanel } from '@/components/HistoryPanel';
import { CustomAgentsPanel } from '@/components/CustomAgentsPanel';
import { TaskTabsBar } from '@/components/layout/TaskTabsBar';
import { TaskProvider } from '@/state/TaskContext';
import { useTaskContext } from '@/state/TaskContext';
import { useUploadChat } from '@/hooks/useUploadChat';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useAgentLocale } from '@/hooks/useAgentLocale';
import { useTaskInitialization } from '@/hooks/useTaskInitialization';
import { useTaskTabs } from '@/hooks/useTaskTabs';
import { UploadChatWrapper } from '@/components/upload/UploadChatWrapper';

function AppContent() {
  // Initialize network status tracking
  useNetworkStatus();

  // Get task context
  const { currentTaskId, setCurrentTaskId, taskSettings, taskState } = useTaskContext();
  const { t } = useTranslation();

  // Generate local task ID once
  const [localTaskId] = useState<string>(() => `upload-${Date.now()}`);
  const effectiveTaskId = currentTaskId ?? localTaskId;

  // Initialize task if needed
  const { isHydrated, hasHistory } = useTaskContext();
  useTaskInitialization({
    isHydrated,
    hasHistory,
    currentTaskId,
    localTaskId,
    onInitialize: setCurrentTaskId
  });

  // Get agent locale for current selection
  const agentLocale = useAgentLocale(taskState.selectedAgentId);

  // Manage task tabs
  const { tabs, handleSelectTab, handleCloseTab, handleAddNewTask, handleAddExistingTask, handleReorderTabs, removeTabsByImageHash } = useTaskTabs({
    effectiveTaskId,
    onTaskChange: setCurrentTaskId
  });

  // Initialize upload chat
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
      {/* Left: History Panel + Custom Agents (Global Settings) */}
      <div className="min-w-0 h-full flex flex-col gap-3 overflow-hidden">
        {/* History Panel */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <HistoryPanel onOpenTask={handleAddExistingTask} />
        </div>
        {/* Custom Agents Panel - Global Settings */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <CustomAgentsPanel />
        </div>
      </div>

      {/* Right: Task Detail Area with Tab Bar */}
      <div className="min-w-0 h-full flex flex-col gap-3 overflow-hidden">
        <TaskTabsBar
          tabs={tabs}
          activeId={effectiveTaskId}
          onSelect={handleSelectTab}
          onClose={handleCloseTab}
          onAddNew={handleAddNewTask}
          onReorder={handleReorderTabs}
        />

        {/* Task Content: Left (Upload + Result) | Right (Chat) */}
        <div className="grid min-w-0 flex-1 gap-4 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
          {/* Left Column: Upload/Image Preview + Evaluation Results */}
          <div className="min-w-0 h-full flex flex-col gap-3 overflow-hidden">
            {/* Upload/Preview takes majority of space */}
            <div className="flex-[2] min-h-0 overflow-y-auto">
              <UploadPanel 
                uploadChat={uploadChat} 
                onCreateNewTask={handleAddNewTask}
                onRemoveTabsByImageHash={removeTabsByImageHash}
              />
            </div>
            {/* Evaluation Results */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              <ResultPanel />
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
      <DndProvider backend={HTML5Backend}>
        <TaskProvider>
          <AppContent />
        </TaskProvider>
      </DndProvider>
    </Layout>
  );
}
