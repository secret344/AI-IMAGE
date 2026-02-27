import {
  db,
  type TaskDetailRecord,
  type TaskRecord,
  type TaskSummaryRecord
} from '@/modules/storage/db';
import { getProcessedImageByHash, upsertImageAsset } from '@/modules/storage/imageAssets';
import { saveTaskEvaluation } from '@/modules/storage/taskEvaluations';
import { saveTaskStyleAnalysis } from '@/modules/storage/taskStyleAnalyses';
import type { ProviderSettings } from '@/modules/storage/settings';
import type { StyleRecognitionResult } from '@/modules/style/recognizeStyle';
import type { EvaluationResult } from '@/types/evaluation';

const MAX_TASKS = 10;

/**
 * 保存任务的输入参数
 * 包含完整的评估结果、图片和设置
 */
export interface SaveTaskInput {
  evaluation: EvaluationResult;
  thumbnailBase64: string;
  fileName?: string;
  selectedAgent?: string;
  styleResult?: StyleRecognitionResult;
  taskSettings?: ProviderSettings;
  imageId?: string;
  imageCode?: string;
  processedImage?: {
    base64: string;
    processedBlob?: Blob;
    exif: Record<string, string | number>;
    dimensions: { width: number; height: number };
  };
  parentTaskId?: string;
}

/**
 * 保存任务摘要的输入参数
 * 用于快速保存任务摘要，不含完整的评估结果
 */
export interface SaveTaskSummaryInput {
  taskId?: string;
  thumbnailBase64: string;
  fileName?: string;
  selectedAgent?: string;
  styleResult?: StyleRecognitionResult;
  imageId?: string;
  imageCode?: string;
  processedImage?: {
    base64: string;
    processedBlob?: Blob;
    exif: Record<string, string | number>;
    dimensions: { width: number; height: number };
  };
  parentTaskId?: string;
}

export interface SaveTaskDetailInput {
  evaluationResult?: EvaluationResult | null;
  taskSettings?: ProviderSettings;
  promptUsed?: string;
  imageId?: string;
  imageCode?: string;
  processedImage?: {
    base64: string;
    processedBlob?: Blob;
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
      await db.taskEvaluations.bulkDelete(ids);
      await db.taskStyleAnalyses.bulkDelete(ids);
      await db.taskConversations.bulkDelete(ids);
    }
  }

  const taskId = crypto.randomUUID();
  const summary: TaskSummaryRecord = {
    taskId,
    parentTaskId: input.parentTaskId,
    timestamp: Date.now(),
    imageHash: imageHash ?? undefined,
    imageId: input.imageId,
    imageCode: input.imageCode,
    selectedAgent: input.selectedAgent ?? 'unknown',
    styleTags: input.styleResult?.styleTags ?? [],
    thumbnail: input.thumbnailBase64 ? await dataUrlToBlob(input.thumbnailBase64) : undefined
  };

  const details: TaskDetailRecord = {
    taskId,
    taskSettings: input.taskSettings,
    promptUsed: undefined,
    conversations: undefined
  };

  await db.tasks.add(summary);
  await db.taskDetails.put(details);
  await saveTaskEvaluation({
    taskId,
    evaluationResult: input.evaluation,
    imageHash: imageHash ?? undefined,
    imageCode: input.imageCode
  });
  if (input.styleResult?.styleTags?.length) {
    await saveTaskStyleAnalysis({
      taskId,
      imageHash: imageHash ?? undefined,
      imageCode: input.imageCode,
      styleTags: input.styleResult.styleTags,
      modelUsed: input.styleResult.modelUsed
    });
  }
  if (imageHash && input.processedImage?.base64) {
    const processedBlob =
      input.processedImage.processedBlob ?? (await dataUrlToBlob(input.processedImage.base64));
    await upsertImageAsset({
      imageHash,
      imageId: input.imageId,
      imageCode: input.imageCode,
      processedBlob,
      processedBase64: input.processedImage.base64,
      thumbnailBlob: summary.thumbnail,
      exif: input.processedImage.exif,
      dimensions: input.processedImage.dimensions
    });
  }
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
      await db.taskEvaluations.bulkDelete(ids);
      await db.taskStyleAnalyses.bulkDelete(ids);
      await db.taskConversations.bulkDelete(ids);
    }
  }

  const summary: TaskSummaryRecord = {
    taskId: input.taskId ?? crypto.randomUUID(),
    parentTaskId: input.parentTaskId,
    timestamp: Date.now(),
    imageHash: imageHash ?? undefined,
    imageId: input.imageId,
    imageCode: input.imageCode,
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
  if (input.styleResult?.styleTags?.length) {
    await saveTaskStyleAnalysis({
      taskId: summary.taskId,
      imageHash: imageHash ?? undefined,
      imageCode: input.imageCode,
      styleTags: input.styleResult.styleTags,
      modelUsed: input.styleResult.modelUsed
    });
  }
  if (imageHash && input.processedImage?.base64) {
    const processedBlob =
      input.processedImage.processedBlob ?? (await dataUrlToBlob(input.processedImage.base64));
    await upsertImageAsset({
      imageHash,
      imageId: input.imageId,
      imageCode: input.imageCode,
      processedBlob,
      processedBase64: input.processedImage.base64,
      thumbnailBlob: summary.thumbnail,
      exif: input.processedImage.exif,
      dimensions: input.processedImage.dimensions
    });
  }
  await trimHistory();
  return summary;
}

