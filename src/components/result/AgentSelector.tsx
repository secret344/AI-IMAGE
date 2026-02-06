import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getAllAgents } from '@/config/agents';
import type { AgentRecommendation } from '@/modules/agent/recommendAgents';

interface AgentSelectorProps {
  recommendedAgents: AgentRecommendation[];
  selectedAgentId: string | null;
  onSelectAgent: (agentId: string) => void;
  isExpanded: boolean;
  onToggleExpand: (expanded: boolean) => void;
}

export function AgentSelector({
  recommendedAgents,
  selectedAgentId,
  onSelectAgent,
  isExpanded,
  onToggleExpand
}: AgentSelectorProps) {
  const { t } = useTranslation();
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const handler = () => setRefreshKey((prev) => prev + 1);
    window.addEventListener('custom-agents-updated', handler);
    return () => window.removeEventListener('custom-agents-updated', handler);
  }, []);

  // 创建推荐分数 map
  const recommendationScoreMap = new Map(recommendedAgents.map((rec) => [rec.id, rec.score]));

  const allAgents = useMemo(() => getAllAgents(), [refreshKey]);

  // 按推荐分数排序所有摄影师
  const sortedAgents = [...allAgents].sort((a, b) => {
    const scoreA = recommendationScoreMap.get(a.id) ?? 0;
    const scoreB = recommendationScoreMap.get(b.id) ?? 0;
    return scoreB - scoreA;
  });

  return (
    <Card>
      <CardContent className="p-0">
        <Button
          variant="ghost"
          onClick={() => onToggleExpand(!isExpanded)}
          className="flex w-full justify-between px-4 py-3 text-sm font-semibold text-foreground"
        >
          <span>{t('result.selectPhotographer')}</span>
          <span className={`transition ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
        </Button>

        {isExpanded && (
          <div className="border-t border-border px-4 py-3 space-y-2">
            {sortedAgents.map((agent) => {
              const score = recommendationScoreMap.get(agent.id);
              const isRecommended = score !== undefined;
              const isSelected = selectedAgentId === agent.id;

              return (
                <Button
                  key={agent.id}
                  variant={isSelected ? 'default' : 'outline'}
                  onClick={() => onSelectAgent(agent.id)}
                  className="w-full justify-between"
                >
                  <div className="text-left flex-1">
                    <p className="text-sm font-semibold">
                      {t(`agents.${agent.id}`, { defaultValue: agent.name })}
                    </p>
                    <p className="text-xs opacity-75">
                      {t(`agents.${agent.id}-photographer`, {
                        defaultValue: agent.photographer
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    {isRecommended ? (
                      <p className="text-xs font-semibold">{Math.round(score * 100)}%</p>
                    ) : (
                      <p className="text-xs opacity-50">—</p>
                    )}
                  </div>
                </Button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
