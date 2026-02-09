import { useCallback, useEffect, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { LanguageCode } from '@/config/i18n-config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { StyleTagScore } from '@/config/style-tags';
import { useTaskContext } from '@/state/TaskContext';
import { processImage } from '@/modules/upload/processImage';
import { recommendAgents } from '@/modules/agent/recommendAgents';
import { assertFileSize } from '@/utils/file';
import { analyzeStyleWithChat } from '@/modules/style/analyzeStyleWithChat';
import type { UseUploadChatReturn } from '@/hooks/useUploadChat';
import { saveTaskDetail, saveTaskSummary } from '@/modules/storage/history';
import { UploadDropzone } from '@/components/upload/UploadDropzone';
import { StyleTagsSummary } from '@/components/upload/StyleTagsSummary';
import { RecommendedAgentsList } from '@/components/upload/RecommendedAgentsList';
import { TaskSettingsPanel } from '@/components/upload/TaskSettingsPanel';

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

interface UploadPanelProps {
  uploadChat: UseUploadChatReturn;
}

export function UploadPanel({ uploadChat }: UploadPanelProps) {
  const { t, i18n } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [passphrase] = useState('');
  const {
    setCurrentTaskId,
    taskSettings,
    globalProviderSettings,
    taskState,
    setTaskState,
    setTaskStateForTask,
    setTaskSettingsForTask
  } = useTaskContext();

  const {
    selectedFileName,
    isProcessing,
    processingStage,
    styleResult,
    recommendedAgents,
    processedImage
  } = taskState;

  const applyRecommendations = useCallback(
    (styleTags: StyleTagScore[]) => {
      const agents = recommendAgents(styleTags, { limit: globalProviderSettings.topAgents });
      setTaskState({
        recommendedAgents: agents,
        selectedAgentId: agents[0]?.id ?? null
      });
    },
    [setTaskState, globalProviderSettings]
  );

  const handleFile = useCallback(
    async (file: File) => {
      if (!file) {
        return;
      }

      setError(null);
      // 新图片上传，生成新的任务 ID
      const nextTaskId = `upload-${Date.now()}`;
      const nextSettings = taskSettings ?? globalProviderSettings;
      setTaskSettingsForTask(nextTaskId, nextSettings);
      setTaskStateForTask(nextTaskId, {
        isProcessing: true,
        processingStage: t('upload.preprocessing'),
        evaluation: null,
        styleResult: null,
        recommendedAgents: [],
        selectedAgentId: null
      });
      setCurrentTaskId(nextTaskId);

      try {
        assertFileSize(file, 50);
        const processed = await processImage(file);
        await saveTaskSummary({
          taskId: nextTaskId,
          fileName: file.name,
          thumbnailBase64: processed.base64,
          processedImage: {
            base64: processed.base64,
            exif: processed.exif,
            dimensions: processed.dimensions
          }
        });
        await saveTaskDetail(nextTaskId, {
          processedImage: {
            base64: processed.base64,
            exif: processed.exif,
            dimensions: processed.dimensions
          },
          taskSettings: nextSettings
        });
        setTaskStateForTask(nextTaskId, {
          selectedFileName: file.name,
          processedImage: processed,
          previewImageBase64: processed.base64
        });

        // 不再自动进行风格识别
        // 等待用户通过聊天或点击"分析"按钮手动触发
      } catch (err) {
        setError(getUploadErrorMessage(err, t));
      } finally {
        setTaskStateForTask(nextTaskId, {
          processingStage: null,
          isProcessing: false
        });
        window.dispatchEvent(new Event('history-updated'));
      }
    },
    [
      globalProviderSettings,
      setCurrentTaskId,
      setTaskSettingsForTask,
      setTaskStateForTask,
      t,
      taskSettings
    ]
  );

  /**
   * 手动触发风格分析
   * 可由用户点击按钮触发，也可由聊天中的AI建议触发
   */
  const handleAnalyzeStyle = useCallback(async () => {
    if (!processedImage) {
      setError('请先上传图片');
      return;
    }

    setError(null);
    setTaskState({ isProcessing: true });

    try {
      const userLanguage: LanguageCode = i18n.language?.toLowerCase().startsWith('zh')
        ? 'zh'
        : 'en';

      await analyzeStyleWithChat({
        base64Image: processedImage.base64,
        userLanguage,
        passphrase,
        providerSettings: taskSettings ?? undefined,
        chatHistory: uploadChat.messages, // 使用聊天消息作为上下文
        onProgress: (stage) => setTaskState({ processingStage: stage }),
        onSuccess: (styleResult) => {
          setTaskState({ styleResult });
          applyRecommendations(styleResult.styleTags);
        },
        onError: (err) => {
          setError(getUploadErrorMessage(err, t));
        }
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(getUploadErrorMessage(error, t));
    } finally {
      setTaskState({
        processingStage: null,
        isProcessing: false
      });
    }
  }, [
    processedImage,
    i18n.language,
    passphrase,
    uploadChat.messages,
    t,
    applyRecommendations,
    setTaskState,
    taskSettings
  ]);

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
    <Card className="border-border/50 bg-card/60 backdrop-blur-sm flex flex-col shadow-sm rounded-xl h-full">
      <CardHeader className="pb-3 sm:pb-4 flex-shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <CardTitle className="text-lg sm:text-xl">{t('upload.title')}</CardTitle>
            <CardDescription className="text-sm text-muted-foreground/80">
              {t('upload.description')}
            </CardDescription>
          </div>
          {/* 任务级 AI 设置按钮 */}
          <TaskSettingsPanel />
        </div>
      </CardHeader>
      <CardContent className="space-y-3 flex-1 flex flex-col overflow-y-auto">
        {/* 上传区域或图片预览 - 根据是否有图片决定显示哪个 */}
        {!processedImage ? (
          // 没有图片时显示上传区域
          <UploadDropzone
            isProcessing={isProcessing}
            processingStage={processingStage}
            isDragging={isDragging}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onFileChange={handleFileChange}
          />
        ) : (
          // 有图片时显示预览（占据大部分空间）
          <div className="flex-1 min-h-0 flex flex-col gap-3">
            <div className="flex-1 min-h-0 relative">
              <Card className="border-border/60 bg-card/40 h-full">
                <CardContent className="p-2 h-full flex items-center justify-center">
                  <img
                    src={processedImage.base64}
                    alt={selectedFileName || t('upload.previewAlt')}
                    className="max-w-full max-h-full rounded-md border border-border/50 object-contain"
                  />
                </CardContent>
              </Card>
            </div>
            {selectedFileName && (
              <p className="text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 font-medium flex-shrink-0">
                ✓ {t('upload.selected')}: {selectedFileName}
              </p>
            )}
          </div>
        )}

        {/* 分析按钮 - 只在图片上传后且未分析时显示 */}
        {processedImage && !styleResult && (
          <Button
            onClick={handleAnalyzeStyle}
            disabled={isProcessing || uploadChat.isLoading}
            className="w-full flex-shrink-0"
            size="lg"
            variant={uploadChat.shouldShowAnalysisSuggestion ? 'default' : 'outline'}
          >
            {isProcessing ? processingStage || t('upload.processing') : '分析图片风格'}
          </Button>
        )}

        {/* AI分析建议 */}
        {uploadChat.shouldShowAnalysisSuggestion && uploadChat.analysisSuggestion && (
          <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800 flex-shrink-0">
            <AlertDescription className="text-sm">
              <div className="space-y-2">
                <p className="text-blue-900 dark:text-blue-100">
                  {uploadChat.analysisSuggestion}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={async () => {
                      uploadChat.confirmAnalysis();
                      await handleAnalyzeStyle();
                    }}
                    disabled={isProcessing}
                  >
                    确认分析
                  </Button>
                  <Button size="sm" variant="outline" onClick={uploadChat.confirmAnalysis}>
                    稍后再说
                  </Button>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <StyleTagsSummary styleResult={styleResult} />
        <RecommendedAgentsList agents={recommendedAgents} />
        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs sm:text-sm text-destructive font-medium flex-shrink-0">
            ⚠️ {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
