import type { TaskRecord } from '@/modules/storage/db';

export const HISTORY_FILTER_KEY = 'ai-image-history-filters';

export const buildSearchHaystack = (task: TaskRecord, agentName?: string) =>
  [task.fileName, task.agentId, agentName, task.evaluation.score.toString()]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

export const hasExif = (task: TaskRecord) =>
  Boolean(task.processedImage?.exif && Object.keys(task.processedImage.exif).length > 0);

export const hasStyle = (task: TaskRecord) => Boolean(task.styleResult?.styleTags?.length);

export const hasRetouch = (task: TaskRecord) => Boolean(task.evaluation.retouchPlan?.length);

export const formatExifSummary = (task: TaskRecord) =>
  Object.entries(task.processedImage?.exif ?? {})
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${value}`)
    .join(' · ');

export interface FilterConfig {
  key: keyof FilterState;
  label: string;
  predicate: (task: TaskRecord) => boolean;
}

export type FilterState = {
  onlyExif: boolean;
  onlyStyle: boolean;
  onlyRetouch: boolean;
};

export const buildFilterConfigs = (t: (key: string) => string): FilterConfig[] => [
  {
    key: 'onlyExif',
    label: t('history.hasExif'),
    predicate: hasExif
  },
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
