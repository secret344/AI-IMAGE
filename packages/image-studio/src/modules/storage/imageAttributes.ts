import { db } from '@/modules/storage/db';
import type { ImageAttributesRecord } from '@/types/StorageRecords';

export interface SaveImageAttributesInput {
  imageHash: string;
  imageId?: string;
  scale: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
  crop?: { x: number; y: number; width: number; height: number };
  version?: number;
}

export async function getImageAttributes(imageHash: string): Promise<ImageAttributesRecord | null> {
  try {
    const record = await db.imageAttributes.get(imageHash);
    return record ?? null;
  } catch (error) {
    throw error;
  }
}

export async function saveImageAttributes(input: SaveImageAttributesInput): Promise<void> {
  try {
    const now = Date.now();
    const record: ImageAttributesRecord = {
      imageHash: input.imageHash,
      imageId: input.imageId,
      version: input.version ?? 1,
      scale: input.scale,
      offsetX: input.offsetX,
      offsetY: input.offsetY,
      rotation: input.rotation,
      crop: input.crop,
      updatedAt: now
    };
    await db.imageAttributes.put(record);
  } catch (error) {
    throw error;
  }
}

export async function resetImageAttributes(imageHash: string): Promise<void> {
  try {
    await db.imageAttributes.delete(imageHash);
  } catch (error) {
    throw error;
  }
}
