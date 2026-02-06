import type { EvaluationResult } from '@/types/evaluation';
import type { StyleRecognitionResult } from '@/modules/style/recognizeStyle';
import type { AgentRecommendation } from '@/modules/agent/recommendAgents';

export function buildMockEvaluation(
  styleResult: StyleRecognitionResult,
  agent: AgentRecommendation | null
): EvaluationResult {
  const baseScore = Math.min(95, Math.max(55, Math.round(styleResult.styleTags[0]?.weight * 100)));
  const bonus = agent ? Math.round(agent.score * 10) : 0;
  const overall = Math.min(100, baseScore + bonus);

  return {
    score: overall,
    dimensions: [
      {
        name: 'Composition',
        score: clamp(overall - 6),
        reason: 'Mock evaluation based on style tags.'
      },
      {
        name: 'Lighting',
        score: clamp(overall - 8),
        reason: 'Mock evaluation based on style tags.'
      },
      {
        name: 'Color',
        score: clamp(overall - 4),
        reason: 'Mock evaluation based on style tags.'
      },
      {
        name: 'Subject',
        score: clamp(overall - 5),
        reason: 'Mock evaluation based on style tags.'
      }
    ],
    shootingTips: ['Mock result. Connect an AI provider to get real analysis.'],
    retouchPlan: [
      {
        tool: 'Lightroom',
        step: 'Basic',
        action: 'Adjust exposure and contrast slightly.',
        values: { Exposure: 0.2, Contrast: 8 },
        reason: 'Placeholder guidance.'
      }
    ]
  };
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}
