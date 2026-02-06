import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { ProviderId } from './settingsConfig';

interface ProviderSelectProps {
  provider: ProviderId;
  options: Array<{ value: ProviderId; name: string }>;
  onChange: (provider: ProviderId) => void;
}

export function ProviderSelect({ provider, options, onChange }: ProviderSelectProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      <Label htmlFor="provider">{t('settings.provider')}</Label>
      <Select value={provider} onValueChange={onChange}>
        <SelectTrigger id="provider">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(({ value, name }) => (
            <SelectItem key={value} value={value}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
