export type ProviderId = 'openai' | 'gemini' | 'claude' | 'ollama' | 'mock';

export type SettingState = {
  model: string;
  fallbackModel: string;
  baseUrl: string;
  label: string;
  topAgents: number;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  contextMaxChars: number;
};

export interface FormFieldConfig {
  key: keyof SettingState;
  labelKey: string;
  type: 'text' | 'password' | 'number' | 'select';
  placeholderKey?: string;
  min?: number;
  max?: number;
  step?: number;
  showIf?: (provider: ProviderId) => boolean;
  disabled?: (provider: ProviderId) => boolean;
}

export const PROVIDER_DEFAULTS: Record<
  ProviderId,
  {
    model: string;
    fallbackModel: string;
    baseUrl: string;
    keyLabel: string;
    temperature: number;
    maxTokens: number;
    timeoutMs: number;
    contextMaxChars: number;
  }
> = {
  openai: {
    model: 'gpt-4o-mini',
    fallbackModel: 'gpt-4o',
    baseUrl: 'https://api.openai.com/v1',
    keyLabel: 'openai',
    temperature: 0.2,
    maxTokens: 1024,
    timeoutMs: 30000,
    contextMaxChars: 4000
  },
  gemini: {
    model: 'gemini-1.5-flash',
    fallbackModel: 'gemini-1.5-pro',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    keyLabel: 'gemini',
    temperature: 0.2,
    maxTokens: 1024,
    timeoutMs: 30000,
    contextMaxChars: 4000
  },
  claude: {
    model: 'claude-3-5-sonnet-20241022',
    fallbackModel: 'claude-3-5-haiku-20241022',
    baseUrl: 'https://api.anthropic.com/v1',
    keyLabel: 'claude',
    temperature: 0.2,
    maxTokens: 1024,
    timeoutMs: 30000,
    contextMaxChars: 4000
  },
  ollama: {
    model: 'llama3.2-vision:latest',
    fallbackModel: '',
    baseUrl: 'http://localhost:11434',
    keyLabel: 'ollama',
    temperature: 0.2,
    maxTokens: 1024,
    timeoutMs: 30000,
    contextMaxChars: 4000
  },
  mock: {
    model: 'mock',
    fallbackModel: '',
    baseUrl: 'local',
    keyLabel: 'mock',
    temperature: 0,
    maxTokens: 256,
    timeoutMs: 5000,
    contextMaxChars: 2000
  }
};

export const PROVIDER_OPTIONS: Array<{ value: ProviderId; name: string }> = [
  { value: 'openai', name: 'OpenAI' },
  { value: 'gemini', name: 'Gemini' },
  { value: 'claude', name: 'Claude' },
  { value: 'ollama', name: 'Ollama' },
  { value: 'mock', name: 'Mock' }
];

export const FORM_FIELDS_CONFIG: FormFieldConfig[] = [
  {
    key: 'model',
    labelKey: 'settings.modelLabel',
    type: 'text',
    placeholderKey: 'settings.modelPlaceholder'
  },
  {
    key: 'fallbackModel',
    labelKey: 'settings.fallbackModelLabel',
    type: 'text',
    placeholderKey: 'settings.fallbackModelPlaceholder'
  },
  {
    key: 'baseUrl',
    labelKey: 'settings.baseUrlLabel',
    type: 'text',
    placeholderKey: 'settings.baseUrlPlaceholder'
  },
  {
    key: 'label',
    labelKey: 'settings.keyLabelLabel',
    type: 'text',
    placeholderKey: 'settings.keyLabelPlaceholder'
  },
  {
    key: 'topAgents',
    labelKey: 'settings.topAgentsLabel',
    type: 'number',
    min: 1,
    max: 5
  },
  {
    key: 'temperature',
    labelKey: 'settings.temperatureLabel',
    type: 'number',
    min: 0,
    max: 2,
    step: 0.1
  },
  {
    key: 'maxTokens',
    labelKey: 'settings.maxTokensLabel',
    type: 'number',
    min: 128,
    max: 4096
  },
  {
    key: 'timeoutMs',
    labelKey: 'settings.timeoutLabel',
    type: 'number',
    min: 5000,
    max: 120000
  },
  {
    key: 'contextMaxChars',
    labelKey: 'settings.contextMaxCharsLabel',
    type: 'number',
    min: 500,
    max: 20000,
    step: 100
  }
];
