import { useState, useMemo, useEffect } from 'react';
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

  useEffect(() => {
    const handler = () => {
      // Trigger model info refresh on settings change
      window.dispatchEvent(new Event('model-info-changed'));
    };
    window.addEventListener('settings-updated', handler);
    return () => window.removeEventListener('settings-updated', handler);
  }, []);

  const modelInfo = useMemo(() => {
    const settings = loadProviderSettings();
    const providerName =
      settings.provider === 'openai'
        ? 'OpenAI'
        : settings.provider === 'gemini'
          ? 'Gemini'
          : settings.provider === 'claude'
            ? 'Claude'
            : settings.provider === 'ollama'
              ? 'Ollama'
              : 'Mock';
    return `${providerName}: ${settings.model}`;
  }, []);

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
