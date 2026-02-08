import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import type { ReactNode } from 'react';
import type { ProviderSettings } from '@/modules/storage/settings';
import { getDefaultProviderSettings } from '@/modules/storage/settings';
import { useAppStore } from '@/state/useAppStore';
import {
  getTaskById,
  getTaskSettings,
  listTasks,
  updateTaskSettings
} from '@/modules/storage/history';
import {
  addMessageToMainThread,
  clearConversations,
  getMainThreadMessages,
  replaceMainThreadMessages
} from '@/modules/storage/conversation';
import type { ProcessedImage } from '@/modules/upload/processImage';
import type { StyleRecognitionResult } from '@/modules/style/recognizeStyle';
import type { AgentRecommendation } from '@/modules/agent/recommendAgents';
import type { EvaluationResult } from '@/types/evaluation';
import type { TaskRecord } from '@/modules/storage/db';
import type { ChatMessage } from '@/types/conversation';

/**
 * 单个任务的完整状态
 * 包含上传、风格识别、推荐、评估和聊天的各个阶段数据
 */
export interface TaskState {
  selectedFileName: string | null;
  processedImage: ProcessedImage | null;
  previewImageBase64: string | null;
  styleResult: StyleRecognitionResult | null;
  recommendedAgents: AgentRecommendation[];
  selectedAgentId: string | null;
  isProcessing: boolean;
  processingStage: string | null;
  lastLatencyMs: number | null;
  evaluation: EvaluationResult | null;
  chatMessages: ChatMessage[];
}

const DEFAULT_TASK_STATE: TaskState = {
  selectedFileName: null,
  processedImage: null,
  previewImageBase64: null,
  styleResult: null,
  recommendedAgents: [],
  selectedAgentId: null,
  isProcessing: false,
  processingStage: null,
  lastLatencyMs: null,
  evaluation: null,
  chatMessages: []
};

/**
 * TaskContext 的值类型
 * 提供任务状态访问、更新方法和全局设置
 */
interface TaskContextValue {
  currentTaskId: string | null;
  setCurrentTaskId: (taskId: string | null) => void;
  globalProviderSettings: ProviderSettings;
  taskState: TaskState;
  setTaskState: (partial: Partial<TaskState>) => void;
  setTaskStateForTask: (taskId: string, partial: Partial<TaskState>) => void;
  taskSettings: ProviderSettings | null;
  setTaskSettings: (settings: ProviderSettings) => void;
  setTaskSettingsForTask: (taskId: string, settings: ProviderSettings) => void;
  taskSettingsDraft: ProviderSettings | null;
  setTaskSettingsDraft: (settings: ProviderSettings) => void;
  addChatMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => Promise<ChatMessage>;
  setChatMessages: (messages: ChatMessage[]) => Promise<void>;
  clearChatMessages: () => Promise<void>;
  setTaskSettingsDraftForTask: (taskId: string, settings: ProviderSettings) => void;
  isHydrated: boolean;
  hasHistory: boolean;
  skipCache: boolean;
  setSkipCache: (value: boolean) => void;
  setSkipCacheForTask: (taskId: string, value: boolean) => void;
  setResetEvaluationForTask: (taskId: string, value: boolean) => void;
}

const TaskContext = createContext<TaskContextValue | null>(null);

