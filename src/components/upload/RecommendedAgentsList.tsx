import { useTranslation } from 'react-i18next';
import type { AgentRecommendation } from '@/modules/agent/recommendAgents';

interface RecommendedAgentsListProps {
  agents: AgentRecommendation[];
}

export function RecommendedAgentsList({ agents }: RecommendedAgentsListProps) {
  const { t } = useTranslation();

  if (agents.length === 0) {
    return null;
  }

  return (
    <div className="text-xs space-y-2">
      <p className="font-semibold">{t('upload.topAgents')}</p>
      <ul className="space-y-1">
        {agents.map((agent) => (
          <li key={agent.id} className="flex justify-between text-muted-foreground">
            <span>{agent.name}</span>
            <span>{agent.score}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
