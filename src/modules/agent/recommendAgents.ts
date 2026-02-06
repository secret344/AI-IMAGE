import { getAllAgents, resolveAgentLocale, type AgentProfile } from '@/config/agents';
import type { StyleTagScore } from '@/config/style-tags';

export interface AgentRecommendation {
  id: string;
  name: string;
  score: number;
  matchedTags: string[];
  description: string;
}

export interface RecommendOptions {
  limit?: number;
}

export function recommendAgents(
  styleTags: StyleTagScore[],
  options: RecommendOptions = {},
  language?: string
): AgentRecommendation[] {
  const normalized = [...styleTags].sort(
    (a, b) => b.weight - a.weight || a.name.localeCompare(b.name)
  );
  const limit = options.limit ?? 3;

  return getAllAgents().map((agent) => {
    let score = 0;
    const matchedTags: string[] = [];
    const locale = resolveAgentLocale(agent, language);

    normalized.forEach((tag) => {
      const weight = agent.tagWeights[tag.name];
      if (weight) {
        score += tag.weight * weight;
        matchedTags.push(tag.name);
      }
    });

    return {
      id: agent.id,
      name: locale.name,
      score: Number(score.toFixed(2)),
      matchedTags,
      description: locale.description
    };
  })
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
    })
    .slice(0, limit);
}

export function getAgentById(id: string): AgentProfile | undefined {
  return getAllAgents().find((agent) => agent.id === id);
}
