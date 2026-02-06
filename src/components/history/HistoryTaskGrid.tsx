import { useTranslation } from 'react-i18next';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import type { TaskRecord } from '@/modules/storage/db';
import type { TaskItemActionConfig } from '@/components/history/taskActions';
import { formatExifSummary, hasExif } from './historyUtils';

interface HistoryTaskGridProps {
  tasks: TaskRecord[];
  selectedIds: Set<string>;
  onToggleSelected: (id: string, checked: boolean) => void;
  getAgentName: (agentId: string | null) => string | null;
  buildActions: (task: TaskRecord) => TaskItemActionConfig[];
}

export function HistoryTaskGrid({
  tasks,
  selectedIds,
  onToggleSelected,
  getAgentName,
  buildActions
}: HistoryTaskGridProps) {
  const { t } = useTranslation();

  if (tasks.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tasks.map((task) => {
        const taskActions = buildActions(task);
        return (
          <div
            key={task.id}
            className="group relative flex flex-col rounded-lg border border-border bg-card overflow-hidden transition-all duration-200 hover:border-primary/70 hover:shadow-lg hover:shadow-primary/10"
          >
            {/* Checkbox Overlay */}
            <div className="absolute left-3 top-3 z-10 opacity-100 transition-opacity group-hover:opacity-100">
              <Checkbox
                checked={selectedIds.has(task.id)}
                onCheckedChange={(checked) => onToggleSelected(task.id, checked as boolean)}
                className="h-5 w-5"
              />
            </div>

            {/* Image Container */}
            <div className="relative h-44 overflow-hidden bg-muted">
              <img
                src={task.thumbnailBase64}
                alt={t('history.thumbnailAlt')}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
              />
              {/* Score Badge */}
              <div className="absolute right-3 top-3 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-bold text-base shadow-lg transition-transform group-hover:scale-110">
                {task.evaluation.score}
              </div>
            </div>

            {/* Content */}
            <div className="flex flex-1 flex-col p-4 space-y-3">
              {/* Agent & Filename */}
              <div className="space-y-2 min-h-12 flex flex-col justify-center">
                {task.agentId && (
                  <p className="text-xs font-semibold text-primary uppercase tracking-widest leading-tight">
                    {getAgentName(task.agentId) ?? task.agentId}
                  </p>
                )}
                {task.fileName && (
                  <p className="truncate text-sm font-semibold text-foreground leading-snug line-clamp-2">
                    {task.fileName}
                  </p>
                )}
                {!task.fileName && task.agentId && (
                  <p className="text-xs text-muted-foreground">
                    {t('history.noFileName', { defaultValue: 'Untitled' })}
                  </p>
                )}
              </div>

              {/* Metadata */}
              <div className="space-y-1.5 text-xs text-muted-foreground">
                {task.styleResult && (
                  <p className="truncate font-medium text-foreground/80">
                    {task.styleResult.styleTags
                      .slice(0, 2)
                      .map((tag) => `${tag.name} ${Math.round(tag.weight * 100)}%`)
                      .join(' · ')}
                  </p>
                )}
                {hasExif(task) && <p className="truncate text-xs">{formatExifSummary(task)}</p>}
                <p className="text-xs text-muted-foreground/70">
                  {new Date(task.createdAt).toLocaleDateString()}
                </p>
              </div>

              {/* Actions */}
              <div className="mt-auto pt-3 flex flex-col gap-2 border-t border-border/50">
                {taskActions.map((action) => {
                  const variant =
                    action.variant === 'primary'
                      ? 'default'
                      : action.variant === 'danger'
                        ? 'destructive'
                        : 'outline';
                  return (
                    <Button
                      key={action.label}
                      size="sm"
                      variant={variant}
                      onClick={action.handler}
                      className="h-8 text-xs font-medium transition-colors"
                    >
                      {action.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
