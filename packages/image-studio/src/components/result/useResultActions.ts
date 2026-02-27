import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useTaskContext } from '@/state/TaskContext';
import { normalizeLanguage } from '@/config/i18n-config';
import { buildMockEvaluation } from '@/modules/ai/mockEvaluation';
import { loadApiKey } from '@/modules/storage/keys';
import { loadProviderSettings } from '@/modules/storage/settings';
import { runEvaluation } from '@/modules/evaluation/runEvaluation';
import { buildXmp } from '@/modules/export/xmp';
import { limitConversationMessages } from '@/modules/ai/limitConversationMessages';
import {
  computeImageHash,
  findCachedTaskByImageHash,
  saveTaskDetail,
  saveTaskSummary,
  updateTaskSummary
} from '@/modules/storage/history';
import type { AgentProfile } from '@/config/agents';
import type { AgentRecommendation } from '@/modules/agent/recommendAgents';
import type { ProcessedImage } from '@/modules/upload/processImage';
import type { StyleRecognitionResult } from '@/modules/style/recognizeStyle';
import type { EvaluationResult } from '@/types/evaluation';
import type { ProviderSettings } from '@/modules/storage/settings';

interface UseResultActionsArgs {
  evaluation: EvaluationResult | null;
  processedImage: ProcessedImage | null;
  selectedAgentId: string | null;
  styleResult: StyleRecognitionResult | null;
  agent: AgentProfile | null;
  agentRec: AgentRecommendation | null;
  isOnline: boolean;
  passphrase: string;
  taskSettings: ProviderSettings | null;
  setEvaluation: (value: EvaluationResult | null) => void;
  setIsProcessing: (value: boolean) => void;
  setProcessingStage: (value: string | null) => void;
  setLastLatencyMs: (value: number | null) => void;
  setRunError: (value: string | null) => void;
}

