import { db } from '@/modules/storage/db';
import type { TaskEvaluationRecord } from '@/types/StorageRecords';
import type { EvaluationResult } from '@/types/evaluation';

export interface SaveTaskEvaluationInput {
  taskId: string;
  evaluationResult: EvaluationResult;
  imageHash?: string;
  imageCode?: string;
}

export async function saveTaskEvaluation(input: SaveTaskEvaluationInput): Promise<void> {
  try {
    const now = Date.now();
    const record: TaskEvaluationRecord = {
      evaluationId: input.taskId,
      taskId: input.taskId,
      imageHash: input.imageHash,
      imageCode: input.imageCode,
      evaluationResult: input.evaluationResult,
      createdAt: now,
      updatedAt: now
    };
    await db.taskEvaluations.put(record);
  } catch (error) {
    throw error;
  }
}

export async function getTaskEvaluation(taskId: string): Promise<TaskEvaluationRecord | undefined> {
  try {
    return await db.taskEvaluations.get(taskId);
  } catch (error) {
    throw error;
  }
}

export async function deleteTaskEvaluation(taskId: string): Promise<void> {
  try {
    await db.taskEvaluations.delete(taskId);
  } catch (error) {
    throw error;
  }
}

export async function deleteTaskEvaluations(taskIds: string[]): Promise<void> {
  try {
    await db.taskEvaluations.bulkDelete(taskIds);
  } catch (error) {
    throw error;
  }
}
