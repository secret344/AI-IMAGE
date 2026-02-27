/**
 * 评估结果展示组件
 * 职责：渲染评分、维度详情、EXIF 信息和导出操作
 * 特点：国际化、可视化评分、支持异常恢复提示
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, AlertDescription, AlertTitle } from '@ui/alert';
import { Button } from '@ui/button';
import { Checkbox } from '@ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@ui/dialog';
import { Input } from '@ui/input';
import { Label } from '@ui/label';
import { ScrollArea } from '@ui/scroll-area';
import { Textarea } from '@ui/textarea';
import type { EvaluationResult } from '@/types/evaluation';
import { ScoreRadar } from '@/components/ScoreRadar';
import { COMMON_EXIF_KEYS_SET } from '@/config/exif-constants';

interface EvaluationResultsProps {
  /** AI 评估结果（可能为空） */
  evaluation: EvaluationResult | null;
  /** EXIF 元数据 */
  exif: Record<string, string | number> | null;
  /** 上次耗时（毫秒） */
  lastLatencyMs: number | null;
  /** 是否正在处理 */
  isProcessing: boolean;
  /** 当前处理阶段文案 */
  processingStage: string | null;
  /** 下载 XMP 回调 */
  onDownloadXmp: () => void;
  /** 保存到历史记录回调 */
  onSaveToHistory: () => void;
}

/**
 * Evaluation results panel with score, EXIF, and retouch info
 * @param {EvaluationResultsProps} props - Component properties
 * @return {JSX.Element} Evaluation results panel
 */
