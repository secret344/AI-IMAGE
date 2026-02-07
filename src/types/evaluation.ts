import type { TaskConversationData } from './conversation';

export type DimensionName = 'Composition' | 'Lighting' | 'Color' | 'Subject';

export interface EvaluationDimension {
  name: DimensionName;
  score: number;
  reason: string;
}

export interface RetouchStep {
  tool: 'Lightroom' | 'Photoshop';
  step: string;
  action: string;
  values?: Record<string, number>;
  reason: string;
}

export interface EvaluationResult {
  score: number;
  dimensions: EvaluationDimension[];
  shootingTips: string[];
  retouchPlan: RetouchStep[];
  raw?: unknown;
}

/** 任务记录，包含评估结果和关联的聊天数据 */
export interface TaskRecord {
  taskId: string;
  parentTaskId?: string; // 迭代链
  timestamp: number;     // 创建时间，用于排序（可能不唯一）
  imageHash?: string;    // 图片哈希值，用于去重（可空）
  thumbnail?: Blob;
  styleTags: Array<{ name: string; weight: number; confidence: number }>;
  selectedAgent: string;
  evaluationResult?: EvaluationResult; // 可选，用于兼容旧数据
  promptUsed?: string;
  // ===== 新增：聊天数据 =====
  conversations?: TaskConversationData; // 该任务关联的所有聊天数据
}
