import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getAvailableLanguages, normalizeLanguage, type LanguageCode } from '@/config/i18n-config';
import { getHostKernelRuntime } from '@image-studio/runtime/useKernel';

const I18N_LANGUAGE_KEY = 'i18n-language';

interface UseLanguageReturn {
  currentLanguage: LanguageCode;
  switchLanguage: (code: LanguageCode) => void;
  availableLanguages: { code: LanguageCode; name: string }[];
}

export function useLanguage(): UseLanguageReturn {
  const { i18n } = useTranslation();

  useEffect(() => {
    const onHostLanguageChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ language?: string }>;
      const language = normalizeLanguage(customEvent.detail?.language);
      void i18n.changeLanguage(language);
      localStorage.setItem(I18N_LANGUAGE_KEY, language);
    };

    window.addEventListener('host:i18n-language-changed', onHostLanguageChange);

    return () => {
      window.removeEventListener('host:i18n-language-changed', onHostLanguageChange);
    };
  }, [i18n]);

  const switchLanguage = useCallback(
    (lang: LanguageCode) => {
      const normalizedLanguage = normalizeLanguage(lang);
      const hostRuntime = getHostKernelRuntime();

      if (hostRuntime) {
        hostRuntime.i18n.setLanguage(normalizedLanguage);
      } else {
        localStorage.setItem(I18N_LANGUAGE_KEY, normalizedLanguage);
      }

      void i18n.changeLanguage(normalizedLanguage);
    },
    [i18n]
  );

  const currentLanguage = normalizeLanguage(i18n.language);

  return {
    currentLanguage,
    switchLanguage,
    availableLanguages: getAvailableLanguages()
  };
}