export async function saveTaskDetail(taskId: string, input: SaveTaskDetailInput) {
  const updates = Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined)
  ) as Partial<SaveTaskDetailInput>;

  if ('evaluationResult' in input) {
    const summary = await db.tasks.get(taskId);
    if (input.evaluationResult) {
      await saveTaskEvaluation({
        taskId,
        evaluationResult: input.evaluationResult,
        imageHash: summary?.imageHash,
        imageCode: summary?.imageCode
      });
    } else {
      await db.taskEvaluations.delete(taskId);
      await db.taskDetails.update(taskId, { evaluationResult: undefined });
    }
    delete updates.evaluationResult;
  }

  if (updates.processedImage?.base64) {
    const summary = await db.tasks.get(taskId);
    const imageHash = summary?.imageHash ?? (await computeImageHash(updates.processedImage.base64));
    if (imageHash) {
      const processedBlob =
        updates.processedImage.processedBlob ??
        (await dataUrlToBlob(updates.processedImage.base64));
      await upsertImageAsset({
        imageHash,
        imageId: input.imageId ?? summary?.imageId,
        imageCode: input.imageCode ?? summary?.imageCode,
        processedBlob,
        processedBase64: updates.processedImage.base64,
        exif: updates.processedImage.exif,
        dimensions: updates.processedImage.dimensions
      });
    }
    delete updates.processedImage;
  }

  if (input.imageId || input.imageCode) {
    await db.tasks.update(taskId, {
      imageId: input.imageId,
      imageCode: input.imageCode,
      timestamp: Date.now()
    });
  }

  const safeUpdates = Object.fromEntries(
    Object.entries(updates).filter(([, value]) => value !== undefined)
  ) as Partial<TaskDetailRecord>;

  if (Object.keys(safeUpdates).length === 0) {
    return;
  }

  const updated = await db.taskDetails.update(taskId, safeUpdates);
  if (!updated) {
    await db.taskDetails.put({ taskId, ...safeUpdates });
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
  const evaluations = await db.taskEvaluations.bulkGet(summaries.map((item) => item.taskId));

  return Promise.all(
    summaries.map(async (summary, index) => {
      const detail = details[index];
      const evaluation = evaluations[index]?.evaluationResult ?? detail?.evaluationResult;
      const processedImage = summary.imageHash
        ? await getProcessedImageByHash(summary.imageHash, summary.fileName ?? 'cached-image')
        : null;
      const legacy = summary as TaskRecord;

      return {
        ...legacy,
        ...detail,
        evaluationResult: evaluation ?? undefined,
        processedImage: processedImage
          ? {
              base64: processedImage.base64,
              exif: processedImage.exif,
              dimensions: processedImage.dimensions
            }
          : detail?.processedImage
      } satisfies TaskRecord;
    })
  );
}

