import { z } from 'zod';
import type { EvaluationResult } from '@/types/evaluation';

const dimensionSchema = z.object({
  name: z.enum(['Composition', 'Lighting', 'Color', 'Subject']),
  score: z.number().min(0).max(100),
  reason: z.string()
});

const retouchSchema = z.object({
  tool: z.enum(['Lightroom', 'Photoshop']),
  step: z.string(),
  action: z.string(),
  values: z.record(z.number()).optional(),
  reason: z.string()
});

const resultSchema = z.object({
  score: z.number().min(0).max(100),
  dimensions: z.array(dimensionSchema),
  shootingTips: z.array(z.string()).optional().default([]),
  retouchPlan: z.array(retouchSchema).optional().default([])
});

export function validateResult(payload: unknown, language: 'zh' | 'en' = 'en'): EvaluationResult {
  const parsed = resultSchema.safeParse(payload);
  if (parsed.success) {
    return { ...normalizeResult(parsed.data), raw: payload };
  }

  return bestEffortResult(payload, language);
}

function normalizeResult(result: EvaluationResult): EvaluationResult {
  return {
    score: result.score,
    dimensions: result.dimensions ?? [],
    shootingTips: result.shootingTips ?? [],
    retouchPlan: result.retouchPlan ?? []
  };
}

/**
 * Provide best-effort fallback result when AI response is invalid
 * @param {unknown} payload Partial or malformed payload data
 * @param {'zh'|'en'} language User language preference (for future i18n fallback messages)
 * @return {EvaluationResult} Best-effort EvaluationResult with safe defaults
 */
function bestEffortResult(payload: unknown, language: 'zh' | 'en'): EvaluationResult {
  if (payload && typeof payload === 'object') {
    const data = payload as Record<string, unknown>;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    void language; // Keep parameter for future i18n fallback messages
    return {
      score: typeof data.score === 'number' ? data.score : 0,
      dimensions: Array.isArray(data.dimensions)
        ? (data.dimensions as EvaluationResult['dimensions'])
        : [],
      shootingTips: Array.isArray(data.shootingTips)
        ? (data.shootingTips as EvaluationResult['shootingTips'])
        : [],
      retouchPlan: Array.isArray(data.retouchPlan)
        ? (data.retouchPlan as EvaluationResult['retouchPlan'])
        : [],
      raw: payload
    };
  }

  return {
    score: 0,
    dimensions: [],
    shootingTips: [],
    retouchPlan: [],
    raw: payload
  };
}
