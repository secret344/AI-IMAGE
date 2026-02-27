import type { DimensionName } from '@/types/evaluation';

export const EVALUATION_SCORE_RANGE = {
  min: 0,
  max: 100
};

export const EVALUATION_DIMENSIONS: DimensionName[] = [
  'Composition',
  'Lighting',
  'Color',
  'Subject'
];

export const LIGHTROOM_PARAM_RANGES = {
  Exposure: { min: -5, max: 5 },
  Contrast: { min: -100, max: 100 },
  Highlights: { min: -100, max: 100 },
  Shadows: { min: -100, max: 100 }
};
