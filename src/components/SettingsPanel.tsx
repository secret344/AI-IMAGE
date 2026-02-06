import { useCallback, useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { loadApiKey, saveApiKey } from '@/modules/storage/keys';
import { loadProviderSettings, saveProviderSettings } from '@/modules/storage/settings';
import { clearLocalData } from '@/modules/storage/clearLocalData';
import { healthCheck } from '@/modules/ai/client';
import { ModelField } from '@/components/settings/ModelField';
import { ProviderSelect } from '@/components/settings/ProviderSelect';
import { SettingsFields } from '@/components/settings/SettingsFields';
import {
  FORM_FIELDS_CONFIG,
  PROVIDER_DEFAULTS,
  PROVIDER_OPTIONS
} from '@/components/settings/settingsConfig';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { ProviderId, SettingState } from '@/components/settings/settingsConfig';

export function SettingsPanel() {
  const { t } = useTranslation();
  const settings = loadProviderSettings();
  const [cacheLoaded, setCacheLoaded] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [provider, setProvider] = useState<ProviderId>(settings.provider);
  const [model, setModel] = useState(settings.model);
  const [fallbackModel, setFallbackModel] = useState(settings.fallbackModel ?? '');
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl);
  const [label, setLabel] = useState(settings.keyLabel);
  const [topAgents, setTopAgents] = useState(settings.topAgents ?? 3);
  const [temperature, setTemperature] = useState(settings.temperature ?? 0.2);
  const [maxTokens, setMaxTokens] = useState(settings.maxTokens ?? 1024);
  const [timeoutMs, setTimeoutMs] = useState(settings.timeoutMs ?? 30000);
  const [apiKey, setApiKey] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [clearStatus, setClearStatus] = useState<string | null>(null);
  const [healthStatus, setHealthStatus] = useState<string | null>(null);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [ollamaStatus, setOllamaStatus] = useState<string | null>(null);
  const [ollamaLoading, setOllamaLoading] = useState(false);

  const getFieldValue = useCallback(
    (key: keyof SettingState) => {
      switch (key) {
        case 'topAgents':
          return topAgents;
        case 'temperature':
          return temperature;
        case 'maxTokens':
          return maxTokens;
        case 'timeoutMs':
          return timeoutMs;
        case 'fallbackModel':
          return fallbackModel;
        case 'baseUrl':
          return baseUrl;
        case 'label':
          return label;
        case 'model':
          return model;
        default:
          return '';
      }
    },
    [baseUrl, fallbackModel, label, maxTokens, model, temperature, timeoutMs, topAgents]
  );

  const setFieldValue = useCallback(
    (key: keyof SettingState, value: string | number) => {
      switch (key) {
        case 'topAgents':
          setTopAgents(value as number);
          break;
        case 'temperature':
          setTemperature(value as number);
          break;
        case 'maxTokens':
          setMaxTokens(value as number);
          break;
        case 'timeoutMs':
          setTimeoutMs(value as number);
          break;
        case 'fallbackModel':
          setFallbackModel(value as string);
          break;
        case 'baseUrl':
          setBaseUrl(value as string);
          break;
        case 'label':
          setLabel(value as string);
          break;
        case 'model':
          setModel(value as string);
          break;
        default:
          break;
      }
    },
    [
      setBaseUrl,
      setFallbackModel,
      setLabel,
      setMaxTokens,
      setModel,
      setTemperature,
      setTimeoutMs,
      setTopAgents
    ]
  );

  // 保存和加载用户自定义的模型配置 - MUST run before provider defaults effect
  useEffect(() => {
    const cached = localStorage.getItem('ai-model-cache');
    if (cached) {
      try {
        const config = JSON.parse(cached);
        if (config.provider) setProvider(config.provider as ProviderId);
        if (config.model) setModel(config.model);
        if (config.fallbackModel !== undefined) setFallbackModel(config.fallbackModel);
        if (config.baseUrl) setBaseUrl(config.baseUrl);
        if (config.label) setLabel(config.label);
        if (config.temperature !== undefined) setTemperature(config.temperature);
        if (config.maxTokens !== undefined) setMaxTokens(config.maxTokens);
        if (config.timeoutMs !== undefined) setTimeoutMs(config.timeoutMs);
        if (config.topAgents !== undefined) setTopAgents(config.topAgents);
        setCacheLoaded(true);
        setInitialLoadDone(true);
      } catch {
        setCacheLoaded(true);
        setInitialLoadDone(true);
      }
    } else {
      setCacheLoaded(true);
      setInitialLoadDone(true);
    }
  }, []);

  // Only apply provider defaults on initial load without cache
  useEffect(() => {
    if (!initialLoadDone || cacheLoaded) {
      return;
    }
    const next = PROVIDER_DEFAULTS[provider];
    if (next) {
      setModel(next.model);
      setFallbackModel(next.fallbackModel);
      setBaseUrl(next.baseUrl);
      setLabel(next.keyLabel);
      setTemperature(next.temperature);
      setMaxTokens(next.maxTokens);
      setTimeoutMs(next.timeoutMs);
    }
  }, [initialLoadDone, cacheLoaded, provider]);

  // 当模型配置改变时保存到localStorage（UI状态缓存）
  useEffect(() => {
    const modelCache = {
      provider,
      model,
      fallbackModel,
      baseUrl,
      label,
      temperature,
      maxTokens,
      timeoutMs,
      topAgents
    };
    localStorage.setItem('ai-model-cache', JSON.stringify(modelCache));
  }, [
    provider,
    model,
    fallbackModel,
    baseUrl,
    label,
    temperature,
    maxTokens,
    timeoutMs,
    topAgents
  ]);

  // 自动保存到实际使用的 settings storage
  useEffect(() => {
    if (!cacheLoaded) {
      return; // Don't save during initial load
    }
    saveProviderSettings({
      provider,
      model,
      fallbackModel,
      baseUrl,
      keyLabel: label,
      topAgents,
      temperature,
      maxTokens,
      timeoutMs
    });
    window.dispatchEvent(new Event('settings-updated'));
  }, [
    provider,
    model,
    fallbackModel,
    baseUrl,
    label,
    temperature,
    maxTokens,
    timeoutMs,
    topAgents,
    cacheLoaded
  ]);

  const fetchOllamaModels = useCallback(async () => {
    if (provider !== 'ollama') {
      return;
    }
    setOllamaStatus(null);
    setOllamaLoading(true);
    try {
      const cacheKey = `ollama-models-cache-${baseUrl}`;
      const cachedData = localStorage.getItem(cacheKey);
      const now = Date.now();
      const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache
      // Try to use cached models first
      if (cachedData) {
        try {
          const { models: cachedModels, timestamp } = JSON.parse(cachedData) as {
            models: string[];
            timestamp: number;
          };
          if (now - timestamp < CACHE_TTL) {
            setOllamaModels(cachedModels);
            setOllamaStatus(
              cachedModels.length ? t('settings.ollamaLoaded') : t('settings.ollamaEmpty')
            );
            // Only auto-select first model if current model is not set or not in list
            if (cachedModels.length && (!model || !cachedModels.includes(model))) {
              setModel(cachedModels[0]);
            }
            setOllamaLoading(false);
            return;
          }
        } catch {
          // Invalid cache, proceed to fetch
        }
      }

      const apiUrl = `${baseUrl}/api/tags`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      try {
        const response = await fetch(apiUrl, {
          signal: controller.signal,
          method: 'GET',
          headers: {
            Accept: 'application/json'
          }
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(
            `${t('settings.ollamaFailed')}: ${response.status} ${response.statusText}`
          );
        }

        const data = (await response.json()) as { models?: Array<{ name?: string }> };
        const models = (data.models ?? [])
          .map((item) => item.name)
          .filter((name): name is string => Boolean(name));
        const preferred = models.filter((name) => /vision|llava|qwen|bakllava|llama3/i.test(name));
        const sorted = [...preferred, ...models.filter((name) => !preferred.includes(name))];
        // Cache the models list
        localStorage.setItem(cacheKey, JSON.stringify({ models: sorted, timestamp: now }));

        setOllamaModels(sorted);
        setOllamaStatus(sorted.length ? t('settings.ollamaLoaded') : t('settings.ollamaEmpty'));
        // Only auto-select first model if current model is not set or not in list
        if (sorted.length && (!model || !sorted.includes(model))) {
          setModel(sorted[0]);
        }
      } catch (err) {
        clearTimeout(timeoutId);
        let errorMsg = t('settings.ollamaFailed');

        if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
          errorMsg = `${t('settings.ollamaFailed')} - ${t('settings.ollamaHint')}`;
        } else if (err instanceof Error && err.name === 'AbortError') {
          errorMsg = `${t('settings.ollamaFailed')} - Connection timeout`;
        } else if (err instanceof Error) {
          errorMsg = `${t('settings.ollamaFailed')} - ${err.message}`;
        }

        setOllamaStatus(errorMsg);
      }
    } finally {
      setOllamaLoading(false);
    }
  }, [baseUrl, model, provider, t]);

  useEffect(() => {
    void fetchOllamaModels();
  }, [fetchOllamaModels]);

  const handleSave = useCallback(async () => {
    setStatus(null);
    saveProviderSettings({
      provider,
      model,
      fallbackModel,
      baseUrl,
      keyLabel: label,
      topAgents,
      temperature,
      maxTokens,
      timeoutMs
    });
    window.dispatchEvent(new Event('settings-updated'));
    if (provider === 'ollama') {
      setStatus(t('settings.ollamaSaveSuccess'));
      return;
    }
    if (!apiKey || !passphrase) {
      setStatus(t('settings.settingsSavedPrompt'));
      return;
    }

    await saveApiKey(label, apiKey, passphrase);
    setApiKey('');
    setStatus(t('settings.keySavedSuccess'));
  }, [
    apiKey,
    baseUrl,
    fallbackModel,
    label,
    maxTokens,
    model,
    passphrase,
    provider,
    t,
    temperature,
    timeoutMs,
    topAgents
  ]);

  const handleHealthCheck = useCallback(async () => {
    setHealthStatus(null);
    if (provider === 'mock') {
      setHealthStatus(t('settings.mockProviderReady'));
      return;
    }
    if (provider === 'ollama') {
      setHealthStatus(t('common.loading'));
    }
    const key = apiKey || (await loadApiKey(label, passphrase));
    if (!key && provider !== 'ollama') {
      setHealthStatus(t('result.apiKeyNotFound'));
      return;
    }
    try {
      const start = performance.now();
      await healthCheck({ provider, model, baseUrl, apiKey: key ?? '', timeoutMs });
      const latency = Math.round(performance.now() - start);
      setHealthStatus(`${t('common.success')} · ${latency}${t('result.testLatency')}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.error');
      setHealthStatus(message);
    }
  }, [apiKey, baseUrl, label, model, passphrase, provider, t, timeoutMs]);

  const handleClear = useCallback(async () => {
    await clearLocalData();
    setClearStatus(t('common.success'));
    window.dispatchEvent(new Event('history-updated'));
  }, [t]);

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle>{t('settings.title')}</CardTitle>
        <CardDescription>{t('settings.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ProviderSelect provider={provider} options={PROVIDER_OPTIONS} onChange={setProvider} />

        <ModelField
          provider={provider}
          model={model}
          onChangeModel={setModel}
          ollamaModels={ollamaModels}
          ollamaStatus={ollamaStatus}
          ollamaLoading={ollamaLoading}
          onRefreshModels={fetchOllamaModels}
        />

        <SettingsFields
          fields={FORM_FIELDS_CONFIG.slice(1)}
          getValue={getFieldValue}
          setValue={setFieldValue}
        />

        {/* API key field */}
        <div className="space-y-2">
          <Label htmlFor="apiKey">{t('settings.apiKey')}</Label>
          <Input
            id="apiKey"
            type="password"
            value={apiKey}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setApiKey(event.target.value)}
            placeholder="sk-..."
            disabled={provider === 'ollama'}
          />
        </div>

        {/* Passphrase field */}
        <div className="space-y-2">
          <Label htmlFor="passphrase">{t('settings.passphrase')}</Label>
          <Input
            id="passphrase"
            type="password"
            value={passphrase}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setPassphrase(event.target.value)}
            placeholder={t('settings.passphrase')}
          />
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSave} className="flex-1">
            {t('settings.saveLocally')}
          </Button>
          <Button onClick={handleHealthCheck} variant="outline" className="flex-1">
            {t('settings.testConnection')}
          </Button>
        </div>

        {status && (
          <Alert>
            <AlertDescription>{status}</AlertDescription>
          </Alert>
        )}
        {healthStatus && (
          <Alert>
            <AlertDescription>{healthStatus}</AlertDescription>
          </Alert>
        )}

        <div className="border-t border-border pt-4">
          <Button onClick={handleClear} variant="destructive" className="w-full">
            {t('settings.clearData')}
          </Button>
          {clearStatus && (
            <Alert className="mt-3">
              <AlertDescription>{clearStatus}</AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
