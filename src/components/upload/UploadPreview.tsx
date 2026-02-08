import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';

interface UploadPreviewProps {
  processedImageBase64: string | null;
  previewImageBase64: string | null;
}

export function UploadPreview({ processedImageBase64, previewImageBase64 }: UploadPreviewProps) {
  const { t } = useTranslation();
  const src = processedImageBase64 ?? previewImageBase64;

  if (!src) {
    return null;
  }

  return (
    <Card className="border-border/60 bg-card/40">
      <CardContent className="p-2">
        <img
          src={src}
          alt={t('upload.previewAlt')}
          className="w-full rounded-md border border-border/50 object-cover"
        />
      </CardContent>
    </Card>
  );
}
