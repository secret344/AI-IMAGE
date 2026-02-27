import { useTranslation } from 'react-i18next';
import { Input } from '@ui/input';
import { Label } from '@ui/label';
import type { FormFieldConfig, SettingState } from './settingsConfig';

interface SettingsFieldsProps {
  fields: FormFieldConfig[];
  getValue: (key: keyof SettingState) => string | number;
  setValue: (key: keyof SettingState, value: string | number) => void;
}

export function SettingsFields({ fields, getValue, setValue }: SettingsFieldsProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      {fields.map((field) => (
        <div key={field.key} className="space-y-2">
          <Label htmlFor={field.key}>{t(field.labelKey)}</Label>
          <Input
            id={field.key}
            type={field.type}
            min={field.min}
            max={field.max}
            step={field.step}
            value={getValue(field.key)}
            onChange={(event) => {
              const value =
                field.type === 'number' ? Number(event.target.value) || 0 : event.target.value;
              setValue(field.key, value);
            }}
            placeholder={field.placeholderKey ? t(field.placeholderKey) : undefined}
          />
        </div>
      ))}
    </div>
  );
}
