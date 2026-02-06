import { useTranslation } from 'react-i18next';
import { resolveAgentLocale, resolveAgentPrompt, type AgentProfile } from '@/config/agents';

interface ActiveAgentDisplayProps {
  agent: AgentProfile | null | undefined;
}

export function ActiveAgentDisplay({ agent }: ActiveAgentDisplayProps) {
  const { t, i18n } = useTranslation();

  if (!agent) {
    return null;
  }

  const prompt = resolveAgentPrompt(agent, i18n.language);
  const locale = resolveAgentLocale(agent, i18n.language);
  const concisePrompt = prompt
    .split(/(?<=[.!。！？])/)
    .filter((segment) => segment.trim().length > 0)
    .join(' ')
    .trim();

  return (
    <div className="rounded-lg border border-border bg-card p-4 text-sm">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
        {t('result.activeAgent')}
      </p>
      <p className="mt-2 text-lg">{locale.name}</p>
      <p className="text-xs text-muted-foreground">{locale.photographer}</p>
      <p className="mt-3 text-xs text-muted-foreground">{locale.description}</p>
      <p className="mt-3 text-xs text-muted-foreground">
        {concisePrompt}
      </p>
    </div>
  );
}
