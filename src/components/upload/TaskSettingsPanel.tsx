/**
 * 任务级设置面板（弹框形式）
 * 在上传阶段通过弹框配置当前任务的AI模型参数
 * 不影响全局设置，仅用于当前任务
 */

import { useCallback, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProviderSettings } from '@/modules/storage/settings';
import { getDefaultProviderSettings } from '@/modules/storage/settings';
import { useTaskContext } from '@/state/TaskContext';
import { ModelField } from '@/components/settings/ModelField';
import { ProviderSelect } from '@/components/settings/ProviderSelect';
import {
  PROVIDER_DEFAULTS,
  PROVIDER_OPTIONS,
  type ProviderId
} from '@/components/settings/settingsConfig';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { Settings } from 'lucide-react';

export function TaskSettingsPanel() {
  const { t } = useTranslation();
  const {
    globalProviderSettings,
    taskSettings,
    taskSettingsDraft,
    setTaskSettings,
    setTaskSettingsDraft
  } = useTaskContext();

  // 使用全局设置初始化任务设置
  const globalSettings = globalProviderSettings ?? getDefaultProviderSettings();
  const effectiveSettings = taskSettingsDraft ?? taskSettings ?? globalSettings;
  const displaySettings = taskSettings ?? taskSettingsDraft ?? globalSettings;
  const provider = effectiveSettings.provider as ProviderId;
  const model = effectiveSettings.model;
  const baseUrl = effectiveSettings.baseUrl;
  const temperature = effectiveSettings.temperature;
  const maxTokens = effectiveSettings.maxTokens;
  const contextMaxChars = effectiveSettings.contextMaxChars;
  const [isOpen, setIsOpen] = useState(false);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [ollamaLoading, setOllamaLoading] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      return;
    }
    setTaskSettingsDraft(taskSettings ?? globalSettings);
  }, [globalSettings, isOpen, setTaskSettingsDraft, taskSettings]);

  const fetchOllamaModels = useCallback(async () => {
    if (provider !== 'ollama') {
      return;
    }
    setOllamaStatus(null);
    setOllamaLoading(true);

    if (/openai\.com/i.test(baseUrl)) {
      setOllamaStatus(t('settings.ollamaHint'));
      setOllamaLoading(false);
      return;
    }

    const cacheKey = `ollama-models-cache-${baseUrl}`;
    const now = Date.now();
    const CACHE_TTL = 5 * 60 * 1000;
    const cachedData = localStorage.getItem(cacheKey);
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
          if (cachedModels.length && (!model || !cachedModels.includes(model))) {
            setTaskSettingsDraft({
              ...effectiveSettings,
              model: cachedModels[0]
            });
          }
          setOllamaLoading(false);
          return;
        }
      } catch {
        // ignore cache parse errors
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
        throw new Error(`${t('settings.ollamaFailed')}: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as { models?: Array<{ name?: string }> };
      const models = (data.models ?? [])
        .map((item) => item.name)
        .filter((name): name is string => Boolean(name));
      const preferred = models.filter((name) => /vision|llava|qwen|bakllava|llama3/i.test(name));
      const sorted = [...preferred, ...models.filter((name) => !preferred.includes(name))];

      localStorage.setItem(cacheKey, JSON.stringify({ models: sorted, timestamp: now }));

      setOllamaModels(sorted);
      setOllamaStatus(sorted.length ? t('settings.ollamaLoaded') : t('settings.ollamaEmpty'));
      if (sorted.length && (!model || !sorted.includes(model))) {
        setTaskSettingsDraft({
          ...effectiveSettings,
          model: sorted[0]
        });
      }
    } catch (err) {
      clearTimeout(timeoutId);
      let errorMsg = t('settings.ollamaFailed');

      if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
        errorMsg = `${t('settings.ollamaFailed')} - ${t('settings.ollamaHint')}`;
      } else if (err instanceof Error && err.name === 'AbortError') {
        errorMsg = `${t('settings.ollamaFailed')} - ${t('settings.ollamaTimeout')}`;
      } else if (err instanceof Error) {
        errorMsg = `${t('settings.ollamaFailed')} - ${err.message}`;
      }

      setOllamaStatus(errorMsg);
    } finally {
      setOllamaLoading(false);
    }
  }, [baseUrl, effectiveSettings, model, provider, setTaskSettingsDraft, t]);

  useEffect(() => {
    if (isOpen && provider === 'ollama') {
      void fetchOllamaModels();
    }
  }, [fetchOllamaModels, isOpen, provider]);

  const handleSave = useCallback(() => {
    const updatedSettings: ProviderSettings = {
      ...effectiveSettings,
      provider,
      model,
      baseUrl,
      temperature,
      maxTokens,
      contextMaxChars,
      keyLabel: PROVIDER_DEFAULTS[provider].keyLabel
    };

    setTaskSettings(updatedSettings);
    setIsOpen(false);
  }, [
    baseUrl,
    contextMaxChars,
    effectiveSettings,
    maxTokens,
    model,
    provider,
    setTaskSettings,
    temperature
  ]);

  const handleReset = useCallback(() => {
    setTaskSettingsDraft(globalSettings);
  }, [globalSettings, setTaskSettingsDraft]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="h-4 w-4" />
          {displaySettings
            ? `${displaySettings.provider} / ${displaySettings.model}`
            : t('settings.configureTask')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('settings.taskSettings')}</DialogTitle>
          <DialogDescription>{t('settings.taskSettingsDescription')}</DialogDescription>
          {provider === 'ollama' && (ollamaLoading || ollamaStatus) && (
            <p className="text-xs text-muted-foreground">
              {ollamaLoading ? t('common.loading') : ollamaStatus}
            </p>
          )}
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* 提供商选择 */}
          <ProviderSelect
            provider={provider}
            options={PROVIDER_OPTIONS}
            onChange={(nextProvider) => {
              const defaults = PROVIDER_DEFAULTS[nextProvider];
              setTaskSettingsDraft({
                ...effectiveSettings,
                provider: nextProvider,
                model: defaults.model,
                baseUrl: defaults.baseUrl,
                temperature: defaults.temperature,
                maxTokens: defaults.maxTokens,
                contextMaxChars: defaults.contextMaxChars,
                keyLabel: defaults.keyLabel
              });
            }}
          />

          {/* 模型选择 */}
          <ModelField
            provider={provider}
            model={model}
            onChangeModel={(nextModel) =>
              setTaskSettingsDraft({
                ...effectiveSettings,
                model: nextModel
              })
            }
            ollamaModels={ollamaModels}
            ollamaStatus={ollamaStatus}
            ollamaLoading={ollamaLoading}
            onRefreshModels={fetchOllamaModels}
          />

          {/* BaseURL */}
          <div className="space-y-2">
            <Label className="text-sm">{t('settings.baseUrl')}</Label>
            <Input
              type="text"
              value={baseUrl}
              onChange={(e) =>
                setTaskSettingsDraft({
                  ...effectiveSettings,
                  baseUrl: e.target.value
                })
              }
              placeholder={PROVIDER_DEFAULTS[provider].baseUrl}
              className="text-sm"
            />
          </div>

          {/* 温度参数 */}
          <div className="space-y-2">
            <Label className="text-sm">
              {t('settings.temperature')} ({temperature.toFixed(2)})
            </Label>
            <Input
              type="number"
              value={temperature}
              onChange={(e) =>
                setTaskSettingsDraft({
                  ...effectiveSettings,
                  temperature: parseFloat(e.target.value)
                })
              }
              min="0"
              max="2"
              step="0.1"
              className="text-sm"
            />
          </div>

          {/* 最大tokens */}
          <div className="space-y-2">
            <Label className="text-sm">
              {t('settings.maxTokens')} ({maxTokens})
            </Label>
            <Input
              type="number"
              value={maxTokens}
              onChange={(e) =>
                setTaskSettingsDraft({
                  ...effectiveSettings,
                  maxTokens: parseInt(e.target.value)
                })
              }
              min="100"
              max="4000"
              step="100"
              className="text-sm"
            />
          </div>

          {/* 上下文长度限制 */}
          <div className="space-y-2">
            <Label className="text-sm">
              {t('settings.contextMaxCharsLabel')} ({contextMaxChars})
            </Label>
            <Input
              type="number"
              value={contextMaxChars}
              onChange={(e) =>
                setTaskSettingsDraft({
                  ...effectiveSettings,
                  contextMaxChars: parseInt(e.target.value)
                })
              }
              min="500"
              max="20000"
              step="100"
              className="text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleReset}>
            {t('common.reset')}
          </Button>
          <Button onClick={handleSave}>{t('common.apply')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
