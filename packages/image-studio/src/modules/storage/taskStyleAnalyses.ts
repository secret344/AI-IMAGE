import { db } from '@/modules/storage/db';
import type { TaskStyleAnalysisRecord } from '@/types/StorageRecords';

export interface SaveTaskStyleAnalysisInput {
  taskId: string;
  imageHash?: string;
  imageCode?: string;
  styleTags: Array<{ name: string; weight: number; confidence: number }>;
  modelUsed?: string;
}

export async function saveTaskStyleAnalysis(input: SaveTaskStyleAnalysisInput): Promise<void> {
  try {
    const now = Date.now();
    const record: TaskStyleAnalysisRecord = {
      styleId: input.taskId,
      taskId: input.taskId,
      imageHash: input.imageHash,
      imageCode: input.imageCode,
      styleTags: input.styleTags,
      modelUsed: input.modelUsed,
      createdAt: now,
      updatedAt: now
    };
    await db.taskStyleAnalyses.put(record);
  } catch (error) {
    throw error;
  }
}

export async function getTaskStyleAnalysis(
  taskId: string
): Promise<TaskStyleAnalysisRecord | undefined> {
  try {
    return await db.taskStyleAnalyses.get(taskId);
  } catch (error) {
    throw error;
  }
}

export async function deleteTaskStyleAnalysis(taskId: string): Promise<void> {
  try {
    await db.taskStyleAnalyses.delete(taskId);
  } catch (error) {
    throw error;
  }
}

export async function deleteTaskStyleAnalyses(taskIds: string[]): Promise<void> {
  try {
    await db.taskStyleAnalyses.bulkDelete(taskIds);
  } catch (error) {
    throw error;
  }
}
