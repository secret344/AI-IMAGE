import { useTranslation } from 'react-i18next';
import type { AgentProfile } from '@/config/agents';

interface ActiveAgentDisplayProps {
  agent: AgentProfile | null | undefined;
}

export function ActiveAgentDisplay({ agent }: ActiveAgentDisplayProps) {
  const { t } = useTranslation();

  if (!agent) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 text-sm">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
        {t('result.activeAgent')}
      </p>
      <p className="mt-2 text-lg">{t(`agents.${agent.id}`)}</p>
      <p className="text-xs text-muted-foreground">{t(`agents.${agent.id}-photographer`)}</p>
      <p className="mt-3 text-xs text-muted-foreground">{t(`agents.${agent.id}-description`)}</p>
    </div>
  );
}
