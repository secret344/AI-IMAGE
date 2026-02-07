import Dexie, { type Table } from 'dexie';
import type { EvaluationResult, TaskRecord } from '@/types/evaluation';
import type { StyleRecognitionResult } from '@/modules/style/recognizeStyle';

export class AppDatabase extends Dexie {
  tasks!: Table<TaskRecord, string>;

  constructor() {
    super('aiImageDb');
    this.version(1).stores({
      tasks: 'taskId, timestamp, imageHash, [imageHash+selectedAgent]'
    });
  }
}

export const db = new AppDatabase();
