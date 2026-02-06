import Dexie, { type Table } from 'dexie';
import type { EvaluationResult } from '@/types/evaluation';
import type { StyleRecognitionResult } from '@/modules/style/recognizeStyle';

export interface TaskRecord {
  id: string;
  parentTaskId?: string;
  createdAt: string;
  fileName?: string;
  agentId?: string;
  imageHash?: string;
  styleResult?: StyleRecognitionResult;
  processedImage?: {
    base64: string;
    exif: Record<string, string | number>;
    dimensions: { width: number; height: number };
  };
  thumbnailBase64: string;
  evaluation: EvaluationResult;
}

export class AppDatabase extends Dexie {
  tasks!: Table<TaskRecord, string>;

  constructor() {
    super('aiImageDb');
    this.version(1).stores({
      tasks: 'id, createdAt, imageHash, [imageHash+agentId]'
    });
  }
}

export const db = new AppDatabase();
