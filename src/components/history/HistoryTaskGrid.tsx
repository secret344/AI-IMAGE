import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import type { TaskRecord } from '@/modules/storage/db';
import type { TaskItemActionConfig } from '@/components/history/taskActions';

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

  // Helper to convert Blob to data URL
  const blobToDataUrl = (blob: Blob): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  };

  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tasks.map((task) => {
        const taskActions = buildActions(task);
        return (
          <ThumbnailCard
            key={task.taskId}
            task={task}
            taskActions={taskActions}
            selectedIds={selectedIds}
            onToggleSelected={onToggleSelected}
            getAgentName={getAgentName}
            blobToDataUrl={blobToDataUrl}
            t={t}
          />
        );
      })}
    </div>
  );
}

interface ThumbnailCardProps {
  task: TaskRecord;
  taskActions: TaskItemActionConfig[];
  selectedIds: Set<string>;
  onToggleSelected: (id: string, checked: boolean) => void;
  getAgentName: (agentId: string | null) => string | null;
  blobToDataUrl: (blob: Blob) => Promise<string>;
  t: any;
}

function ThumbnailCard({
  task,
  taskActions,
  selectedIds,
  onToggleSelected,
  getAgentName,
  blobToDataUrl,
  t
}: ThumbnailCardProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string>('');

  useEffect(() => {
    if (task.thumbnail) {
      blobToDataUrl(task.thumbnail).then(setThumbnailUrl);
    }
  }, [task.thumbnail, blobToDataUrl]);

  return (
    <div
      className="group relative flex flex-col rounded-lg border border-border bg-card overflow-hidden transition-all duration-200 hover:border-primary/70 hover:shadow-lg hover:shadow-primary/10"
    >
      {/* Checkbox Overlay */}
      <div className="absolute left-3 top-3 z-10 opacity-100 transition-opacity group-hover:opacity-100">
        <Checkbox
          checked={selectedIds.has(task.taskId)}
          onCheckedChange={(checked) => onToggleSelected(task.taskId, checked as boolean)}
          className="h-5 w-5"
        />
      </div>

      {/* Image Container */}
      <div className="relative h-44 overflow-hidden bg-muted">
        {thumbnailUrl && (
          <img
            src={thumbnailUrl}
            alt={t('history.thumbnailAlt')}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
          />
        )}
        {/* Score Badge */}
        {task.evaluationResult && (
          <div className="absolute right-3 top-3 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-bold text-base shadow-lg transition-transform group-hover:scale-110">
            {task.evaluationResult.score}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4 space-y-3">
        {/* Agent */}
        <div className="space-y-2 min-h-12 flex flex-col justify-center">
          {task.selectedAgent && (
            <p className="text-xs font-semibold text-primary uppercase tracking-widest leading-tight">
              {getAgentName(task.selectedAgent) ?? task.selectedAgent}
            </p>
          )}
          {!task.selectedAgent && (
            <p className="text-xs text-muted-foreground">
              {t('history.noAgent', { defaultValue: 'Unknown Agent' })}
            </p>
          )}
        </div>

        {/* Metadata */}
        <div className="space-y-1.5 text-xs text-muted-foreground">
          {task.styleTags && task.styleTags.length > 0 && (
            <p className="truncate font-medium text-foreground/80">
              {task.styleTags
                .slice(0, 2)
                .map((tag) => `${tag.name} ${Math.round(tag.weight * 100)}%`)
                .join(' · ')}
            </p>
          )}
          <p className="text-xs text-muted-foreground/70">
            {new Date(task.timestamp).toLocaleDateString()}
          </p>
        </div>

        {/* Actions */}
        <div className="mt-auto pt-3 flex flex-col gap-2 border-t border-border/50">
          {taskActions.map((action, index) => {
            const variant =
              action.variant === 'primary'
                ? 'default'
                : action.variant === 'danger'
                  ? 'destructive'
                  : 'outline';
            return (
              <Button
                key={`${task.taskId}-action-${index}`}
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
}
