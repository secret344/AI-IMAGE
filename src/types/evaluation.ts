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