export function EvaluationResults({
  evaluation,
  exif,
  lastLatencyMs,
  isProcessing,
  processingStage,
  onDownloadXmp,
  onSaveToHistory
}: EvaluationResultsProps) {
  const { t } = useTranslation();
  const [isExifOpen, setIsExifOpen] = useState(false);
  const [exifQuery, setExifQuery] = useState('');
  const [showCommonOnly, setShowCommonOnly] = useState(true);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const exifEntries = useMemo(() => {
    if (!exif || Object.keys(exif).length === 0) {
      return [];
    }

    return Object.entries(exif);
  }, [exif]);

  const filteredExifEntries = useMemo(() => {
    if (!exifEntries.length) {
      return [];
    }

    const query = exifQuery.trim().toLowerCase();
    return exifEntries.filter(([key, value]) => {
      if (showCommonOnly && !COMMON_EXIF_KEYS_SET.has(key)) {
        return false;
      }
      if (!query) {
        return true;
      }
      const labelKey = `result.exifTags.${key}`;
      const label = t(labelKey, { defaultValue: key }).toLowerCase();
      const valueText = String(value).toLowerCase();
      return (
        key.toLowerCase().includes(query) || label.includes(query) || valueText.includes(query)
      );
    });
  }, [exifEntries, exifQuery, showCommonOnly, t]);
  const formatRetouchValue = (value: unknown) => {
    if (typeof value === 'number' || typeof value === 'string') {
      return value;
    }
    if (value && typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value ?? '');
  };

  const toFraction = (value: number) => {
    const maxDenominator = 8000;
    let bestNumerator = 1;
    let bestDenominator = 1;
    let bestError = Math.abs(value - bestNumerator / bestDenominator);

    for (let denominator = 1; denominator <= maxDenominator; denominator += 1) {
      const numerator = Math.round(value * denominator);
      if (numerator === 0) {
        continue;
      }
      const error = Math.abs(value - numerator / denominator);
      if (error < bestError) {
        bestError = error;
        bestNumerator = numerator;
        bestDenominator = denominator;
      }
      if (bestError === 0) {
        break;
      }
    }

    return `${bestNumerator}/${bestDenominator}`;
  };

  const formatExifValue = (key: string, value: string | number) => {
    if (typeof value === 'string') {
      return value;
    }
    if (key === 'FNumber' || key === 'ApertureValue' || key === 'MaxAperture') {
      return `${t('result.exifUnits.fPrefix')}${value}`;
    }
    if (key === 'ExposureTime' || key === 'ShutterSpeedValue') {
      if (typeof value === 'number' && value > 0 && value < 1) {
        return `${toFraction(value)}${t('result.exifUnits.secondsSuffix')}`;
      }
      return `${value}${t('result.exifUnits.secondsSuffix')}`;
    }
    if (key === 'FocalLength' || key === 'FocalLengthIn35mm' || key === 'FocalLengthIn35mmFilm') {
      return `${value}${t('result.exifUnits.mmSuffix')}`;
    }
    if (key === 'ExposureBiasValue' || key === 'BrightnessValue') {
      return `${value}${t('result.exifUnits.evSuffix')}`;
    }
    if (key === 'FocalPlaneXResolution' || key === 'FocalPlaneYResolution') {
      return `${value}${t('result.exifUnits.pxPerUnitSuffix')}`;
    }
    if (key === 'FocalPlaneResolutionUnit' && typeof value === 'number') {
      if (value === 2) {
        return t('result.exifValues.focalPlaneResolutionUnit.inch');
      }
      if (value === 3) {
        return t('result.exifValues.focalPlaneResolutionUnit.cm');
      }
      if (value === 1) {
        return t('result.exifValues.focalPlaneResolutionUnit.none');
      }
    }
    return String(value);
  };

  const parseNumericValue = (value: string | number) => {
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'string' && value.includes('/')) {
      const [numerator, denominator] = value.split('/').map((part) => Number(part));
      if (!Number.isNaN(numerator) && !Number.isNaN(denominator) && denominator !== 0) {
        return numerator / denominator;
      }
    }
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const isOutlier = (key: string, value: string | number) => {
    const numeric = parseNumericValue(value);
    if (numeric === null) {
      return false;
    }
    switch (key) {
      case 'ISO':
        return numeric < 10 || numeric > 102400;
      case 'FNumber':
      case 'ApertureValue':
      case 'MaxAperture':
        return numeric < 0.7 || numeric > 64;
      case 'ExposureTime':
      case 'ShutterSpeedValue':
        return numeric <= 0 || numeric > 60;
      case 'FocalLength':
      case 'FocalLengthIn35mm':
      case 'FocalLengthIn35mmFilm':
        return numeric < 3 || numeric > 1200;
      case 'ExposureBiasValue':
        return numeric < -5 || numeric > 5;
      default:
        return false;
    }
  };

  const handleCopyExif = async () => {
    if (!exif || Object.keys(exif).length === 0) {
      return;
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(exif, null, 2));
      setCopyStatus(t('result.exifCopied'));
      window.setTimeout(() => setCopyStatus(null), 2000);
    } catch {
      setCopyStatus(t('common.error'));
      window.setTimeout(() => setCopyStatus(null), 2000);
    }
  };

  if (!evaluation) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        {isProcessing ? processingStage || t('result.processing') : t('result.noResult')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {evaluation.parseRecovered && (
        <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-100">
          <AlertTitle>{t('result.parseRecoveredTitle')}</AlertTitle>
          <AlertDescription>{t('result.parseRecoveredDescription')}</AlertDescription>
        </Alert>
      )}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-3xl font-semibold">{evaluation.score}</p>
            <p className="text-xs text-muted-foreground">{t('result.overallScore')}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExifOpen(true)}
            className="h-8 px-3"
          >
            {t('result.exifButton')}
          </Button>
        </div>
        {lastLatencyMs && (
          <p className="mt-2 text-xs text-muted-foreground">
            {t('result.latency')}: {lastLatencyMs}ms
          </p>
        )}
      </div>

      <Dialog open={isExifOpen} onOpenChange={setIsExifOpen}>
        <DialogContent className="max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{t('result.exifDialogTitle')}</DialogTitle>
            <DialogDescription>{t('result.exifDialogDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Input
                value={exifQuery}
                onChange={(event) => setExifQuery(event.target.value)}
                placeholder={t('result.exifSearchPlaceholder')}
              />
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="exif-common-only"
                    checked={showCommonOnly}
                    onCheckedChange={(checked) => setShowCommonOnly(Boolean(checked))}
                  />
                  <Label htmlFor="exif-common-only" className="text-xs text-muted-foreground">
                    {t('result.exifCommonOnly')}
                  </Label>
                </div>
                <Button variant="outline" size="sm" onClick={handleCopyExif}>
                  {t('result.exifCopyJson')}
                </Button>
              </div>
            </div>
            {copyStatus && <p className="text-xs text-muted-foreground">{copyStatus}</p>}
          </div>

          {filteredExifEntries.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('result.exifEmpty')}</p>
          ) : (
            <ScrollArea className="max-h-[60vh] pr-3">
              <div className="grid gap-2 sm:grid-cols-2">
                {filteredExifEntries.map(([key, value]) => {
                  const labelKey = `result.exifTags.${key}`;
                  const label = t(labelKey, { defaultValue: t('result.exifTagFallback', { key }) });
                  const highlight = isOutlier(key, value);
                  return (
                    <div key={key} className="rounded-md border border-border/60 bg-background p-2">
                      <p className="text-[11px] text-muted-foreground">{label}</p>
                      <p
                        className={`text-xs font-medium ${
                          highlight ? 'text-destructive' : 'text-foreground'
                        }`}
                      >
                        {formatExifValue(key, value)}
                      </p>
                      {highlight && (
                        <p className="mt-1 text-[10px] text-destructive">
                          {t('result.exifOutlier')}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      <div className="grid gap-3 sm:grid-cols-2">
        {evaluation.dimensions.map((dimension) => (
          <div key={dimension.name} className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm font-semibold text-foreground">
              {t(`dimensions.${dimension.name.toLowerCase()}`)}
            </p>
            <p className="text-2xl font-semibold text-foreground">{dimension.score}</p>
            <p className="mt-2 text-xs text-muted-foreground break-words whitespace-pre-wrap">
              {dimension.reason}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm font-semibold text-foreground">{t('result.scoreRadar')}</p>
        <div className="mt-4">
          <ScoreRadar dimensions={evaluation.dimensions} />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm font-semibold text-foreground">{t('result.shootingTips')}</p>
        {evaluation.shootingTips.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">{t('result.noTips')}</p>
        ) : (
          <ul className="mt-3 list-disc space-y-2 pl-5 text-xs text-muted-foreground break-words whitespace-pre-wrap">
            {evaluation.shootingTips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">{t('result.retouchPlan')}</p>
          <Button variant="outline" size="sm" onClick={onDownloadXmp}>
            {t('result.downloadXmp')}
          </Button>
        </div>
        {evaluation.retouchPlan.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">{t('result.noRetouchPlan')}</p>
        ) : (
          <div className="mt-3 space-y-3">
            {evaluation.retouchPlan.map((step, index) => (
              <div key={index} className="rounded-lg border border-border bg-background p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground">
                    {step.tool} — {step.step}
                  </p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground break-words whitespace-pre-wrap">
                  {step.action}
                </p>
                {step.values && Object.keys(step.values).length > 0 ? (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground break-words whitespace-pre-wrap">
                    {Object.entries(step.values).map(([key, value]) => (
                      <li key={key}>
                        {key}: {formatRetouchValue(value)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">{t('result.noParameters')}</p>
                )}
                <p className="mt-2 text-xs text-muted-foreground break-words whitespace-pre-wrap">
                  {step.reason}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm font-semibold text-foreground">{t('result.rawOutput')}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t('result.rawOutputHint')}</p>
        <Textarea
          className="mt-3 h-48 text-xs whitespace-pre-wrap break-words"
          readOnly
          value={JSON.stringify(evaluation.raw ?? evaluation, null, 2)}
        />
      </div>

      <Button className="w-full" onClick={onSaveToHistory} variant="outline">
        {t('result.saveToHistory')}
      </Button>
    </div>
  );
}
