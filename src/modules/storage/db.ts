import Dexie, { type Table } from 'dexie';
import type { TaskRecord } from '@/types/evaluation';

export type { TaskRecord } from '@/types/evaluation';

export class AppDatabase extends Dexie {
  tasks!: Table<TaskRecord, string>;

  constructor() {
    super('aiImageDb');
    this.version(1).stores({
      tasks: 'taskId, [imageHash+selectedAgent], timestamp'
    });
  }
}

export const db = new AppDatabase();
