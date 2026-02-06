import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zhMessages from './zh.json';
import enMessages from './en.json';

const resources = {
  zh: {
    translation: zhMessages
  },
  en: {
    translation: enMessages
  }
};

// Detect user language preference
const getInitialLanguage = (): 'zh' | 'en' => {
  // Check localStorage first
  const stored = localStorage.getItem('i18n-language');
  if (stored === 'zh' || stored === 'en') {
    return stored;
  }

  // Check browser language
  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith('zh')) {
    localStorage.setItem('i18n-language', 'zh');
    return 'zh';
  }

  // Default to English
  localStorage.setItem('i18n-language', 'en');
  return 'en';
};

i18n.use(initReactI18next).init({
  resources,
  lng: getInitialLanguage(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false
  },
  detection: {
    caches: ['localStorage']
  }
});

export default i18n;