export function useResultActions({
  evaluation,
  processedImage,
  selectedAgentId,
  styleResult,
  agent,
  agentRec,
  isOnline,
  passphrase,
  taskSettings,
  setEvaluation,
  setIsProcessing,
  setProcessingStage,
  setLastLatencyMs,
  setRunError
}: UseResultActionsArgs) {
  const { t } = useTranslation();
  const { currentTaskId, skipCache, setSkipCache, taskState } = useTaskContext();

  const handleDownloadXmp = useCallback(() => {
    if (!evaluation) {
      return;
    }
    const content = buildXmp(evaluation.retouchPlan);
    const blob = new Blob([content], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'ai-image.xmp';
    anchor.click();
    URL.revokeObjectURL(url);
  }, [evaluation]);

  const handleSaveHistory = useCallback(async () => {
    if (!evaluation || !processedImage) {
      return;
    }
    try {
      if (currentTaskId) {
        await updateTaskSummary(currentTaskId, {
          selectedAgent: selectedAgentId ?? undefined,
          styleTags: styleResult?.styleTags ?? []
        });
        await saveTaskDetail(currentTaskId, {
          evaluationResult: evaluation,
          taskSettings: taskSettings ?? undefined,
          processedImage: {
            base64: processedImage.base64,
            processedBlob: processedImage.processedBlob,
            exif: processedImage.exif,
            dimensions: processedImage.dimensions
          }
        });
      } else {
        const summary = await saveTaskSummary({
          thumbnailBase64: processedImage.base64,
          selectedAgent: selectedAgentId ?? undefined,
          styleResult: styleResult ?? undefined,
          processedImage: {
            base64: processedImage.base64,
            processedBlob: processedImage.processedBlob,
            exif: processedImage.exif,
            dimensions: processedImage.dimensions
          }
        });
        await saveTaskDetail(summary.taskId, {
          evaluationResult: evaluation,
          taskSettings: taskSettings ?? undefined,
          processedImage: {
            base64: processedImage.base64,
            processedBlob: processedImage.processedBlob,
            exif: processedImage.exif,
            dimensions: processedImage.dimensions
          }
        });
      }

      window.dispatchEvent(new Event('history-updated'));
    } catch (error) {
      console.error('Failed to save task:', error);
    }
  }, [currentTaskId, evaluation, processedImage, selectedAgentId, styleResult, taskSettings]);

  const handleRun = useCallback(async () => {
    if (!agent || !styleResult || !processedImage) {
      setRunError(t('result.uploadFirst'));
      return;
    }

    if (!isOnline) {
      setRunError(t('result.offlineError'));
      return;
    }

    setRunError(null);
    setIsProcessing(true);
    setProcessingStage(t('common.loading'));

    try {
      const settings = taskSettings ?? loadProviderSettings();
      if (settings.provider === 'mock') {
        setEvaluation(buildMockEvaluation(styleResult, agentRec));
        return;
      }

      const imageHash = await computeImageHash(processedImage.base64);

      if (skipCache) {
        console.log('[Re-evaluation] Bypassing cache - forcing fresh evaluation');
      } else if (imageHash && agent) {
        const cached = await findCachedTaskByImageHash(imageHash, agent.id);
        if (cached?.evaluationResult) {
          console.log('[Cache] Using cached evaluation result');
          setEvaluation(cached.evaluationResult);
          setLastLatencyMs(0);
          return;
        }
      }

      const loadedKey =
        settings.provider === 'ollama' ? '' : await loadApiKey(settings.keyLabel, passphrase);
      const apiKey = loadedKey ?? '';

      // Get conversation history from context (no direct DB access)
      const conversationHistory = limitConversationMessages(
        taskState.chatMessages ?? [],
        settings.contextMaxChars
      );
      console.log(
        '[Evaluation] Using conversation history from context:',
        conversationHistory.length,
        'messages'
      );

      const start = performance.now();
      const attempt = async (model: string) =>
        runEvaluation({
          processedImage,
          styleResult,
          agent,
          apiKey,
          provider: settings.provider,
          model,
          baseUrl: settings.baseUrl,
          temperature: settings.temperature,
          maxTokens: settings.maxTokens,
          timeoutMs: settings.timeoutMs,
          language: normalizeLanguage(t('meta.languageCode')),
          conversationHistory,
          contextMaxChars: settings.contextMaxChars
        });

      let result;
      try {
        result = await attempt(settings.model);
      } catch (error) {
        if (settings.fallbackModel) {
          result = await attempt(settings.fallbackModel);
        } else {
          throw error;
        }
      }
      setLastLatencyMs(Math.round(performance.now() - start));
      setEvaluation(result);

      // Reset skipCache flag after successful evaluation
      if (skipCache) {
        console.log('[Re-evaluation] Fresh evaluation completed, resetting cache flag');
        setSkipCache(false);
      }
      // Auto-save to history after successful evaluation
      try {
        if (currentTaskId) {
          await updateTaskSummary(currentTaskId, {
            selectedAgent: agent.id,
            styleTags: styleResult?.styleTags ?? []
          });
          await saveTaskDetail(currentTaskId, {
            evaluationResult: result,
            taskSettings: taskSettings ?? undefined,
            processedImage: {
              base64: processedImage.base64,
              processedBlob: processedImage.processedBlob,
              exif: processedImage.exif,
              dimensions: processedImage.dimensions
            }
          });
        } else {
          const summary = await saveTaskSummary({
            thumbnailBase64: processedImage.base64,
            selectedAgent: agent.id,
            styleResult: styleResult ?? undefined,
            processedImage: {
              base64: processedImage.base64,
              processedBlob: processedImage.processedBlob,
              exif: processedImage.exif,
              dimensions: processedImage.dimensions
            }
          });
          await saveTaskDetail(summary.taskId, {
            evaluationResult: result,
            taskSettings: taskSettings ?? undefined,
            processedImage: {
              base64: processedImage.base64,
              processedBlob: processedImage.processedBlob,
              exif: processedImage.exif,
              dimensions: processedImage.dimensions
            }
          });
        }

        window.dispatchEvent(new Event('history-updated'));
      } catch (saveError) {
        console.error('Failed to auto-save to history:', saveError);
      }
    } catch (err) {
      setSkipCache(false);
      const message = err instanceof Error ? err.message : t('result.evaluationFailed');
      if (message.includes('429') || message.toLowerCase().includes('rate')) {
        setRunError(t('result.rateLimited'));
      } else {
        setRunError(message);
      }
    } finally {
      setProcessingStage(null);
      setIsProcessing(false);
      setSkipCache(false);
    }
  }, [
    agent,
    agentRec,
    isOnline,
    passphrase,
    processedImage,
    setEvaluation,
    setIsProcessing,
    setLastLatencyMs,
    setProcessingStage,
    setRunError,
    setSkipCache,
    skipCache,
    currentTaskId,
    taskState.chatMessages,
    taskSettings,
    styleResult,
    t
  ]);

  const handleRunMock = useCallback(() => {
    if (!styleResult) {
      return;
    }
    setEvaluation(buildMockEvaluation(styleResult, agentRec));
  }, [agentRec, setEvaluation, styleResult]);

  return {
    handleDownloadXmp,
    handleSaveHistory,
    handleRun,
    handleRunMock
  };
}
