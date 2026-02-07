import { db, type TaskRecord } from '@/modules/storage/db';
import type { EvaluationResult } from '@/types/evaluation';
import type { StyleRecognitionResult } from '@/modules/style/recognizeStyle';

const MAX_TASKS = 10;

export interface SaveTaskInput {
  evaluation: EvaluationResult;
  thumbnailBase64: string;
  fileName?: string;
  selectedAgent?: string;
  styleResult?: StyleRecognitionResult;
  processedImage?: {
    base64: string;
    exif: Record<string, string | number>;
    dimensions: { width: number; height: number };
  };
  parentTaskId?: string;
}

export async function saveTask(input: SaveTaskInput) {
  const imageHash = await computeImageHash(input.processedImage?.base64 ?? input.thumbnailBase64);
  
  // Delete existing records with same imageHash + selectedAgent to avoid duplicates
  // This ensures each image+agent combination only has one (latest) evaluation
  if (imageHash && input.selectedAgent) {
    await db.tasks
      .where('[imageHash+selectedAgent]')
      .equals([imageHash, input.selectedAgent])
      .delete();
  }
  
  const record: TaskRecord = {
    taskId: crypto.randomUUID(),
    parentTaskId: input.parentTaskId,
    timestamp: Date.now(),
    imageHash: imageHash ?? undefined,
    selectedAgent: input.selectedAgent ?? 'unknown',
    styleTags: input.styleResult?.styleTags ?? [],
    evaluationResult: input.evaluation,
    thumbnail: input.thumbnailBase64 ? await dataUrlToBlob(input.thumbnailBase64) : undefined
  };

  await db.tasks.add(record);
  await trimHistory();
  return record;
}

export async function listTasks(): Promise<TaskRecord[]> {
  return db.tasks.orderBy('timestamp').reverse().toArray();
}

export async function deleteTask(id: string) {
  await db.tasks.delete(id);
}

export async function deleteTasks(ids: string[]) {
  await db.tasks.bulkDelete(ids);
}

export async function clearHistory() {
  await db.tasks.clear();
}

export async function findCachedTaskByImageHash(imageHash: string, selectedAgent: string) {
  const matches = await db.tasks.where('imageHash').equals(imageHash).toArray();
  return matches.find((task) => task.selectedAgent === selectedAgent) ?? null;
}

export async function computeImageHash(base64: string | undefined) {
  if (!base64) {
    return null;
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(base64);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function trimHistory() {
  const all = await db.tasks.orderBy('timestamp').reverse().toArray();
  if (all.length <= MAX_TASKS) {
    return;
  }
  const overflow = all.slice(MAX_TASKS);
  await db.tasks.bulkDelete(overflow.map((item) => item.taskId));
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}
