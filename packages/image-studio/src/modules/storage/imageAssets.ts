import { db } from '@/modules/storage/db';
import { processedImageFromDataUrl } from '@/modules/upload/processedImageFromDataUrl';
import type { ProcessedImage } from '@/modules/upload/processImage';
import type { ImageAssetRecord } from '@/types/StorageRecords';

export interface UpsertImageAssetInput {
  imageHash: string;
  imageId?: string;
  imageCode?: string;
  processedBlob?: Blob;
  processedBase64?: string;
  thumbnailBlob?: Blob;
  exif?: Record<string, string | number>;
  dimensions?: { width: number; height: number };
  codeSource?: ImageAssetRecord['codeSource'];
  syncState?: ImageAssetRecord['syncState'];
}

export async function upsertImageAsset(input: UpsertImageAssetInput): Promise<ImageAssetRecord> {
  try {
    const existing = await db.imageAssets.get(input.imageHash);
    const now = Date.now();
    const next: ImageAssetRecord = {
      imageHash: input.imageHash,
      imageId: input.imageId ?? existing?.imageId,
      imageCode: input.imageCode ?? existing?.imageCode,
      codeSource: input.codeSource ?? existing?.codeSource ?? 'local',
      syncState: input.syncState ?? existing?.syncState ?? 'local',
      processedBlob: input.processedBlob ?? existing?.processedBlob,
      processedBase64: input.processedBase64 ?? existing?.processedBase64,
      thumbnailBlob: input.thumbnailBlob ?? existing?.thumbnailBlob,
      exif: input.exif ?? existing?.exif,
      dimensions: input.dimensions ?? existing?.dimensions,
      createdAt: existing?.createdAt ?? now,
      lastAccessAt: now
    };

    await db.imageAssets.put(next);
    return next;
  } catch (error) {
    throw error;
  }
}

export async function getImageAssetByHash(
  imageHash: string
): Promise<ImageAssetRecord | undefined> {
  try {
    return await db.imageAssets.get(imageHash);
  } catch (error) {
    throw error;
  }
}

export async function touchImageAsset(imageHash: string): Promise<void> {
  try {
    await db.imageAssets.update(imageHash, { lastAccessAt: Date.now() });
  } catch (error) {
    throw error;
  }
}

export async function removeImageAssetsByHash(imageHashes: string[]): Promise<void> {
  try {
    await db.imageAssets.bulkDelete(imageHashes);
  } catch (error) {
    throw error;
  }
}

export async function getProcessedImageByHash(
  imageHash: string,
  fallbackName: string
): Promise<ProcessedImage | null> {
  try {
    const asset = await db.imageAssets.get(imageHash);
    if (!asset) {
      return null;
    }

    const base64 =
      asset.processedBase64 ??
      (asset.processedBlob ? await blobToDataUrl(asset.processedBlob) : null);
    if (!base64) {
      return null;
    }

    if (!asset.processedBase64) {
      await db.imageAssets.update(imageHash, { processedBase64: base64 });
    }

    await touchImageAsset(imageHash);
    return processedImageFromDataUrl(
      base64,
      fallbackName,
      asset.exif ?? {},
      asset.dimensions ?? { width: 0, height: 0 }
    );
  } catch (error) {
    throw error;
  }
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert blob to data URL.'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read blob.'));
    reader.readAsDataURL(blob);
  });
}
