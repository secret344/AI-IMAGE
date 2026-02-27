import { useTranslation } from 'react-i18next';
import { Input } from '@ui/input';
import { Label } from '@ui/label';
import { Button } from '@ui/button';

interface EvaluationControlsProps {
  styleResult: boolean;
  evaluation: boolean;
  isProcessing: boolean;
  passphrase: string;
  highlightRun: boolean;
  onChangePassphrase: (value: string) => void;
  onRun: () => void;
  onRunMock: () => void;
}

export function EvaluationControls({
  styleResult,
  evaluation,
  isProcessing,
  passphrase,
  highlightRun,
  onChangePassphrase,
  onRun,
  onRunMock
}: EvaluationControlsProps) {
  const { t } = useTranslation();

  if (!styleResult || evaluation) {
    return null;
  }

  return (
    <div className="mt-6 space-y-3">
      <Label className="flex flex-col gap-2 text-xs">
        {t('result.passphrase')}
        <Input
          type="password"
          value={passphrase}
          onChange={(event) => onChangePassphrase(event.target.value)}
          placeholder={t('result.passphrasePlaceholder')}
          className="text-sm"
        />
      </Label>
      <Button
        className={`w-full transition ${
          highlightRun ? 'bg-brand-500 text-brand-50 hover:bg-brand-600' : ''
        }`}
        onClick={onRun}
        disabled={isProcessing}
        variant={highlightRun ? 'default' : 'outline'}
      >
        {t('result.runAnalysis')}
      </Button>
      <Button className="w-full" onClick={onRunMock} variant="outline">
        {t('result.runMock')}
      </Button>
    </div>
  );
}
