import type { ChangeEvent, DragEvent } from 'react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

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
      <div
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition ${
          isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
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
        <p className="text-sm">{isProcessing ? t('upload.processing') : t('upload.dragDrop')}</p>
        {isProcessing && processingStage && (
          <p className="mt-2 text-xs text-muted-foreground">{processingStage}</p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">{t('upload.maxFileSize')}</p>

        {/* Click to browse button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={isProcessing}
          className="mt-4"
        >
          {t('upload.selectFile')}
        </Button>
      </div>
    </>
  );
}
