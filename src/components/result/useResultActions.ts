import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/useAppStore';
import { normalizeLanguage } from '@/config/i18n-config';
import { buildMockEvaluation } from '@/modules/ai/mockEvaluation';
import { loadApiKey } from '@/modules/storage/keys';
import { loadProviderSettings } from '@/modules/storage/settings';
import { runEvaluation } from '@/modules/evaluation/runEvaluation';
import { buildXmp } from '@/modules/export/xmp';
import { computeImageHash, findCachedTaskByImageHash, saveTask } from '@/modules/storage/history';
import type { AgentProfile } from '@/config/agents';
import type { AgentRecommendation } from '@/modules/agent/recommendAgents';
import type { ProcessedImage } from '@/modules/upload/processImage';
import type { StyleRecognitionResult } from '@/modules/style/recognizeStyle';
import type { EvaluationResult } from '@/types/evaluation';

interface UseResultActionsArgs {
  evaluation: EvaluationResult | null;
  processedImage: ProcessedImage | null;
  selectedFileName: string | null;
  selectedAgentId: string | null;
  styleResult: StyleRecognitionResult | null;
  agent: AgentProfile | null;
  agentRec: AgentRecommendation | null;
  isOnline: boolean;
  passphrase: string;
  setEvaluation: (value: EvaluationResult | null) => void;
  setIsProcessing: (value: boolean) => void;
  setProcessingStage: (value: string | null) => void;
  setLastLatencyMs: (value: number | null) => void;
  setRunError: (value: string | null) => void;
}

export function useResultActions({
  evaluation,
  processedImage,
  selectedFileName,
  selectedAgentId,
  styleResult,
  agent,
  agentRec,
  isOnline,
  passphrase,
  setEvaluation,
  setIsProcessing,
  setProcessingStage,
  setLastLatencyMs,
  setRunError
}: UseResultActionsArgs) {
  const { t } = useTranslation();
  const skipCache = useAppStore((state) => state.skipCache);
  const setSkipCache = useAppStore((state) => state.setSkipCache);

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
      await saveTask({
        evaluation,
        thumbnailBase64: processedImage.base64,
        selectedAgent: selectedAgentId ?? undefined,
        styleResult: styleResult ?? undefined,
        processedImage: {
          base64: processedImage.base64,
          exif: processedImage.exif,
          dimensions: processedImage.dimensions
        }
      });

      window.dispatchEvent(new Event('history-updated'));
    } catch (error) {
      console.error('Failed to save task:', error);
    }
  }, [evaluation, processedImage, selectedFileName, selectedAgentId, styleResult]);

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
      const settings = loadProviderSettings();
      if (settings.provider === 'mock') {
        setEvaluation(buildMockEvaluation(styleResult, agentRec));
        return;
      }

      const imageHash = await computeImageHash(processedImage.base64);
      if (imageHash && agent && !skipCache) {
        const cached = await findCachedTaskByImageHash(imageHash, agent.id);
        if (cached) {
          console.log('[Cache] Using cached evaluation result');
          setEvaluation(cached.evaluationResult);
          setLastLatencyMs(0);
          return;
        }
      } else if (skipCache) {
        console.log('[Re-evaluation] Bypassing cache for fresh evaluation');
      }

      const loadedKey =
        settings.provider === 'ollama' ? '' : await loadApiKey(settings.keyLabel, passphrase);
      if (!loadedKey && settings.provider !== 'ollama') {
        setRunError(t('result.apiKeyNotFound'));
        return;
      }
      const apiKey = loadedKey ?? '';

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
          language: normalizeLanguage(t('meta.languageCode'))
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
      // Reset skipCache flag after evaluation
      setSkipCache(false);
      // Auto-save to history after successful evaluation
      try {
        await saveTask({
          evaluation: result,
          thumbnailBase64: processedImage.base64,
          selectedAgent: agent.id,
          styleResult: styleResult ?? undefined,
          processedImage: {
            base64: processedImage.base64,
            exif: processedImage.exif,
            dimensions: processedImage.dimensions
          }
        });

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
