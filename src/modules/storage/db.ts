import Dexie, { type Table } from 'dexie';
import type { TaskDetailRecord, TaskSummaryRecord } from '@/types/evaluation';

export type { TaskDetailRecord, TaskRecord, TaskSummaryRecord } from '@/types/evaluation';

export class AppDatabase extends Dexie {
  tasks!: Table<TaskSummaryRecord, string>;
  taskDetails!: Table<TaskDetailRecord, string>;

  constructor() {
    super('aiImageDb');
    this.version(1).stores({
      tasks: 'taskId, [imageHash+selectedAgent], timestamp',
      taskDetails: 'taskId'
    });
  }
}

export const db = new AppDatabase();
