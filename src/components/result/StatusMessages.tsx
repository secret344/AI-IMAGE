import { useTranslation } from 'react-i18next';

interface StatusMessagesProps {
  isOnline: boolean;
  runError: string | null;
  styleResult: boolean | null;
  evaluation: boolean | null;
  lastLatencyMs: number | null;
}

export function StatusMessages({
  isOnline,
  runError,
  styleResult,
  evaluation,
  lastLatencyMs
}: StatusMessagesProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      {!isOnline && (
        <div className="rounded-lg border border-amber-700/60 bg-amber-950/30 p-3 text-xs text-amber-200">
          {t('result.offline')}
        </div>
      )}

      {!evaluation && styleResult && (
        <div className="rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground">
          {t('result.styleReady')}
          {lastLatencyMs && (
            <span className="ml-2">
              {t('result.lastLatency')}: {lastLatencyMs}ms
            </span>
          )}
        </div>
      )}

      {runError && <p className="text-xs text-rose-400">{runError}</p>}
    </div>
  );
}
