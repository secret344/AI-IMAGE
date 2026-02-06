import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

interface Language {
  code: 'zh' | 'en';
  name: string;
}

interface UseLanguageReturn {
  currentLanguage: 'zh' | 'en';
  switchLanguage: (code: 'zh' | 'en') => void;
  availableLanguages: Language[];
}

export function useLanguage(): UseLanguageReturn {
  const { i18n } = useTranslation();

  const switchLanguage = useCallback(
    (lang: 'zh' | 'en') => {
      i18n.changeLanguage(lang);
      localStorage.setItem('i18n-language', lang);
    },
    [i18n]
  );

  const currentLanguage = (i18n.language as 'zh' | 'en') || 'en';

  return {
    currentLanguage,
    switchLanguage,
    availableLanguages: [
      { code: 'zh', name: '中文' },
      { code: 'en', name: 'English' }
    ] as const
  };
}
