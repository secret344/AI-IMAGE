import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { fallbackLanguage, languageCodeSet, resources } from './resources';
import { LANGUAGE_FALLBACK, normalizeLanguage, type LanguageCode } from '@/config/i18n-config';
import { getHostKernelRuntime } from '@image-studio/runtime/useKernel';

const I18N_LANGUAGE_KEY = 'i18n-language';

function getHostLanguage(): LanguageCode | null {
  const hostLanguage = getHostKernelRuntime()?.i18n.getLanguage();
  if (hostLanguage && languageCodeSet.has(hostLanguage)) {
    return hostLanguage as LanguageCode;
  }
  return null;
}

// Detect user language preference
const getInitialLanguage = (): LanguageCode => {
  const hostLanguage = getHostLanguage();
  if (hostLanguage) {
    localStorage.setItem(I18N_LANGUAGE_KEY, hostLanguage);
    return hostLanguage;
  }

  // Check localStorage first
  const stored = localStorage.getItem(I18N_LANGUAGE_KEY);
  if (stored && languageCodeSet.has(stored)) {
    return stored as LanguageCode;
  }

  // Check browser language
  const browserLang = normalizeLanguage(navigator.language);
  localStorage.setItem(I18N_LANGUAGE_KEY, browserLang);
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
