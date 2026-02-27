import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { UploadPanel } from '@image-studio/components/UploadPanel';
import { ResultPanel } from '@image-studio/components/ResultPanel';
import { HistoryPanel } from '@image-studio/components/HistoryPanel';
import { CustomAgentsPanel } from '@image-studio/components/CustomAgentsPanel';
import { TaskTabsBar } from '@image-studio/components/layout/TaskTabsBar';
import { TaskProvider } from '@image-studio/state/TaskContext';
import { useTaskContext } from '@image-studio/state/TaskContext';
import { useUploadChat } from '@image-studio/hooks/useUploadChat';
import { useNetworkStatus } from '@image-studio/hooks/useNetworkStatus';
import { useAgentLocale } from '@image-studio/hooks/useAgentLocale';
import { useTaskInitialization } from '@image-studio/hooks/useTaskInitialization';
import { useTaskTabs } from '@image-studio/hooks/useTaskTabs';
import { UploadChatWrapper } from '@image-studio/components/upload/UploadChatWrapper';

function ImageStudioContent() {
  useNetworkStatus();

  const { currentTaskId, setCurrentTaskId, taskSettings, taskState } = useTaskContext();
  const { t } = useTranslation();
  const [localTaskId] = useState<string>(() => `upload-${Date.now()}`);
  const effectiveTaskId = currentTaskId ?? localTaskId;

  const { isHydrated, hasHistory } = useTaskContext();
  useTaskInitialization({
    isHydrated,
    hasHistory,
    currentTaskId,
    localTaskId,
    onInitialize: setCurrentTaskId
  });

  const agentLocale = useAgentLocale(taskState.selectedAgentId);

  const {
    tabs,
    handleSelectTab,
    handleCloseTab,
    handleAddNewTask,
    handleAddExistingTask,
    handleReorderTabs,
    removeTabsByImageHash
  } = useTaskTabs({
    effectiveTaskId,
    onTaskChange: setCurrentTaskId
  });

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
      <div className="min-w-0 h-full flex flex-col gap-3 overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto">
          <HistoryPanel onOpenTask={handleAddExistingTask} />
        </div>
        <div className="min-h-0 max-h-[200px] overflow-y-auto">
          <CustomAgentsPanel />
        </div>
      </div>

      <div className="min-w-0 h-full flex flex-col gap-3 overflow-hidden">
        <TaskTabsBar
          tabs={tabs}
          activeId={effectiveTaskId}
          onSelect={handleSelectTab}
          onClose={handleCloseTab}
          onAddNew={handleAddNewTask}
          onReorder={handleReorderTabs}
        />

        <div className="grid min-w-0 flex-1 gap-4 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
          <div className="min-w-0 h-full flex flex-col gap-3 overflow-hidden">
            <div className="flex-[2] min-h-0 overflow-y-auto">
              <UploadPanel
                uploadChat={uploadChat}
                onCreateNewTask={handleAddNewTask}
                onOpenExistingTask={handleAddExistingTask}
                onRemoveTabsByImageHash={removeTabsByImageHash}
              />
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <ResultPanel />
            </div>
          </div>

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

export function ImageStudioApp() {
  return (
    <DndProvider backend={HTML5Backend}>
      <TaskProvider>
        <ImageStudioContent />
      </TaskProvider>
    </DndProvider>
  );
}
