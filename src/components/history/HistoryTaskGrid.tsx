import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
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
    <div className="mt-6 grid auto-rows-fr gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    <Card className="group relative flex h-full flex-col overflow-hidden border-border/60 bg-card/60 shadow-sm transition-all hover:shadow-md">
      {/* Checkbox Overlay */}
      <div className="absolute left-3 top-3 z-10 rounded-md bg-background/80 p-1 shadow-sm">
        <Checkbox
          checked={selectedIds.has(task.taskId)}
          onCheckedChange={(checked) => onToggleSelected(task.taskId, checked as boolean)}
          className="h-4 w-4"
        />
      </div>

      {/* Image */}
      <div className="relative h-44 overflow-hidden bg-muted">
        {thumbnailUrl && (
          <img
            src={thumbnailUrl}
            alt={t('history.thumbnailAlt')}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        )}
        {task.evaluationResult && (
          <div className="absolute right-3 top-3 rounded-full bg-primary text-primary-foreground text-sm font-semibold px-3 py-1 shadow">
            {task.evaluationResult.score}
          </div>
        )}
      </div>

      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-semibold text-primary uppercase tracking-[0.2em] line-clamp-1">
          {task.selectedAgent
            ? (getAgentName(task.selectedAgent) ?? task.selectedAgent)
            : t('history.noAgent', { defaultValue: 'Unknown Agent' })}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-2 text-xs text-muted-foreground">
        {task.styleTags && task.styleTags.length > 0 && (
          <p className="line-clamp-1 text-foreground/80 font-medium">
            {task.styleTags
              .slice(0, 2)
              .map(
                (tag) =>
                  `${t(`styleTags.${tag.name}`, { defaultValue: tag.name })} ${Math.round(
                    tag.weight * 100
                  )}%`
              )
              .join(' · ')}
          </p>
        )}
        <p className="text-[11px] text-muted-foreground/70">
          {new Date(task.timestamp).toLocaleDateString()}
        </p>
      </CardContent>

      <CardFooter className="mt-auto flex flex-col gap-2 border-t border-border/40 pt-3">
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
              className="h-8 text-xs font-medium"
            >
              {action.label}
            </Button>
          );
        })}
      </CardFooter>
    </Card>
  );
}
