import Dexie, { type Table } from 'dexie';
import type { TaskRecord } from '@/types/evaluation';

export type { TaskRecord } from '@/types/evaluation';

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
