import { db } from '@/modules/storage/db';
import type { ProviderSettings } from '@/modules/storage/settings';

export interface TaskSettingsRecord {
  taskId: string;
  settings: ProviderSettings;
  updatedAt: number;
}

export async function saveTaskSettings(taskId: string, settings: ProviderSettings) {
  await db.taskDetails.update(taskId, { taskSettings: settings });
}

export async function loadTaskSettings(taskId: string): Promise<ProviderSettings | null> {
  const record = await db.taskDetails.get(taskId);
  return record?.taskSettings ?? null;
}

export async function deleteTaskSettings(taskId: string) {
  await db.taskDetails.update(taskId, { taskSettings: undefined });
}
