import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea.tsx';
import type { EvaluationResult } from '@/types/evaluation';
import { ScoreRadar } from '@/components/ScoreRadar';

interface EvaluationResultsProps {
  evaluation: EvaluationResult | null;
  lastLatencyMs: number | null;
  isProcessing: boolean;
  processingStage: string | null;
  onDownloadXmp: () => void;
  onSaveToHistory: () => void;
}

export function EvaluationResults({
  evaluation,
  lastLatencyMs,
  isProcessing,
  processingStage,
  onDownloadXmp,
  onSaveToHistory
}: EvaluationResultsProps) {
  const { t } = useTranslation();
  const formatRetouchValue = (value: unknown) => {
    if (typeof value === 'number' || typeof value === 'string') {
      return value;
    }
    if (value && typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value ?? '');
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
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-3xl font-semibold">{evaluation.score}</p>
        <p className="text-xs text-muted-foreground">{t('result.overallScore')}</p>
        {lastLatencyMs && (
          <p className="mt-2 text-xs text-muted-foreground">
            {t('result.latency')}: {lastLatencyMs}ms
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {evaluation.dimensions.map((dimension) => (
          <div key={dimension.name} className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm font-semibold text-foreground">
              {t(`dimensions.${dimension.name.toLowerCase()}`)}
            </p>
            <p className="text-2xl font-semibold text-foreground">{dimension.score}</p>
            <p className="mt-2 text-xs text-muted-foreground">{dimension.reason}</p>
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
          <ul className="mt-3 list-disc space-y-2 pl-5 text-xs text-muted-foreground">
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
              <div key={index} className="rounded-lg border border-slate-700 bg-background p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground">
                    {step.tool} — {step.step}
                  </p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{step.action}</p>
                {step.values && Object.keys(step.values).length > 0 ? (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                    {Object.entries(step.values).map(([key, value]) => (
                      <li key={key}>
                        {key}: {formatRetouchValue(value)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">{t('result.noParameters')}</p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">{step.reason}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm font-semibold text-foreground">{t('result.rawOutput')}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t('result.rawOutputHint')}</p>
        <Textarea
          className="mt-3 h-48 text-xs"
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
