import {
  db,
  type TaskDetailRecord,
  type TaskRecord,
  type TaskSummaryRecord
} from '@/modules/storage/db';
import type { EvaluationResult } from '@/types/evaluation';
import type { ProviderSettings } from '@/modules/storage/settings';
import type { StyleRecognitionResult } from '@/modules/style/recognizeStyle';

const MAX_TASKS = 10;

export interface SaveTaskInput {
  evaluation: EvaluationResult;
  thumbnailBase64: string;
  fileName?: string;
  selectedAgent?: string;
  styleResult?: StyleRecognitionResult;
  taskSettings?: ProviderSettings;
  processedImage?: {
    base64: string;
    exif: Record<string, string | number>;
    dimensions: { width: number; height: number };
  };
  parentTaskId?: string;
}

export interface SaveTaskSummaryInput {
  taskId?: string;
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

export interface SaveTaskDetailInput {
  evaluationResult?: EvaluationResult | null;
  taskSettings?: ProviderSettings;
  promptUsed?: string;
  processedImage?: {
    base64: string;
    exif: Record<string, string | number>;
    dimensions: { width: number; height: number };
  };
}

export async function saveTask(input: SaveTaskInput) {
  const imageHash = await computeImageHash(input.processedImage?.base64 ?? input.thumbnailBase64);

  // Delete existing records with same imageHash + selectedAgent to avoid duplicates
  // This ensures each image+agent combination only has one (latest) evaluation
  if (imageHash && input.selectedAgent) {
    const existing = await db.tasks
      .where('[imageHash+selectedAgent]')
      .equals([imageHash, input.selectedAgent])
      .toArray();
    if (existing.length) {
      const ids = existing.map((item) => item.taskId);
      await db.tasks.bulkDelete(ids);
      await db.taskDetails.bulkDelete(ids);
    }
  }

  const taskId = crypto.randomUUID();
  const summary: TaskSummaryRecord = {
    taskId,
    parentTaskId: input.parentTaskId,
    timestamp: Date.now(),
    imageHash: imageHash ?? undefined,
    selectedAgent: input.selectedAgent ?? 'unknown',
    styleTags: input.styleResult?.styleTags ?? [],
    thumbnail: input.thumbnailBase64 ? await dataUrlToBlob(input.thumbnailBase64) : undefined
  };

  const details: TaskDetailRecord = {
    taskId,
    evaluationResult: input.evaluation,
    taskSettings: input.taskSettings,
    promptUsed: undefined,
    conversations: undefined
  };

  await db.tasks.add(summary);
  await db.taskDetails.put(details);
  await trimHistory();
  return { ...summary, ...details } satisfies TaskRecord;
}

export async function saveTaskSummary(input: SaveTaskSummaryInput): Promise<TaskSummaryRecord> {
  const imageHash = await computeImageHash(input.processedImage?.base64 ?? input.thumbnailBase64);

  if (imageHash && input.selectedAgent) {
    const existing = await db.tasks
      .where('[imageHash+selectedAgent]')
      .equals([imageHash, input.selectedAgent])
      .toArray();
    if (existing.length) {
      const ids = existing.map((item) => item.taskId);
      await db.tasks.bulkDelete(ids);
      await db.taskDetails.bulkDelete(ids);
    }
  }

  const summary: TaskSummaryRecord = {
    taskId: input.taskId ?? crypto.randomUUID(),
    parentTaskId: input.parentTaskId,
    timestamp: Date.now(),
    imageHash: imageHash ?? undefined,
    selectedAgent: input.selectedAgent ?? 'unknown',
    styleTags: input.styleResult?.styleTags ?? [],
    thumbnail: input.thumbnailBase64 ? await dataUrlToBlob(input.thumbnailBase64) : undefined,
    fileName: input.fileName
  };

  if (input.taskId) {
    await db.tasks.put(summary);
  } else {
    await db.tasks.add(summary);
  }
  await trimHistory();
  return summary;
}

export async function saveTaskDetail(taskId: string, input: SaveTaskDetailInput) {
  const updates = Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined)
  ) as Partial<TaskDetailRecord>;

  if (Object.keys(updates).length === 0) {
    return;
  }

  const updated = await db.taskDetails.update(taskId, updates);
  if (!updated) {
    await db.taskDetails.put({ taskId, ...updates });
  }
}

export async function updateTaskSummary(
  taskId: string,
  updates: Partial<Omit<TaskSummaryRecord, 'taskId' | 'timestamp'>>
) {
  await db.tasks.update(taskId, { ...updates, timestamp: Date.now() });
}

export async function listTasks(): Promise<TaskRecord[]> {
  const summaries = await db.tasks.orderBy('timestamp').reverse().toArray();
  const details = await db.taskDetails.bulkGet(summaries.map((item) => item.taskId));
  return summaries.map((summary, index) => {
    const detail = details[index];
    const legacy = summary as TaskRecord;
    return detail ? { ...legacy, ...detail } : legacy;
  });
}

export async function getTaskById(taskId: string): Promise<TaskRecord | undefined> {
  const summary = await db.tasks.get(taskId);
  if (!summary) {
    return undefined;
  }
  const detail = await db.taskDetails.get(taskId);
  const legacy = summary as TaskRecord;
  return detail ? { ...legacy, ...detail } : legacy;
}

export async function getTaskSettings(taskId: string): Promise<ProviderSettings | null> {
  const detail = await db.taskDetails.get(taskId);
  return detail?.taskSettings ?? null;
}

export async function deleteTask(id: string) {
  await db.tasks.delete(id);
  await db.taskDetails.delete(id);
}

export async function updateTaskSettings(taskId: string, settings: ProviderSettings) {
  const updated = await db.taskDetails.update(taskId, { taskSettings: settings });
  if (!updated) {
    await db.taskDetails.put({ taskId, taskSettings: settings });
  }
}

export async function deleteTasks(ids: string[]) {
  await db.tasks.bulkDelete(ids);
  await db.taskDetails.bulkDelete(ids);
}

export async function clearHistory() {
  await db.tasks.clear();
  await db.taskDetails.clear();
}

export async function findCachedTaskByImageHash(imageHash: string, selectedAgent: string) {
  const matches = await db.tasks.where('imageHash').equals(imageHash).toArray();
  const match = matches.find((task) => task.selectedAgent === selectedAgent);
  if (!match) {
    return null;
  }
  const detail = await db.taskDetails.get(match.taskId);
  const legacy = match as TaskRecord;
  return detail ? { ...legacy, ...detail } : legacy;
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
  const ids = overflow.map((item) => item.taskId);
  await db.tasks.bulkDelete(ids);
  await db.taskDetails.bulkDelete(ids);
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}
