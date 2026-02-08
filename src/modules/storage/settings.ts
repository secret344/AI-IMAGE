import { useAppStore } from '@/state/useAppStore';

/**
 * AI 提供商设置
 * 包含模型、API 配置和生成参数
 */
export interface ProviderSettings {
  provider: 'openai' | 'gemini' | 'claude' | 'ollama' | 'mock';
  model: string;
  fallbackModel?: string;
  baseUrl: string;
  keyLabel: string;
  topAgents: number;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  contextMaxChars: number;
}

const STORAGE_KEY = 'ai-image-provider-settings';

const DEFAULT_SETTINGS: ProviderSettings = {
  provider: 'openai',
  model: 'gpt-4o-mini',
  fallbackModel: '',
  baseUrl: 'https://api.openai.com/v1',
  keyLabel: 'openai',
  topAgents: 3,
  temperature: 0.2,
  maxTokens: 1024,
  timeoutMs: 30000,
  contextMaxChars: 4000
};

export function hydrateProviderSettings(): ProviderSettings {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return DEFAULT_SETTINGS;
  }

  try {
    return JSON.parse(raw) as ProviderSettings;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function loadProviderSettings(): ProviderSettings {
  return useAppStore.getState().globalProviderSettings ?? DEFAULT_SETTINGS;
}

export function getDefaultProviderSettings(): ProviderSettings {
  return DEFAULT_SETTINGS;
}

export function saveProviderSettings(settings: ProviderSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  useAppStore.getState().setGlobalProviderSettings(settings);
}
