import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ui/select';
import { Input } from '@ui/input';
import { Button } from '@ui/button';
import { Label } from '@ui/label';
import type { ProviderId } from './settingsConfig';

interface ModelFieldProps {
  provider: ProviderId;
  model: string;
  onChangeModel: (model: string) => void;
  ollamaModels: string[];
  ollamaStatus: string | null;
  ollamaLoading: boolean;
  onRefreshModels: () => void;
}

export function ModelField({
  provider,
  model,
  onChangeModel,
  ollamaModels,
  ollamaStatus,
  ollamaLoading,
  onRefreshModels
}: ModelFieldProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      <Label htmlFor="model">{t('settings.model')}</Label>
      {provider === 'ollama' ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Select value={model} onValueChange={onChangeModel}>
              <SelectTrigger className="flex-1" id="model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ollamaModels.length === 0 ? (
                  <SelectItem value={model}>{model || t('settings.noModelsDetected')}</SelectItem>
                ) : (
                  ollamaModels.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRefreshModels}
              disabled={ollamaLoading}
            >
              {ollamaLoading ? t('common.loading') : t('settings.refreshModels')}
            </Button>
          </div>
          <Input
            value={model}
            onChange={(event) => onChangeModel(event.target.value)}
            placeholder={t('settings.ollamaModelPlaceholder')}
            className="text-xs"
          />
          {ollamaStatus && <p className="text-xs text-muted-foreground">{ollamaStatus}</p>}
          <p className="text-xs text-muted-foreground">{t('settings.ollamaHint')}</p>
        </div>
      ) : (
        <Input
          value={model}
          onChange={(event) => onChangeModel(event.target.value)}
          placeholder={t('settings.modelPlaceholder')}
          id="model"
        />
      )}
    </div>
  );
}