export function TaskProvider({ children }: { children: ReactNode }) {
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [taskStateMap, setTaskStateMap] = useState<Map<string, TaskState>>(
    new Map<string, TaskState>()
  );
  const taskStateMapRef = useRef<Map<string, TaskState>>(new Map<string, TaskState>());
  const globalProviderSettings =
    useAppStore((state) => state.globalProviderSettings) ?? getDefaultProviderSettings();
  const [taskSettingsMap, setTaskSettingsMap] = useState<Map<string, ProviderSettings>>(
    new Map<string, ProviderSettings>()
  );
  const [taskSettingsDraftMap, setTaskSettingsDraftMap] = useState<Map<string, ProviderSettings>>(
    new Map<string, ProviderSettings>()
  );
  const [skipCacheMap, setSkipCacheMap] = useState<Map<string, boolean>>(
    new Map<string, boolean>()
  );
  const skipCacheMapRef = useRef<Map<string, boolean>>(new Map<string, boolean>());
  const [, setResetEvaluationMap] = useState<Map<string, boolean>>(new Map<string, boolean>());
  const resetEvaluationMapRef = useRef<Map<string, boolean>>(new Map<string, boolean>());
  const [isHydrated, setIsHydrated] = useState(false);
  const [hasHistory, setHasHistory] = useState(false);

  const ensureTaskState = useCallback((taskId: string) => {
    setTaskStateMap((prev) => {
      if (prev.has(taskId)) {
        return prev;
      }
      const next = new Map(prev);
      next.set(taskId, { ...DEFAULT_TASK_STATE });
      taskStateMapRef.current = next;
      return next;
    });
  }, []);

  const setTaskStateForTask = useCallback((taskId: string, partial: Partial<TaskState>) => {
    setTaskStateMap((prev) => {
      const next = new Map(prev);
      const existing = next.get(taskId) ?? { ...DEFAULT_TASK_STATE };
      next.set(taskId, { ...existing, ...partial });
      taskStateMapRef.current = next;
      return next;
    });
  }, []);

  const hydrateTaskFromRecord = useCallback(
    async (taskId: string, record: TaskRecord | undefined, chatMessages: ChatMessage[]) => {
      if (!record) {
        setTaskStateForTask(taskId, {
          chatMessages
        });
        return;
      }

      const styleResult: StyleRecognitionResult | null = record.styleTags?.length
        ? ({
            styleTags: record.styleTags as StyleRecognitionResult['styleTags'],
            styleDescription: '',
            inferenceTime: 0,
            modelUsed: 'history-recovery'
          } satisfies StyleRecognitionResult)
        : null;

      const previewBase64 = record.processedImage?.base64 ?? null;
      const hydratedImage: ProcessedImage | null = record.processedImage
        ? {
            originalName: record.fileName ?? 'cached-image',
            processedBlob: new Blob([], { type: 'image/jpeg' }),
            base64: record.processedImage.base64,
            exif: record.processedImage.exif,
            dimensions: record.processedImage.dimensions
          }
        : null;

      const shouldClearEvaluation = resetEvaluationMapRef.current.get(taskId) ?? false;

      setTaskStateForTask(taskId, {
        evaluation: shouldClearEvaluation ? null : (record.evaluationResult ?? null),
        selectedAgentId: record.selectedAgent ?? null,
        styleResult,
        selectedFileName: record.fileName ?? null,
        previewImageBase64: previewBase64,
        processedImage: hydratedImage,
        recommendedAgents: [],
        isProcessing: false,
        processingStage: null,
        lastLatencyMs: null,
        chatMessages
      });

      // Clear the resetEvaluation flag after applying it
      if (shouldClearEvaluation) {
        setResetEvaluationMap((prev) => {
          const next = new Map(prev);
          next.delete(taskId);
          resetEvaluationMapRef.current = next;
          return next;
        });
      }
    },
    [setTaskStateForTask]
  );

  const setTaskSettingsForTask = useCallback((taskId: string, settings: ProviderSettings) => {
    setTaskSettingsMap((prev) => {
      const next = new Map(prev);
      next.set(taskId, settings);
      return next;
    });
    setTaskSettingsDraftMap((prev) => {
      const next = new Map(prev);
      next.set(taskId, settings);
      return next;
    });
    void updateTaskSettings(taskId, settings);
  }, []);

  const setTaskSettingsDraftForTask = useCallback((taskId: string, settings: ProviderSettings) => {
    setTaskSettingsDraftMap((prev) => {
      const next = new Map(prev);
      next.set(taskId, settings);
      return next;
    });
  }, []);

  const setTaskState = useCallback(
    (partial: Partial<TaskState>) => {
      if (!currentTaskId) {
        return;
      }
      setTaskStateForTask(currentTaskId, partial);
    },
    [currentTaskId, setTaskStateForTask]
  );

  const safeSetCurrentTaskId = useCallback(
    (taskId: string | null) => {
      setCurrentTaskId(taskId);
      if (taskId) {
        ensureTaskState(taskId);
        void (async () => {
          const [chatMessages, record] = await Promise.all([
            getMainThreadMessages(taskId),
            getTaskById(taskId)
          ]);

          setTaskStateForTask(taskId, { chatMessages });

          const settings = record?.taskSettings ?? (await getTaskSettings(taskId));
          if (!settings) {
            setTaskSettingsDraftMap((prev) => {
              if (prev.has(taskId)) {
                return prev;
              }
              const next = new Map(prev);
              const fallback = taskSettingsMap.get(taskId) ?? globalProviderSettings;
              next.set(taskId, fallback);
              return next;
            });
          } else {
            setTaskSettingsMap((prev) => {
              const next = new Map(prev);
              next.set(taskId, settings);
              return next;
            });
            setTaskSettingsDraftMap((prev) => {
              const next = new Map(prev);
              next.set(taskId, settings);
              return next;
            });
          }

          await hydrateTaskFromRecord(taskId, record, chatMessages);
        })();
      }
    },
    [
      ensureTaskState,
      globalProviderSettings,
      hydrateTaskFromRecord,
      setTaskStateForTask,
      taskSettingsMap
    ]
  );

  const taskState = useMemo(() => {
    if (!currentTaskId) {
      return DEFAULT_TASK_STATE;
    }
    return taskStateMap.get(currentTaskId) ?? DEFAULT_TASK_STATE;
  }, [currentTaskId, taskStateMap]);

  const taskSettings = useMemo(() => {
    if (!currentTaskId) {
      return globalProviderSettings;
    }
    return taskSettingsMap.get(currentTaskId) ?? globalProviderSettings;
  }, [currentTaskId, taskSettingsMap, globalProviderSettings]);

  const taskSettingsDraft = useMemo(() => {
    if (!currentTaskId) {
      return taskSettings ?? globalProviderSettings;
    }
    return (
      taskSettingsDraftMap.get(currentTaskId) ??
      taskSettingsMap.get(currentTaskId) ??
      globalProviderSettings
    );
  }, [currentTaskId, taskSettings, taskSettingsDraftMap, taskSettingsMap, globalProviderSettings]);

  const skipCache = useMemo(() => {
    if (!currentTaskId) {
      return false;
    }
    return skipCacheMap.get(currentTaskId) ?? false;
  }, [currentTaskId, skipCacheMap]);

  const setTaskSettings = useCallback(
    (settings: ProviderSettings) => {
      if (!currentTaskId) {
        return;
      }
      setTaskSettingsForTask(currentTaskId, settings);
    },
    [currentTaskId, setTaskSettingsForTask]
  );

  const setTaskSettingsDraft = useCallback(
    (settings: ProviderSettings) => {
      if (!currentTaskId) {
        return;
      }
      setTaskSettingsDraftForTask(currentTaskId, settings);
    },
    [currentTaskId, setTaskSettingsDraftForTask]
  );

  const setSkipCache = useCallback(
    (value: boolean) => {
      if (!currentTaskId) {
        return;
      }
      setSkipCacheMap((prev) => {
        const next = new Map(prev);
        next.set(currentTaskId, value);
        skipCacheMapRef.current = next;
        return next;
      });
    },
    [currentTaskId]
  );

  const setSkipCacheForTask = useCallback((taskId: string, value: boolean) => {
    setSkipCacheMap((prev) => {
      const next = new Map(prev);
      next.set(taskId, value);
      skipCacheMapRef.current = next;
      return next;
    });
  }, []);

  const setResetEvaluationForTask = useCallback((taskId: string, value: boolean) => {
    setResetEvaluationMap((prev) => {
      const next = new Map(prev);
      next.set(taskId, value);
      resetEvaluationMapRef.current = next;
      return next;
    });
  }, []);

  const addChatMessage = useCallback(
    async (message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
      if (!currentTaskId) {
        throw new Error('No active task');
      }
      
      // 检查最后一条消息是否重复（相同内容和角色）
      const existing = taskStateMapRef.current.get(currentTaskId) ?? DEFAULT_TASK_STATE;
      const lastMessage = existing.chatMessages?.[existing.chatMessages.length - 1];
      if (
        lastMessage &&
        lastMessage.role === message.role &&
        lastMessage.content.trim() === message.content.trim()
      ) {
        // 重复消息，直接返回现有消息
        return lastMessage;
      }

      // Save to database
      const savedMessage = await addMessageToMainThread(currentTaskId, message);
      
      // Update context state
      setTaskStateForTask(currentTaskId, {
        chatMessages: [...(existing.chatMessages ?? []), savedMessage]
      });
      return savedMessage;
    },
    [currentTaskId, setTaskStateForTask]
  );

  const setChatMessages = useCallback(
    async (messages: ChatMessage[]) => {
      if (!currentTaskId) {
        return;
      }
      await replaceMainThreadMessages(currentTaskId, messages);
      setTaskStateForTask(currentTaskId, {
        chatMessages: messages
      });
    },
    [currentTaskId, setTaskStateForTask]
  );

  const clearChatMessages = useCallback(async () => {
    if (!currentTaskId) {
      return;
    }
    // Clear from database
    await clearConversations(currentTaskId);
    // Update context state
    setTaskStateForTask(currentTaskId, {
      chatMessages: []
    });
  }, [currentTaskId, setTaskStateForTask]);

  useEffect(() => {
    if (currentTaskId) {
      return;
    }
    void (async () => {
      const tasks = await listTasks();
      const latestTaskId = tasks[0]?.taskId ?? null;
      setHasHistory(tasks.length > 0);
      if (latestTaskId) {
        safeSetCurrentTaskId(latestTaskId);
        setIsHydrated(true);
        return;
      }
      setIsHydrated(true);
    })();
  }, [currentTaskId, safeSetCurrentTaskId]);

  const value = useMemo(
    () => ({
      currentTaskId,
      setCurrentTaskId: safeSetCurrentTaskId,
      globalProviderSettings,
      taskState,
      setTaskState,
      setTaskStateForTask,
      setTaskSettingsForTask,
      taskSettings,
      setTaskSettings,
      taskSettingsDraft,
      setTaskSettingsDraft,
      setTaskSettingsDraftForTask,
      isHydrated,
      hasHistory,
      skipCache,
      setSkipCache,
      setSkipCacheForTask,
      setResetEvaluationForTask,
      addChatMessage,
      setChatMessages,
      clearChatMessages
    }),
    [
      currentTaskId,
      safeSetCurrentTaskId,
      globalProviderSettings,
      taskState,
      setTaskState,
      setTaskStateForTask,
      setTaskSettingsForTask,
      taskSettings,
      setTaskSettings,
      taskSettingsDraft,
      setTaskSettingsDraft,
      setTaskSettingsDraftForTask,
      isHydrated,
      hasHistory,
      skipCache,
      setSkipCache,
      setSkipCacheForTask,
      setResetEvaluationForTask,
      addChatMessage,
      setChatMessages,
      clearChatMessages
    ]
  );

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}

export function useTaskContext(): TaskContextValue {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error('useTaskContext must be used within TaskProvider');
  }
  return context;
}
