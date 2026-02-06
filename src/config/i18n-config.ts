import {
  fallbackLanguage,
  languageCodeSet,
  languageMeta,
  getLocaleMessages
} from '@/i18n/resources';

export type LanguageCode = string;

export const LANGUAGE_FALLBACK: LanguageCode = fallbackLanguage;

export const LANGUAGE_CONFIG = languageMeta;

export const LANGUAGE_CODE_SET = languageCodeSet;

export function isSupportedLanguage(input?: string): input is LanguageCode {
  if (!input) {
    return false;
  }
  return LANGUAGE_CODE_SET.has(input);
}

export function normalizeLanguage(input?: string): LanguageCode {
  if (input) {
    const normalized = input.toLowerCase();
    if (normalized.startsWith('zh')) {
      return 'zh';
    }
    if (normalized.startsWith('en')) {
      return 'en';
    }
    if (LANGUAGE_CODE_SET.has(normalized)) {
      return normalized;
    }
  }
  return LANGUAGE_FALLBACK;
}

export function getLanguageDisplayName(code: LanguageCode): string {
  return LANGUAGE_CONFIG.find((lang) => lang.code === code)?.name ?? 'English';
}

export function getLanguagePromptLabel(code: LanguageCode): string {
  return LANGUAGE_CONFIG.find((lang) => lang.code === code)?.promptLabel ?? 'English';
}

export function getAvailableLanguages(): { code: LanguageCode; name: string }[] {
  return LANGUAGE_CONFIG.map((lang) => ({ code: lang.code, name: lang.name }));
}

export function getStyleRecognitionI18n(code: LanguageCode): {
  mockDescription: string;
  descriptionPrefix: string;
} {
  const current = getLocaleMessages(code)?.styleRecognition ?? {};
  const fallback = getLocaleMessages(LANGUAGE_FALLBACK)?.styleRecognition ?? {};
  return {
    mockDescription:
      current.mockDescription
      ?? fallback.mockDescription
      ?? 'Preliminary style analysis.',
    descriptionPrefix:
      current.descriptionPrefix
      ?? fallback.descriptionPrefix
      ?? 'Preliminary style: '
  };
}
