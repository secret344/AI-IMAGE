import { useCallback, useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/i18n/useLanguage';
import { useThemeConfig } from '@/components/providers/ThemeProvider';
import { SettingsPanel } from '@/components/SettingsPanel';
import { loadProviderSettings } from '@/modules/storage/settings';
import { Header } from '@/components/layout/Header';
import { LanguageMenu } from '@/components/layout/LanguageMenu';
import { ThemeMenu } from '@/components/layout/ThemeMenu';
import { SettingsModal } from '@/components/layout/SettingsModal';

export function Layout({ children }: PropsWithChildren) {
  const { t } = useTranslation();
  const { currentLanguage, switchLanguage, availableLanguages } = useLanguage();
  const { theme, setTheme } = useThemeConfig();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const buildModelInfo = useCallback(() => {
    const settings = loadProviderSettings();
    const providerLabel = t(`settings.providers.${settings.provider}`);
    return `${providerLabel}: ${settings.model}`;
  }, [t]);
  const [modelInfo, setModelInfo] = useState(buildModelInfo);

  useEffect(() => {
    setModelInfo(buildModelInfo());
  }, [buildModelInfo]);

  useEffect(() => {
    const handler = () => setModelInfo(buildModelInfo());
    window.addEventListener('settings-updated', handler);
    return () => window.removeEventListener('settings-updated', handler);
  }, [buildModelInfo]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header
        title={t('header.title')}
        subtitle={t('header.subtitle')}
        badge={t('header.badge')}
        settingsLabel={t('settings.title')}
        modelInfo={modelInfo}
        onOpenSettings={() => setIsSettingsOpen(true)}
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
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 py-6 sm:py-8">{children}</main>
      <footer className="border-t border-border/50 px-4 sm:px-6 py-6 text-center text-xs text-muted-foreground/80 bg-background/80">
        {t('header.footerText')}
      </footer>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)}>
        <SettingsPanel />
      </SettingsModal>
    </div>
  );
}
