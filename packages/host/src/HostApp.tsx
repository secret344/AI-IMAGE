import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@ui/button';
import { LanguageMenu } from '@image-studio/components/layout/LanguageMenu';
import { useLanguage } from '@image-studio/i18n/useLanguage';
import { hostAppRegistry } from '@host/appRegistry';
import { hostManifestIssues } from '@host/manifests';
import { KernelProvider } from '@host/kernel/KernelProvider';
import { HostDiagnosticsPanel } from '@host/HostDiagnosticsPanel';
import { useKernel } from '@host/kernel/useKernel';

const manifestIssueKeyByCode = {
  'invalid-shape': 'host.launcher.manifestDiagnostics.reasons.invalidShape',
  disabled: 'host.launcher.manifestDiagnostics.reasons.disabled',
  'version-incompatible': 'host.launcher.manifestDiagnostics.reasons.versionIncompatible'
} as const;

function HostToolbar({ activeAppId }: { activeAppId: string }) {
  const { t } = useTranslation();
  const { os } = useKernel();

  const activeApp = useMemo(
    () => hostAppRegistry.find((app) => app.id === activeAppId) ?? hostAppRegistry[0],
    [activeAppId]
  );

  if (!activeApp) {
    return null;
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          window.location.assign(activeApp.entryPath);
        }}
      >
        {t('host.actions.openInCurrentWindow')}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={async () => {
          const opened = await os.openAppWindow(activeApp.entryPath);
          if (!opened) {
            os.notify(t('host.actions.openWindowFailed'));
          }
        }}
      >
        {t('host.actions.openInNewWindow')}
      </Button>
    </div>
  );
}

