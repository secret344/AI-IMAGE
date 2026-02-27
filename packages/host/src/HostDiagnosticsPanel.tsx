import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@ui/button';
import { ScrollArea } from '@ui/scroll-area';
import { useKernel } from '@host/kernel/useKernel';

interface HostDiagnosticsPanelProps {
  activeAppId: string;
}

export function HostDiagnosticsPanel({ activeAppId }: HostDiagnosticsPanelProps) {
  const { t } = useTranslation();
  const { telemetry } = useKernel();
  const [, setTick] = useState(0);

  const events = telemetry.getEvents().slice().reverse();

  const successCount = events.filter((item) => item.success).length;
  const failureCount = events.length - successCount;
  const avgDuration =
    events.length > 0
      ? Math.round(events.reduce((sum, item) => sum + item.durationMs, 0) / events.length)
      : 0;

  return (
    <section className="rounded-xl border border-border/40 bg-card/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">{t('host.diagnostics.title')}</p>
          <p className="text-xs text-muted-foreground">
            {t('host.diagnostics.subtitle', { appId: activeAppId })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setTick((value) => value + 1)}
          >
            {t('host.diagnostics.actions.refresh')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              telemetry.clearEvents();
              setTick((value) => value + 1);
            }}
          >
            {t('host.diagnostics.actions.clear')}
          </Button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-4">
        <div className="rounded-md border border-border/50 bg-card/60 p-2">
          <p className="text-xs text-muted-foreground">{t('host.diagnostics.metrics.total')}</p>
          <p className="text-sm font-medium text-foreground">{events.length}</p>
        </div>
        <div className="rounded-md border border-border/50 bg-card/60 p-2">
          <p className="text-xs text-muted-foreground">{t('host.diagnostics.metrics.success')}</p>
          <p className="text-sm font-medium text-foreground">{successCount}</p>
        </div>
        <div className="rounded-md border border-border/50 bg-card/60 p-2">
          <p className="text-xs text-muted-foreground">{t('host.diagnostics.metrics.failure')}</p>
          <p className="text-sm font-medium text-foreground">{failureCount}</p>
        </div>
        <div className="rounded-md border border-border/50 bg-card/60 p-2">
          <p className="text-xs text-muted-foreground">{t('host.diagnostics.metrics.avgMs')}</p>
          <p className="text-sm font-medium text-foreground">{avgDuration}</p>
        </div>
      </div>

      <ScrollArea className="mt-3 h-40 rounded-md border border-border/50 bg-card/40">
        <div className="space-y-1 p-2">
          {events.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('host.diagnostics.empty')}</p>
          ) : (
            events.map((item, index) => (
              <div
                key={`${item.appId}-${item.eventName}-${index}`}
                className="rounded border border-border/40 bg-card/60 p-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs font-medium text-foreground">{item.eventName}</p>
                  <p className="text-xs text-muted-foreground">{Math.round(item.durationMs)}ms</p>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {t('host.diagnostics.itemMeta', {
                    appId: item.appId,
                    status: item.success
                      ? t('host.diagnostics.status.success')
                      : t('host.diagnostics.status.failure')
                  })}
                </p>
                {!item.success && item.errorMessage ? (
                  <p className="mt-1 text-[11px] text-destructive">{item.errorMessage}</p>
                ) : null}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </section>
  );
}
