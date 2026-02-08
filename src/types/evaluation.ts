import type { TaskConversationData } from './conversation';

export type DimensionName = 'Composition' | 'Lighting' | 'Color' | 'Subject';

/**
 * 单一评估维度结果
 * 包含分数、评价理由等信息
 */
export interface EvaluationDimension {
  name: DimensionName;
  score: number;
  reason: string;
}

/**
 * 修图步骤建议
 * 包含使用的工具、具体步骤和预期效果说明
 */
export interface RetouchStep {
  tool: 'Lightroom' | 'Photoshop';
  step: string;
  action: string;
  values?: Record<string, number>;
  reason: string;
}

/**
 * 完整的图像评估结果
 * 包含综合评分、各维度评价、拍摄建议和修图方案
 */
export interface EvaluationResult {
  score: number;
  dimensions: EvaluationDimension[];
  shootingTips: string[];
  retouchPlan: RetouchStep[];
  parseRecovered?: boolean;
  raw?: unknown;
}

/** 任务记录，包含评估结果和关联的聊天数据 */
export interface TaskSummaryRecord {
  taskId: string;
  parentTaskId?: string; // 迭代链
  timestamp: number; // 创建时间，用于排序（可能不唯一）
  imageHash?: string; // 图片哈希值，用于去重（可空）
  thumbnail?: Blob;
  styleTags: Array<{ name: string; weight: number; confidence: number }>;
  selectedAgent: string;
  fileName?: string;
}

/**
 * 任务详情记录
 * 包含评估结果、提示词、设置和处理后的图片数据，用于任务重新加载和历史查看
 */
export interface TaskDetailRecord {
  taskId: string;
  evaluationResult?: EvaluationResult; // 可选，用于兼容旧数据
  promptUsed?: string;
  taskSettings?: import('@/modules/storage/settings').ProviderSettings;
  conversations?: TaskConversationData; // 该任务关联的所有聊天数据
  processedImage?: {
    base64: string;
    exif: Record<string, string | number>;
    dimensions: { width: number; height: number };
  };
}

/**
 * 完整任务记录
 * 汇总摘要记录和详情记录，用于历史面板显示和任务列表
 */
export interface TaskRecord {
  taskId: string;
  parentTaskId?: string; // 迭代链
  timestamp: number; // 创建时间，用于排序（可能不唯一）
  imageHash?: string; // 图片哈希值，用于去重（可空）
  thumbnail?: Blob;
  styleTags: Array<{ name: string; weight: number; confidence: number }>;
  selectedAgent: string;
  fileName?: string;
  evaluationResult?: EvaluationResult; // 可选，用于兼容旧数据
  promptUsed?: string;
  taskSettings?: import('@/modules/storage/settings').ProviderSettings;
  // ===== 新增：聊天数据 =====
  conversations?: TaskConversationData; // 该任务关联的所有聊天数据
  processedImage?: {
    base64: string;
    exif: Record<string, string | number>;
    dimensions: { width: number; height: number };
  };
}