export function HostApp() {
  const { t } = useTranslation();
  const { currentLanguage, switchLanguage, availableLanguages } = useLanguage();
  const [activeAppId, setActiveAppId] = useState<string>(hostAppRegistry[0]?.id ?? '');

  const activeApp = useMemo(
    () => hostAppRegistry.find((app) => app.id === activeAppId) ?? hostAppRegistry[0],
    [activeAppId]
  );

  const skippedManifestCount = hostManifestIssues.length;
  const summarizedManifestIssues = useMemo(() => {
    const summaryByIssue = new Map<
      string,
      {
        code: (typeof hostManifestIssues)[number]['code'];
        manifestId?: string;
        minHostVersion?: string;
        count: number;
      }
    >();

    for (const issue of hostManifestIssues) {
      const summaryKey = `${issue.code}|${issue.manifestId ?? ''}|${issue.minHostVersion ?? ''}`;
      const existingIssue = summaryByIssue.get(summaryKey);
      if (existingIssue) {
        existingIssue.count += 1;
        continue;
      }

      summaryByIssue.set(summaryKey, {
        code: issue.code,
        manifestId: issue.manifestId,
        minHostVersion: issue.minHostVersion,
        count: 1
      });
    }

    return Array.from(summaryByIssue.values());
  }, []);

  const exportManifestDiagnostics = useCallback(() => {
    const exportPayload = {
      generatedAt: new Date().toISOString(),
      hostVersion: import.meta.env.VITE_HOST_APP_VERSION ?? 'unknown',
      skippedCount: skippedManifestCount,
      uniqueIssueCount: summarizedManifestIssues.length,
      issues: summarizedManifestIssues
    };

    const exportBlob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: 'application/json'
    });

    const exportUrl = URL.createObjectURL(exportBlob);
    const downloadLink = document.createElement('a');
    downloadLink.href = exportUrl;
    downloadLink.download = `host-manifest-diagnostics-${Date.now()}.json`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(exportUrl);
  }, [skippedManifestCount, summarizedManifestIssues]);

  return (
    <div className="flex h-full min-w-0 flex-col gap-3 overflow-hidden">
      <section className="rounded-xl border border-border/50 bg-card/60 p-2 shadow-sm">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {hostAppRegistry.map((app) => {
              const AppIcon = app.icon;
              const isActive = app.id === activeApp.id;

              return (
                <Button
                  key={app.id}
                  type="button"
                  variant={isActive ? 'default' : 'outline'}
                  size="sm"
                  className="h-9 gap-2"
                  onClick={() => setActiveAppId(app.id)}
                >
                  <AppIcon className="h-4 w-4" />
                  <span>{t(app.titleKey)}</span>
                </Button>
              );
            })}
          </div>
          <LanguageMenu
            currentLanguage={currentLanguage}
            availableLanguages={availableLanguages}
            onSelectLanguage={switchLanguage}
          />
        </div>
        <p className="px-1 pt-2 text-xs text-muted-foreground">
          {activeApp ? t(activeApp.descriptionKey) : t('host.launcher.description')}
        </p>
      </section>

      {activeApp ? (
        <KernelProvider activeAppId={activeApp.id} permissions={activeApp.permissions}>
          <div className="min-h-0 flex-1 overflow-hidden flex flex-col gap-3">
            <HostToolbar activeAppId={activeApp.id} />
            <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border/40 bg-card/40 p-3">
              <div className="flex h-full flex-col justify-center gap-3 rounded-lg border border-dashed border-border/60 bg-card/20 p-4">
                <p className="text-sm font-medium text-foreground">{t('host.launcher.title')}</p>
                <p className="text-sm text-muted-foreground">{t('host.launcher.description')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('host.launcher.loadedAppsCount', { count: hostAppRegistry.length })}
                </p>
                <p className="text-xs text-muted-foreground">{activeApp.entryPath}</p>
                {skippedManifestCount > 0 ? (
                  <div className="rounded-lg border border-border/60 bg-card/30 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-foreground">
                        {t('host.launcher.manifestDiagnostics.title')}
                      </p>
                      {import.meta.env.DEV ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={exportManifestDiagnostics}
                        >
                          {t('host.launcher.manifestDiagnostics.actions.exportJson')}
                        </Button>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t('host.launcher.manifestDiagnostics.skippedCount', {
                        count: skippedManifestCount
                      })}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t('host.launcher.manifestDiagnostics.uniqueIssueCount', {
                        count: summarizedManifestIssues.length
                      })}
                    </p>
                    <ul className="mt-2 list-disc pl-4 text-xs text-muted-foreground">
                      {summarizedManifestIssues.map((issue) => (
                        <li
                          key={`${issue.code}-${issue.manifestId ?? 'unknown'}-${issue.minHostVersion ?? 'none'}`}
                        >
                          {t(manifestIssueKeyByCode[issue.code], {
                            manifestId:
                              issue.manifestId ??
                              t('host.launcher.manifestDiagnostics.unknownManifest'),
                            minHostVersion:
                              issue.minHostVersion ??
                              t('host.launcher.manifestDiagnostics.unknownVersion')
                          })}{' '}
                          (
                          {t('host.launcher.manifestDiagnostics.issueOccurrences', {
                            count: issue.count
                          })}
                          )
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
            {import.meta.env.DEV ? <HostDiagnosticsPanel activeAppId={activeApp.id} /> : null}
          </div>
        </KernelProvider>
      ) : (
        <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border/40 bg-card/40 p-3">
          <div className="flex h-full flex-col justify-center gap-3 rounded-lg border border-dashed border-border/60 bg-card/20 p-4">
            <p className="text-sm font-medium text-foreground">{t('host.launcher.title')}</p>
            <p className="text-sm text-muted-foreground">{t('host.launcher.description')}</p>
            <p className="text-xs text-muted-foreground">
              {t('host.launcher.loadedAppsCount', { count: hostAppRegistry.length })}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('host.launcher.manifestDiagnostics.skippedCount', {
                count: skippedManifestCount
              })}
            </p>
            {summarizedManifestIssues.length > 0 ? (
              <ul className="list-disc pl-4 text-xs text-muted-foreground">
                {summarizedManifestIssues.map((issue) => (
                  <li
                    key={`${issue.code}-${issue.manifestId ?? 'unknown'}-${issue.minHostVersion ?? 'none'}`}
                  >
                    {t(manifestIssueKeyByCode[issue.code], {
                      manifestId:
                        issue.manifestId ?? t('host.launcher.manifestDiagnostics.unknownManifest'),
                      minHostVersion:
                        issue.minHostVersion ??
                        t('host.launcher.manifestDiagnostics.unknownVersion')
                    })}{' '}
                    (
                    {t('host.launcher.manifestDiagnostics.issueOccurrences', {
                      count: issue.count
                    })}
                    )
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
