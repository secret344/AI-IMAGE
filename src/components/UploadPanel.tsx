import { useCallback, useEffect, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { LanguageCode } from '@/config/i18n-config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { StyleTagScore } from '@/config/style-tags';
import { useAppStore } from '@/state/useAppStore';
import { processImage } from '@/modules/upload/processImage';
import { recommendAgents } from '@/modules/agent/recommendAgents';
import { loadProviderSettings } from '@/modules/storage/settings';
import { assertFileSize } from '@/utils/file';
import { analyzeStyleWithChat } from '@/modules/style/analyzeStyleWithChat';
import { useUploadChat } from '@/hooks/useUploadChat';
import { UploadDropzone } from '@/components/upload/UploadDropzone';
import { UploadPreview } from '@/components/upload/UploadPreview';
import { StyleTagsSummary } from '@/components/upload/StyleTagsSummary';
import { RecommendedAgentsList } from '@/components/upload/RecommendedAgentsList';
import { ChatPanel } from '@/components/result/ChatPanel';

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

  // 使用 useUploadChat Hook 管理聊天
  const uploadChat = useUploadChat({
    taskId: `task-${Date.now()}`, // 临时 taskId，实际应该来自更上层
    imageName: selectedFileName || 'untitled',
    agentStyle: '通用分析', // 上传阶段使用通用分析
  });

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
      uploadChat.clearMessages(); // 清除前一个图片的聊天记录
      setIsProcessing(true);
      setProcessingStage(t('upload.preprocessing'));
      setEvaluation(null);
      setStyleResult(null); // 清除前一个图片的风格结果
      setRecommendedAgents([]); // 清除前一个图片的推荐Agent

      try {
        assertFileSize(file, 50);
        const processed = await processImage(file);
        setSelectedFileName(file.name);
        setProcessedImage(processed);
        setPreviewImageBase64(processed.base64);
        
        // 不再自动进行风格识别
        // 等待用户通过聊天或点击"分析"按钮手动触发
      } catch (err) {
        setError(getUploadErrorMessage(err, t));
      } finally {
        setProcessingStage(null);
        setIsProcessing(false);
      }
    },
    [
      i18n.language,
      passphrase,
      setEvaluation,
      setIsProcessing,
      setProcessingStage,
      setProcessedImage,
      setPreviewImageBase64,
      setSelectedFileName,
      setStyleResult,
      setRecommendedAgents,
      t,
      uploadChat,
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
    setIsProcessing(true);

    try {
      const userLanguage: LanguageCode = i18n.language?.toLowerCase().startsWith('zh')
        ? 'zh'
        : 'en';

      await analyzeStyleWithChat({
        base64Image: processedImage.base64,
        userLanguage,
        passphrase,
        chatHistory: uploadChat.messages, // 使用聊天消息作为上下文
        onProgress: setProcessingStage,
        onSuccess: (styleResult) => {
          setStyleResult(styleResult);
          applyRecommendations(styleResult.styleTags);
        },
        onError: (err) => {
          setError(getUploadErrorMessage(err, t));
        },
      });
    } finally {
      setProcessingStage(null);
      setIsProcessing(false);
    }
  }, [
    processedImage,
    i18n.language,
    passphrase,
    uploadChat.messages,
    t,
    applyRecommendations,
    setIsProcessing,
    setProcessingStage,
    setStyleResult,
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
      {/* 左侧：上传和预览区域 */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm flex flex-col">
        <CardHeader className="pb-3 sm:pb-4">
          <CardTitle className="text-lg sm:text-xl">{t('upload.title')}</CardTitle>
          <CardDescription className="text-sm text-muted-foreground/80">
            {t('upload.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 flex-1 flex flex-col overflow-y-auto">
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
          
          {/* 分析按钮 - 只在图片上传后且未分析时显示 */}
          {processedImage && !styleResult && (
            <Button
              onClick={handleAnalyzeStyle}
              disabled={isProcessing || uploadChat.isLoading}
              className="w-full"
              size="lg"
              variant={uploadChat.shouldShowAnalysisSuggestion ? 'default' : 'outline'}
            >
              {isProcessing ? processingStage || t('upload.processing') : '分析图片风格'}
            </Button>
          )}

          {/* AI分析建议 */}
          {uploadChat.shouldShowAnalysisSuggestion && uploadChat.analysisSuggestion && (
            <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
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
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={uploadChat.confirmAnalysis}
                    >
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
            <div className="rounded-md bg-destructive/10 p-3 text-xs sm:text-sm text-destructive font-medium">
              ⚠️ {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 右侧：聊天区域 - 上传图片后显示 */}
      {processedImage && (
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm flex flex-col">
          <ChatPanel
            messages={uploadChat.messages}
            onSend={uploadChat.sendMessage}
            isLoading={uploadChat.isLoading}
            error={uploadChat.error}
            onClearError={uploadChat.clearError}
            disabled={!processedImage}
          />
        </Card>
      )}
    </div>
  );
}
