import { db, type TaskRecord } from '@/modules/storage/db';
import type { EvaluationResult } from '@/types/evaluation';
import type { StyleRecognitionResult } from '@/modules/style/recognizeStyle';

const MAX_TASKS = 10;

export interface SaveTaskInput {
  evaluation: EvaluationResult;
  thumbnailBase64: string;
  fileName?: string;
  agentId?: string;
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
  
  // Delete existing records with same imageHash + agentId to avoid duplicates
  // This ensures each image+agent combination only has one (latest) evaluation
  if (imageHash && input.agentId) {
    await db.tasks
      .where('[imageHash+agentId]')
      .equals([imageHash, input.agentId])
      .delete();
  }
  
  const record: TaskRecord = {
    id: crypto.randomUUID(),
    parentTaskId: input.parentTaskId,
    createdAt: new Date().toISOString(),
    fileName: input.fileName,
    agentId: input.agentId,
    imageHash: imageHash ?? undefined,
    styleResult: input.styleResult,
    processedImage: input.processedImage,
    thumbnailBase64: input.thumbnailBase64,
    evaluation: input.evaluation
  };

  await db.tasks.add(record);
  await trimHistory();
  return record;
}

export async function listTasks(): Promise<TaskRecord[]> {
  return db.tasks.orderBy('createdAt').reverse().toArray();
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

export async function findCachedTaskByImageHash(imageHash: string, agentId: string) {
  const matches = await db.tasks.where('imageHash').equals(imageHash).toArray();
  return matches.find((task) => task.agentId === agentId) ?? null;
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
  const all = await db.tasks.orderBy('createdAt').reverse().toArray();
  if (all.length <= MAX_TASKS) {
    return;
  }
  const overflow = all.slice(MAX_TASKS);
  await db.tasks.bulkDelete(overflow.map((item) => item.id));
}
