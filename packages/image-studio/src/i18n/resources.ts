export interface LocaleMeta {
  languageCode: string;
  displayName?: string;
  promptLanguageLabel?: string;
}

/**
 * 风格识别相关的国际化数据
 */
export interface StyleRecognitionLocale {
  mockDescription?: string;
  descriptionPrefix?: string;
}

/**
 * 国际化消息结合体
 * 包含语言元数据和各模块的翻译文本
 */
export interface LocaleMessages {
  meta?: LocaleMeta;
  styleRecognition?: StyleRecognitionLocale;
  [key: string]: unknown;
}

const localeModules = import.meta.glob('./locales/*.json', { eager: true });

const IMAGE_STUDIO_BLOCKED_NAMESPACES = new Set(['investment']);

function sanitizeImageStudioLocale(messages: LocaleMessages): LocaleMessages {
  return Object.fromEntries(
    Object.entries(messages).filter(([key]) => !IMAGE_STUDIO_BLOCKED_NAMESPACES.has(key))
  ) as LocaleMessages;
}

const resources: Record<string, { translation: LocaleMessages }> = {};
const languageMeta: { code: string; name: string; promptLabel: string }[] = [];
const languageCodeSet = new Set<string>();
const localeMessagesByCode: Record<string, LocaleMessages> = {};

for (const module of Object.values(localeModules)) {
  const rawMessages =
    (module as { default?: LocaleMessages }).default ?? (module as LocaleMessages);
  const messages = sanitizeImageStudioLocale(rawMessages);
  const code = messages?.meta?.languageCode;
  if (!code) {
    continue;
  }
  const displayName = messages.meta?.displayName ?? code;
  const promptLabel = messages.meta?.promptLanguageLabel ?? displayName;
  resources[code] = { translation: messages };
  languageMeta.push({ code, name: displayName, promptLabel });
  languageCodeSet.add(code);
  localeMessagesByCode[code] = messages;
}

const fallbackLanguage =
  languageMeta.find((lang) => lang.code === 'en')?.code ?? languageMeta[0]?.code ?? 'en';

export { resources, languageMeta, languageCodeSet, fallbackLanguage, localeMessagesByCode };

export function getLocaleMessages(code?: string): LocaleMessages | undefined {
  if (!code) {
    return undefined;
  }
  return localeMessagesByCode[code];
}
