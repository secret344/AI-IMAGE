import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getAgentById } from '@/modules/agent/recommendAgents';
import { resolveAgentLocale, type AgentLocaleFields } from '@/config/agents';

/**
 * Resolves agent locale information based on selected agent and current language
 * @param selectedAgentId - Current selected agent ID
 * @returns Agent locale object or null
 */
export function useAgentLocale(selectedAgentId: string | null): AgentLocaleFields | null {
  const { i18n } = useTranslation();

  return useMemo(() => {
    if (!selectedAgentId) {
      return null;
    }
    const agent = getAgentById(selectedAgentId);
    return agent ? resolveAgentLocale(agent, i18n.language) : null;
  }, [selectedAgentId, i18n.language]);
}
