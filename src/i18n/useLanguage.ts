import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { getAvailableLanguages, normalizeLanguage, type LanguageCode } from '@/config/i18n-config';

interface UseLanguageReturn {
  currentLanguage: LanguageCode;
  switchLanguage: (code: LanguageCode) => void;
  availableLanguages: { code: LanguageCode; name: string }[];
}

export function useLanguage(): UseLanguageReturn {
  const { i18n } = useTranslation();

  const switchLanguage = useCallback(
    (lang: LanguageCode) => {
      i18n.changeLanguage(lang);
      localStorage.setItem('i18n-language', lang);
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
