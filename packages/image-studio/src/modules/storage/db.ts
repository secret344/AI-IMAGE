import Dexie, { type Table } from 'dexie';
import type { TaskDetailRecord, TaskSummaryRecord } from '@/types/evaluation';
import type {
  ImageAssetRecord,
  ImageAttributesRecord,
  TaskConversationRecord,
  TaskEvaluationRecord,
  TaskStyleAnalysisRecord
} from '@/types/StorageRecords';

export type { TaskDetailRecord, TaskRecord, TaskSummaryRecord } from '@/types/evaluation';
export type {
  ImageAssetRecord,
  ImageAttributesRecord,
  TaskConversationRecord,
  TaskEvaluationRecord,
  TaskStyleAnalysisRecord
} from '@/types/StorageRecords';

export class AppDatabase extends Dexie {
  tasks!: Table<TaskSummaryRecord, string>;
  taskDetails!: Table<TaskDetailRecord, string>;
  taskConversations!: Table<TaskConversationRecord, string>;
  taskEvaluations!: Table<TaskEvaluationRecord, string>;
  taskStyleAnalyses!: Table<TaskStyleAnalysisRecord, string>;
  imageAssets!: Table<ImageAssetRecord, string>;
  imageAttributes!: Table<ImageAttributesRecord, string>;

  constructor() {
    super('aiImageDb');
    this.version(1).stores({
      tasks: 'taskId, [imageHash+selectedAgent], timestamp',
      taskDetails: 'taskId'
    });

    this.version(2)
      .stores({
        tasks: 'taskId, [imageHash+selectedAgent], timestamp, imageCode, imageId',
        taskDetails: 'taskId',
        taskConversations: 'conversationId, taskId, imageHash, imageCode, updatedAt',
        taskEvaluations: 'evaluationId, taskId, imageHash, imageCode, createdAt',
        taskStyleAnalyses: 'styleId, taskId, imageHash, imageCode, createdAt',
        imageAssets: 'imageHash, imageId, imageCode, syncState, lastAccessAt',
        imageAttributes: 'imageHash, imageId, updatedAt'
      })
      .upgrade(async (tx) => {
        const tasks = tx.table<TaskSummaryRecord, string>('tasks');
        const taskDetails = tx.table<TaskDetailRecord, string>('taskDetails');
        const taskConversations = tx.table<TaskConversationRecord, string>('taskConversations');
        const taskEvaluations = tx.table<TaskEvaluationRecord, string>('taskEvaluations');
        const taskStyleAnalyses = tx.table<TaskStyleAnalysisRecord, string>('taskStyleAnalyses');
        const imageAssets = tx.table<ImageAssetRecord, string>('imageAssets');

        const summaries = await tasks.toArray();
        const summaryMap = new Map(summaries.map((summary) => [summary.taskId, summary]));
        const details = await taskDetails.toArray();

        for (const detail of details) {
          const summary = summaryMap.get(detail.taskId);
          const imageHash =
            summary?.imageHash ?? (await computeHashFromBase64(detail.processedImage?.base64));
          const imageCode = summary?.imageCode;
          const now = Date.now();

          if (detail.conversations) {
            await taskConversations.put({
              conversationId: detail.taskId,
              taskId: detail.taskId,
              imageHash: imageHash ?? undefined,
              imageCode,
              conversations: detail.conversations,
              createdAt: summary?.timestamp ?? now,
              updatedAt: detail.conversations.defaultThread?.updatedAt ?? now
            });
          }

          if (detail.evaluationResult) {
            await taskEvaluations.put({
              evaluationId: detail.taskId,
              taskId: detail.taskId,
              imageHash: imageHash ?? undefined,
              imageCode,
              evaluationResult: detail.evaluationResult,
              createdAt: summary?.timestamp ?? now,
              updatedAt: now
            });
          }

          if (detail.processedImage?.base64) {
            const existingAsset = imageHash ? await imageAssets.get(imageHash) : undefined;
            if (!existingAsset && imageHash) {
              await imageAssets.put({
                imageHash,
                imageId: summary?.imageId,
                imageCode,
                codeSource: 'local',
                syncState: 'local',
                processedBlob: dataUrlToBlob(detail.processedImage.base64),
                processedBase64: detail.processedImage.base64,
                thumbnailBlob: summary?.thumbnail,
                exif: detail.processedImage.exif,
                dimensions: detail.processedImage.dimensions,
                createdAt: summary?.timestamp ?? now,
                lastAccessAt: summary?.timestamp ?? now
              });
            }
          }
        }

        for (const summary of summaries) {
          if (!summary.styleTags?.length) {
            continue;
          }
          await taskStyleAnalyses.put({
            styleId: summary.taskId,
            taskId: summary.taskId,
            imageHash: summary.imageHash ?? undefined,
            imageCode: summary.imageCode,
            styleTags: summary.styleTags,
            createdAt: summary.timestamp,
            updatedAt: summary.timestamp
          });
        }
      });
  }
}

export const db = new AppDatabase();

async function computeHashFromBase64(base64?: string): Promise<string | null> {
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

function dataUrlToBlob(dataUrl: string): Blob {
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
