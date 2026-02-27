import { useState, useMemo, useEffect, useRef } from 'react';
import type { PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@image-studio/i18n/useLanguage';
import { useThemeConfig } from '@/components/providers/ThemeProvider';
import { useAppStore } from '@/state/useAppStore';
import { hydrateProviderSettings } from '@/modules/storage/settings';
import { SettingsPanel } from '@/components/SettingsPanel';
import { Header } from '@/components/layout/Header';
import { LanguageMenu } from '@/components/layout/LanguageMenu';
import { ThemeMenu } from '@/components/layout/ThemeMenu';
import { SettingsModal } from '@/components/layout/SettingsModal';
import { Button } from '@ui/button';

export function Layout({ children }: PropsWithChildren) {
  const { t } = useTranslation();
  const { currentLanguage, switchLanguage, availableLanguages } = useLanguage();
  const { theme, setTheme } = useThemeConfig();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { globalProviderSettings, setGlobalProviderSettings } = useAppStore();
  const isInitializedRef = useRef(false);

  // Initialize provider settings from localStorage on mount
  useEffect(() => {
    if (!isInitializedRef.current && !globalProviderSettings) {
      isInitializedRef.current = true;
      setGlobalProviderSettings(hydrateProviderSettings());
    }
  }, [globalProviderSettings, setGlobalProviderSettings]);

  // Use hydrated settings or fallback to localStorage
  const effectiveSettings = globalProviderSettings ?? hydrateProviderSettings();

  // Memoize modelInfo calculation based on current settings and language
  const modelInfo = useMemo(() => {
    const providerLabel = t(`settings.providers.${effectiveSettings.provider}`);
    const model = effectiveSettings.model || t('settings.noModelsDetected');
    return `${providerLabel}: ${model}`;
  }, [effectiveSettings, t]);

  const canReturnToHostLauncher = window.location.pathname.startsWith('/packages/');

  const handleBackToHostLauncher = () => {
    window.location.assign('/packages/host/index.html');
  };

  return (
    <div className="h-screen bg-background text-foreground flex flex-col overflow-hidden">
      <Header
        title={t('header.title')}
        subtitle={t('header.subtitle')}
        badge={t('header.badge')}
        settingsLabel={t('settings.buttonLabel')}
        modelInfo={modelInfo}
        onOpenSettings={() => setIsSettingsOpen(true)}
        hostBackButton={
          canReturnToHostLauncher ? (
            <Button type="button" variant="outline" size="sm" onClick={handleBackToHostLauncher}>
              {t('host.actions.backToLauncher')}
            </Button>
          ) : null
        }
        languageMenu={
          <div className="flex items-center gap-2">
            <ThemeMenu currentTheme={theme} onSelectTheme={setTheme} />
            <LanguageMenu
              currentLanguage={currentLanguage}
              availableLanguages={availableLanguages}
              onSelectLanguage={switchLanguage}
            />
          </div>
        }
      />
      <main className="flex-1 w-full px-3 sm:px-6 py-6 sm:py-8 min-w-0 overflow-hidden">
        <div className="rounded-2xl border border-border/40 bg-card/30 p-4 sm:p-6 shadow-sm min-w-0 overflow-hidden w-full h-full">
          {children}
        </div>
      </main>
      <footer className="border-t border-border/40 px-4 sm:px-6 py-6 text-center text-xs text-muted-foreground/80 bg-background/80">
        {t('header.footerText')}
      </footer>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)}>
        <SettingsPanel />
      </SettingsModal>
    </div>
  );
}
