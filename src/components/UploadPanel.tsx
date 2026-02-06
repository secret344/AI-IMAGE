import { useCallback, useEffect, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { StyleTagScore } from '@/config/style-tags';
import { useAppStore } from '@/state/useAppStore';
import { processImage } from '@/modules/upload/processImage';
import { recognizeStyle } from '@/modules/style/recognizeStyle';
import { recommendAgents } from '@/modules/agent/recommendAgents';
import { loadProviderSettings } from '@/modules/storage/settings';
import { assertFileSize } from '@/utils/file';
import { UploadDropzone } from '@/components/upload/UploadDropzone';
import { UploadPreview } from '@/components/upload/UploadPreview';
import { StyleTagsSummary } from '@/components/upload/StyleTagsSummary';
import { RecommendedAgentsList } from '@/components/upload/RecommendedAgentsList';

function getUploadErrorMessage(err: unknown, t: ReturnType<typeof useTranslation>['t']) {
  let message = t('upload.uploadFailed');
  if (err instanceof Error) {
    if (err.message.includes('Unsupported format')) {
      message = t('upload.unsupportedFormat');
    } else if (err.message.includes('exceeds')) {
      message = t('upload.fileSizeExceed');
    } else if (err.message.includes('timeout') || err.message.includes('network')) {
      message = t('upload.networkError');
    } else {
      message = err.message;
    }
  }
  return message;
}

export function UploadPanel() {
  const { t, i18n } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [passphrase] = useState('');
  const {
    selectedFileName,
    isProcessing,
    processingStage,
    styleResult,
    recommendedAgents,
    processedImage,
    previewImageBase64,
    setSelectedFileName,
    setProcessedImage,
    setPreviewImageBase64,
    setStyleResult,
    setRecommendedAgents,
    setSelectedAgentId,
    setIsProcessing,
    setProcessingStage,
    setEvaluation
  } = useAppStore();

  const applyRecommendations = useCallback(
    (styleTags: StyleTagScore[]) => {
      const settings = loadProviderSettings();
      const agents = recommendAgents(styleTags, { limit: settings.topAgents });
      setRecommendedAgents(agents);
      setSelectedAgentId(agents[0]?.id ?? null);
    },
    [setRecommendedAgents, setSelectedAgentId]
  );

  const handleFile = useCallback(
    async (file: File) => {
      if (!file) {
        return;
      }

      setError(null);
      setIsProcessing(true);
      setProcessingStage(t('upload.preprocessing'));
      setEvaluation(null);

      try {
        assertFileSize(file, 50);
        const processed = await processImage(file);
        setSelectedFileName(file.name);
        setProcessedImage(processed);
        setPreviewImageBase64(processed.base64);

        setProcessingStage(t('upload.styleRecognition'));
        const userLanguage: 'zh' | 'en' = i18n.language?.toLowerCase().startsWith('zh')
          ? 'zh'
          : 'en';
        const style = await recognizeStyle(processed.base64, userLanguage, passphrase);
        setStyleResult(style);
        setProcessingStage(t('upload.agentRecommendation'));
        applyRecommendations(style.styleTags);
      } catch (err) {
        setError(getUploadErrorMessage(err, t));
      } finally {
        setProcessingStage(null);
        setIsProcessing(false);
      }
    },
    [
      applyRecommendations,
      i18n.language,
      passphrase,
      setEvaluation,
      setIsProcessing,
      setProcessingStage,
      setProcessedImage,
      setPreviewImageBase64,
      setSelectedFileName,
      setStyleResult,
      t
    ]
  );

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }
      await handleFile(file);
    },
    [handleFile]
  );

  useEffect(() => {
    const handler = () => {
      if (!styleResult) {
        return;
      }
      applyRecommendations(styleResult.styleTags);
    };
    window.addEventListener('settings-updated', handler);
    return () => window.removeEventListener('settings-updated', handler);
  }, [applyRecommendations, styleResult]);

  const handleDrop = useCallback(
    async (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);
      const file = event.dataTransfer.files?.[0];
      if (!file) {
        return;
      }
      await handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3 sm:pb-4">
        <CardTitle className="text-lg sm:text-xl">{t('upload.title')}</CardTitle>
        <CardDescription className="text-sm text-muted-foreground/80">
          {t('upload.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <UploadDropzone
          isProcessing={isProcessing}
          processingStage={processingStage}
          isDragging={isDragging}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onFileChange={handleFileChange}
        />
        {selectedFileName && (
          <p className="text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 font-medium">
            ✓ {t('upload.selected')}: {selectedFileName}
          </p>
        )}
        <UploadPreview
          processedImageBase64={processedImage?.base64 ?? null}
          previewImageBase64={previewImageBase64}
        />
        <StyleTagsSummary styleResult={styleResult} />
        <RecommendedAgentsList agents={recommendedAgents} />
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-xs sm:text-sm text-destructive font-medium">
            ⚠️ {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
