import imageCompression from 'browser-image-compression';
import { extractExif } from '@/lib/exif';

/**
 * 处理后的图片信息
 * 包含原始文件名、处理后的 Blob、Base64 编码、EXIF 和尺寸
 */
export interface ProcessedImage {
  originalName: string;
  processedBlob: Blob;
  base64: string;
  exif: Record<string, string | number>;
  dimensions: { width: number; height: number };
  processingTime?: number;
}

const SUPPORTED_FORMATS = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

const MAX_EDGE_DESKTOP = 4096;
const MAX_EDGE_MOBILE = 2048;

function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

export async function processImage(file: File): Promise<ProcessedImage> {
  const startTime = performance.now();

  // 1. Format validation per V1 Technical Spec
  if (!SUPPORTED_FORMATS.includes(file.type)) {
    throw new Error(
      `Unsupported format. Please use JPEG, PNG, WebP or HEIC. Current: ${file.type || 'unknown'}`
    );
  }
  // 2. EXIF extraction
  const exif = await extractExif(file);

  // 3. Adaptive compression per V1 Technical Spec
  const maxEdge = isMobileDevice() ? MAX_EDGE_MOBILE : MAX_EDGE_DESKTOP;
  const compressedBlob = await imageCompression(file, {
    maxWidthOrHeight: maxEdge,
    useWebWorker: true,
    maxSizeMB: 5,
    initialQuality: 0.85, // Per spec: quality 0.85
    fileType: 'image/jpeg'
  });

  const base64 = await imageCompression.getDataUrlFromFile(compressedBlob);
  const bitmap = await createImageBitmap(compressedBlob);

  const processingTime = Math.round(performance.now() - startTime);

  return {
    originalName: file.name,
    processedBlob: compressedBlob,
    base64,
    exif,
    dimensions: { width: bitmap.width, height: bitmap.height },
    processingTime
  };
}