export async function getTaskById(taskId: string): Promise<TaskRecord | undefined> {
  const summary = await db.tasks.get(taskId);
  if (!summary) {
    return undefined;
  }
  const detail = await db.taskDetails.get(taskId);
  const evaluation = await db.taskEvaluations.get(taskId);
  const processedImage = summary.imageHash
    ? await getProcessedImageByHash(summary.imageHash, summary.fileName ?? 'cached-image')
    : null;
  const legacy = summary as TaskRecord;
  return {
    ...legacy,
    ...detail,
    evaluationResult: evaluation?.evaluationResult ?? detail?.evaluationResult,
    processedImage: processedImage
      ? {
          base64: processedImage.base64,
          exif: processedImage.exif,
          dimensions: processedImage.dimensions
        }
      : detail?.processedImage
  } satisfies TaskRecord;
}

export async function getTaskSettings(taskId: string): Promise<ProviderSettings | null> {
  const detail = await db.taskDetails.get(taskId);
  return detail?.taskSettings ?? null;
}

export async function deleteTask(id: string) {
  const summary = await db.tasks.get(id);
  await db.tasks.delete(id);
  await db.taskDetails.delete(id);
  await db.taskConversations.delete(id);
  await db.taskEvaluations.delete(id);
  await db.taskStyleAnalyses.delete(id);
  if (summary?.imageHash) {
    await removeUnusedImageAssets([summary.imageHash]);
  }
}

export async function updateTaskSettings(taskId: string, settings: ProviderSettings) {
  const updated = await db.taskDetails.update(taskId, { taskSettings: settings });
  if (!updated) {
    await db.taskDetails.put({ taskId, taskSettings: settings });
  }
}

export async function deleteTasks(ids: string[]) {
  const summaries = await db.tasks.bulkGet(ids);
  const imageHashes = summaries
    .map((summary) => summary?.imageHash)
    .filter((hash): hash is string => Boolean(hash));
  await db.tasks.bulkDelete(ids);
  await db.taskDetails.bulkDelete(ids);
  await db.taskConversations.bulkDelete(ids);
  await db.taskEvaluations.bulkDelete(ids);
  await db.taskStyleAnalyses.bulkDelete(ids);
  await removeUnusedImageAssets(imageHashes);
}

export async function clearHistory() {
  await db.tasks.clear();
  await db.taskDetails.clear();
  await db.taskConversations.clear();
  await db.taskEvaluations.clear();
  await db.taskStyleAnalyses.clear();
  await db.imageAssets.clear();
  await db.imageAttributes.clear();
}

export async function findCachedTaskByImageHash(imageHash: string, selectedAgent: string) {
  const matches = await db.tasks.where('imageHash').equals(imageHash).toArray();
  const match = matches.find((task) => task.selectedAgent === selectedAgent);
  if (!match) {
    return null;
  }
  const detail = await db.taskDetails.get(match.taskId);
  const evaluation = await db.taskEvaluations.get(match.taskId);
  const processedImage = await getProcessedImageByHash(imageHash, match.fileName ?? 'cached-image');
  const legacy = match as TaskRecord;
  return {
    ...legacy,
    ...detail,
    evaluationResult: evaluation?.evaluationResult ?? detail?.evaluationResult,
    processedImage: processedImage
      ? {
          base64: processedImage.base64,
          exif: processedImage.exif,
          dimensions: processedImage.dimensions
        }
      : detail?.processedImage
  } satisfies TaskRecord;
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
  const imageHashes = overflow
    .map((item) => item.imageHash)
    .filter((hash): hash is string => Boolean(hash));
  await db.tasks.bulkDelete(ids);
  await db.taskDetails.bulkDelete(ids);
  await db.taskConversations.bulkDelete(ids);
  await db.taskEvaluations.bulkDelete(ids);
  await db.taskStyleAnalyses.bulkDelete(ids);
  await removeUnusedImageAssets(imageHashes);
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}

async function removeUnusedImageAssets(imageHashes: string[]): Promise<void> {
  const uniqueHashes = Array.from(new Set(imageHashes.filter(Boolean)));
  if (!uniqueHashes.length) {
    return;
  }

  const unused: string[] = [];
  for (const hash of uniqueHashes) {
    const count = await db.tasks.where('imageHash').equals(hash).count();
    if (count === 0) {
      unused.push(hash);
    }
  }

  if (unused.length) {
    await db.imageAssets.bulkDelete(unused);
    await db.imageAttributes.bulkDelete(unused);
  }
}
