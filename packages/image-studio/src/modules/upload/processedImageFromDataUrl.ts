import type { ProcessedImage } from '@/modules/upload/processImage';

export function processedImageFromDataUrl(
  base64: string,
  originalName = 'history.jpg',
  exif: Record<string, string | number> = {},
  dimensions: { width: number; height: number } = { width: 0, height: 0 }
): ProcessedImage {
  return {
    originalName,
    processedBlob: dataUrlToBlob(base64),
    base64,
    exif,
    dimensions
  };
}

function dataUrlToBlob(dataUrl: string) {
  const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
  if (!match) {
    throw new Error('Invalid data URL.');
  }
  const mimeType = match[1];
  const base64Data = match[2];
  const byteString = atob(base64Data);
  const bytes = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i += 1) {
    bytes[i] = byteString.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}
