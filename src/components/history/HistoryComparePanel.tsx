import { useTranslation } from 'react-i18next';
import type { TaskRecord } from '@/modules/storage/db';
import { getAgentById } from '@/modules/agent/recommendAgents';
import { resolveAgentLocale } from '@/config/agents';

interface HistoryComparePanelProps {
  tasks: TaskRecord[];
}

export function HistoryComparePanel({ tasks }: HistoryComparePanelProps) {
  const { t, i18n } = useTranslation();

  if (tasks.length !== 2) {
    return null;
  }

  const [first, second] = tasks;

  return (
    <div className="mt-4 rounded-lg border border-border bg-card p-4">
      <p className="text-sm font-semibold text-foreground">{t('history.comparison')}</p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {tasks.map((task) => (
          <div key={task.taskId} className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">
              {t('history.untitled')}
            </p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{task.evaluationResult?.score ?? 'N/A'}</p>
            <p className="text-xs text-muted-foreground">
              {(() => {
                const agent = getAgentById(task.selectedAgent ?? '');
                if (agent) {
                  return resolveAgentLocale(agent, i18n.language).name;
                }
                return task.selectedAgent ?? t('history.unknownAgent');
              })()}
            </p>
            <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
              {(task.evaluationResult?.dimensions ?? []).map((dimension: any) => (
                <li
                  key={`${task.taskId}-${dimension.name}`}
                  className="flex items-center justify-between"
                >
                  <span>{dimension.name}</span>
                  <span className="text-foreground">{dimension.score}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-lg border border-border p-3">
        <p className="text-xs uppercase text-muted-foreground">{t('history.delta')}</p>
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          {(first.evaluationResult?.dimensions ?? []).map((dimension: any) => {
            const other = second.evaluationResult?.dimensions?.find((item: any) => item.name === dimension.name);
            const delta = (other?.score ?? 0) - dimension.score;
            const sign = delta > 0 ? '+' : '';
            return (
              <li key={`delta-${dimension.name}`} className="flex items-center justify-between">
                <span>{dimension.name}</span>
                <span className={delta >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                  {sign}
                  {delta}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
