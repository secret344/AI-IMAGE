import { AGENTS, type AgentProfile } from '@/config/agents';
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
  options: RecommendOptions = {}
): AgentRecommendation[] {
  const normalized = [...styleTags].sort(
    (a, b) => b.weight - a.weight || a.name.localeCompare(b.name)
  );
  const limit = options.limit ?? 3;

  return AGENTS.map((agent) => {
    let score = 0;
    const matchedTags: string[] = [];

    normalized.forEach((tag) => {
      const weight = agent.tagWeights[tag.name];
      if (weight) {
        score += tag.weight * weight;
        matchedTags.push(tag.name);
      }
    });

    return {
      id: agent.id,
      name: agent.name,
      score: Number(score.toFixed(2)),
      matchedTags,
      description: agent.description
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
  return AGENTS.find((agent) => agent.id === id);
}
