import { useTranslation } from 'react-i18next';

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
    <img
      src={src}
      alt={t('upload.previewAlt')}
      className="w-full rounded-lg border border-border"
    />
  );
}
