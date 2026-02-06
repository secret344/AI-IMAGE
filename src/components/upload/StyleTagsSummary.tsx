import { useTranslation } from 'react-i18next';
import type { StyleRecognitionResult } from '@/modules/style/recognizeStyle';

interface StyleTagsSummaryProps {
  styleResult: StyleRecognitionResult | null;
}

export function StyleTagsSummary({ styleResult }: StyleTagsSummaryProps) {
  const { t } = useTranslation();

  if (!styleResult) {
    return null;
  }

  return (
    <div className="text-xs space-y-1">
      <p className="font-semibold">{t('upload.styleTags')}</p>
      <p className="text-muted-foreground">
        {styleResult.styleTags
          .map((tag) => `${t(`styleTags.${tag.name}`)} ${Math.round(tag.weight * 100)}%`)
          .join(' · ')}
      </p>
    </div>
  );
}
