import type { TaskRecord } from '@/modules/storage/db';

export const HISTORY_FILTER_KEY = 'ai-image-history-filters';

export const buildSearchHaystack = (task: TaskRecord, agentName?: string) =>
  [task.selectedAgent, agentName, task.evaluationResult.score.toString()]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

export const hasStyle = (task: TaskRecord) => Boolean(task.styleTags?.length);

export const hasRetouch = (task: TaskRecord) => Boolean(task.evaluationResult.retouchPlan?.length);

export interface FilterConfig {
  key: keyof FilterState;
  label: string;
  predicate: (task: TaskRecord) => boolean;
}

export type FilterState = {
  onlyStyle: boolean;
  onlyRetouch: boolean;
};

export const buildFilterConfigs = (t: (key: string) => string): FilterConfig[] => [
  {
    key: 'onlyStyle',
    label: t('history.hasStyleTags'),
    predicate: hasStyle
  },
  {
    key: 'onlyRetouch',
    label: t('history.hasRetouchPlan'),
    predicate: hasRetouch
  }
];
