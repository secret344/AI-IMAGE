import type { ChangeEvent, DragEvent } from 'react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@ui/button';
import { Card, CardContent } from '@ui/card';
import { ImagePlus } from 'lucide-react';

interface UploadDropzoneProps {
  isProcessing: boolean;
  processingStage: string | null;
  isDragging: boolean;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

export function UploadDropzone({
  isProcessing,
  processingStage,
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileChange
}: UploadDropzoneProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      {/* File input - hidden but still accessible for form submission */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        className="hidden"
        onChange={onFileChange}
        aria-hidden="true"
      />

      {/* Dropzone area using div with proper semantics */}
      <Card
        className={`transition ${
          isDragging
            ? 'border-primary/60 bg-primary/5 shadow-md'
            : 'border-border/60 bg-card/40 hover:border-primary/40 hover:shadow-sm'
        }`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            inputRef.current?.click();
          }
        }}
      >
        <CardContent className="flex cursor-pointer flex-col items-center justify-center gap-2 p-6 text-center sm:p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ImagePlus className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium">
            {isProcessing ? t('upload.processing') : t('upload.dragDrop')}
          </p>
          {isProcessing && processingStage && (
            <p className="text-xs text-muted-foreground">{processingStage}</p>
          )}
          <p className="text-xs text-muted-foreground">{t('upload.maxFileSize')}</p>

          {/* Click to browse button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={isProcessing}
            className="mt-3"
          >
            {t('upload.selectFile')}
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
