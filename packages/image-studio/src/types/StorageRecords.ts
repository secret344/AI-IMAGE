export type SyncState = 'local' | 'pending' | 'synced' | 'conflict';

export type CodeSource = 'local' | 'server';

export interface ImageAssetRecord {
  imageHash: string;
  imageId?: string;
  imageCode?: string;
  codeSource: CodeSource;
  syncState: SyncState;
  processedBlob?: Blob;
  processedBase64?: string;
  thumbnailBlob?: Blob;
  exif?: Record<string, string | number>;
  dimensions?: { width: number; height: number };
  createdAt: number;
  lastAccessAt: number;
}

export interface ImageAttributesRecord {
  imageHash: string;
  imageId?: string;
  version: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
  crop?: { x: number; y: number; width: number; height: number };
  updatedAt: number;
}

export interface TaskConversationRecord {
  conversationId: string;
  taskId: string;
  imageHash?: string;
  imageCode?: string;
  conversations: import('@/types/conversation').TaskConversationData;
  createdAt: number;
  updatedAt: number;
}

export interface TaskEvaluationRecord {
  evaluationId: string;
  taskId: string;
  imageHash?: string;
  imageCode?: string;
  evaluationResult: import('@/types/evaluation').EvaluationResult;
  createdAt: number;
  updatedAt: number;
}

export interface TaskStyleAnalysisRecord {
  styleId: string;
  taskId: string;
  imageHash?: string;
  imageCode?: string;
  styleTags: Array<{ name: string; weight: number; confidence: number }>;
  modelUsed?: string;
  createdAt: number;
  updatedAt: number;
}
