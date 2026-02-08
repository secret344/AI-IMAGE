import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { fallbackLanguage, languageCodeSet, resources } from '@/i18n/resources';
import { LANGUAGE_FALLBACK, normalizeLanguage, type LanguageCode } from '@/config/i18n-config';

// Detect user language preference
const getInitialLanguage = (): LanguageCode => {
  // Check localStorage first
  const stored = localStorage.getItem('i18n-language');
  if (stored && languageCodeSet.has(stored)) {
    return stored as LanguageCode;
  }

  // Check browser language
  const browserLang = normalizeLanguage(navigator.language);
  localStorage.setItem('i18n-language', browserLang);
  return browserLang ?? fallbackLanguage ?? LANGUAGE_FALLBACK;
};

i18n.use(initReactI18next).init({
  resources,
  lng: getInitialLanguage(),
  fallbackLng: fallbackLanguage ?? LANGUAGE_FALLBACK,
  interpolation: {
    escapeValue: false
  },
  detection: {
    caches: ['localStorage']
  }
});

export default i18n;
