import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import JSZip from 'jszip';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { TaskRecord } from '@/modules/storage/db';
import type { AgentRecommendation } from '@/modules/agent/recommendAgents';
import type { StyleRecognitionResult } from '@/modules/style/recognizeStyle';
import type { ProcessedImage } from '@/modules/upload/processImage';
import type { EvaluationResult } from '@/types/evaluation';
import { deleteTask, deleteTasks, listTasks } from '@/modules/storage/history';
import { loadProviderSettings } from '@/modules/storage/settings';
import { processedImageFromDataUrl } from '@/modules/upload/processedImageFromDataUrl';
import { buildXmp } from '@/modules/export/xmp';
import { getAgentById, recommendAgents } from '@/modules/agent/recommendAgents';
import { resolveAgentLocale } from '@/config/agents';
import { useAppStore } from '@/state/useAppStore';
import { HistoryFilters } from '@/components/history/HistoryFilters';
import { HistoryActionsBar } from '@/components/history/HistoryActionsBar';
import { HistoryTaskGrid } from '@/components/history/HistoryTaskGrid';
import { HistoryPagination } from '@/components/history/HistoryPagination';
import { HistoryEmptyState } from '@/components/history/HistoryEmptyState';
import {
  HISTORY_FILTER_KEY,
  buildFilterConfigs,
  buildSearchHaystack,
  hasExif,
  hasRetouch,
  hasStyle
} from '@/components/history/historyUtils';

interface TaskItemActionFactory {
  label: string;
  variant: 'default' | 'primary' | 'danger';
  handler: (task: TaskRecord) => void | Promise<void>;
}

const buildTaskItemActions = (
  t: (key: string) => string,
  language: string,
  setEvaluation: (val: EvaluationResult | null) => void,
  setSelectedAgentId: (id: string | null) => void,
  setStyleResult: (val: StyleRecognitionResult | null) => void,
  setSelectedFileName: (name: string | null) => void,
  setPreviewImageBase64: (data: string | null) => void,
  setProcessedImage: (data: ProcessedImage | null) => void,
  setRecommendedAgents: (agents: AgentRecommendation[]) => void,
  setSkipCache: (skip: boolean) => void,
  deleteTask: (id: string) => Promise<void>,
  load: () => Promise<void>
): TaskItemActionFactory[] => {
  const loadTaskToState = (task: TaskRecord, clearEvaluation = false) => {
    console.log('📥 [LoadTaskToState] Loading task to state:', {
      taskId: task.id,
      clearEvaluation,
      hasEvaluation: !!task.evaluation,
      hasProcessedImage: !!task.processedImage,
      hasStyleResult: !!task.styleResult
    });
    
    setEvaluation(clearEvaluation ? null : task.evaluation);
    setSelectedAgentId(task.agentId ?? null);
    setStyleResult(task.styleResult ?? null);
    setSelectedFileName(task.fileName ?? null);
    setPreviewImageBase64(task.thumbnailBase64);
    
    if (task.processedImage) {

      setProcessedImage(
        processedImageFromDataUrl(
          task.processedImage.base64,
          task.fileName ?? 'history.jpg',
          task.processedImage.exif,
          task.processedImage.dimensions
        )
      );
    } else {
      console.warn('⚠️ [LoadTaskToState] No processedImage found in task');
    }
    
    if (task.styleResult) {

      const settings = loadProviderSettings();
      setRecommendedAgents(
        recommendAgents(task.styleResult.styleTags, { limit: settings.topAgents }, language)
      );
    } else {
      console.warn('⚠️ [LoadTaskToState] No styleResult found in task');
    }
    

  };

  return [
    {
      label: t('history.view'),
      variant: 'default',
      handler: (task) => loadTaskToState(task, false)
    },
    {
      label: t('history.reevaluate'),
      variant: 'primary',
      handler: (task) => {
        console.log('[Re-evaluation] Starting for task:', task.id, '- Agent:', task.agentId);
        loadTaskToState(task, true);
        setSkipCache(true);
        window.dispatchEvent(new Event('highlight-run'));
      }
    },
    {
      label: t('history.delete'),
      variant: 'danger',
      handler: async (task) => {
        await deleteTask(task.id);
        await load();
      }
    }
  ];
};

export function HistoryPanel() {
  const { t, i18n } = useTranslation();
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState<'time' | 'score'>('time');
  const [onlyExif, setOnlyExif] = useState(false);
  const [onlyStyle, setOnlyStyle] = useState(false);
  const [onlyRetouch, setOnlyRetouch] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const pageSize = 5;
  const {
    setEvaluation,
    setSelectedAgentId,
    setStyleResult,
    setSelectedFileName,
    setPreviewImageBase64,
    setProcessedImage,
    setRecommendedAgents,
    setSkipCache
  } = useAppStore();

  const load = useCallback(async () => {
    const data = await listTasks();
    setTasks(data);
  }, []);

  useEffect(() => {
    void load();
    const handle = () => void load();
    window.addEventListener('history-updated', handle);
    return () => window.removeEventListener('history-updated', handle);
  }, [load]);

  useEffect(() => {
    const raw = localStorage.getItem(HISTORY_FILTER_KEY);
    if (!raw) {
      return;
    }
    try {
      const saved = JSON.parse(raw) as {
        query?: string;
        sortMode?: 'time' | 'score';
        onlyExif?: boolean;
        onlyStyle?: boolean;
        onlyRetouch?: boolean;
        page?: number;
      };
      if (saved.query !== undefined) {
        setQuery(saved.query);
      }
      if (saved.sortMode) {
        setSortMode(saved.sortMode);
      }
      if (saved.onlyExif !== undefined) {
        setOnlyExif(saved.onlyExif);
      }
      if (saved.onlyStyle !== undefined) {
        setOnlyStyle(saved.onlyStyle);
      }
      if (saved.onlyRetouch !== undefined) {
        setOnlyRetouch(saved.onlyRetouch);
      }
      if (saved.page) {
        setPage(saved.page);
      }
    } catch {
      // ignore corrupted local data
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      HISTORY_FILTER_KEY,
      JSON.stringify({ query, sortMode, onlyExif, onlyStyle, onlyRetouch, page })
    );
  }, [query, sortMode, onlyExif, onlyStyle, onlyRetouch, page]);

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [query, sortMode, onlyExif, onlyStyle, onlyRetouch]);

  const filteredTasks = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = normalized
      ? tasks.filter((task) => {
          const agent = getAgentById(task.agentId ?? '');
          const agentName = agent ? resolveAgentLocale(agent, i18n.language).name : undefined;
          return buildSearchHaystack(task, agentName).includes(normalized);
        })
      : tasks;

    const filteredWithFlags = filtered.filter((task) => {
      if (onlyExif && !hasExif(task)) {
        return false;
      }
      if (onlyStyle && !hasStyle(task)) {
        return false;
      }
      if (onlyRetouch && !hasRetouch(task)) {
        return false;
      }
      return true;
    });

    const sorted = [...filteredWithFlags].sort((a, b) => {
      if (sortMode === 'score') {
        return b.evaluation.score - a.evaluation.score;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return sorted;
  }, [tasks, query, sortMode, onlyExif, onlyStyle, onlyRetouch]);

  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / pageSize));
  const pagedTasks = filteredTasks.slice((page - 1) * pageSize, page * pageSize);

  const handleExportSelectedXmp = useCallback(() => {
    const selected = filteredTasks.filter((task) => selectedIds.has(task.id));
    if (selected.length === 0) {
      return;
    }
    const prefix = new Date().toISOString().replace(/[:.]/g, '-');
    selected.forEach((task) => {
      const content = buildXmp(task.evaluation.retouchPlan);
      const blob = new Blob([content], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const safeName = (task.fileName ?? 'ai-image').replace(/[^a-z0-9-_]+/gi, '_');
      anchor.href = url;
      anchor.download = `${prefix}_${safeName}.xmp`;
      anchor.click();
      URL.revokeObjectURL(url);
    });
  }, [filteredTasks, selectedIds]);

  const handleExportSelectedZip = useCallback(async () => {
    const selected = filteredTasks.filter((task) => selectedIds.has(task.id));
    if (selected.length === 0) {
      return;
    }
    const prefix = new Date().toISOString().replace(/[:.]/g, '-');
    const zip = new JSZip();
    selected.forEach((task) => {
      const safeName = (task.fileName ?? 'ai-image').replace(/[^a-z0-9-_]+/gi, '_');
      const xmp = buildXmp(task.evaluation.retouchPlan);
      zip.file(`${prefix}_${safeName}.xmp`, xmp);
      zip.file(`${prefix}_${safeName}.json`, JSON.stringify(task, null, 2));
    });
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `ai-image-export-${prefix}.zip`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [filteredTasks, selectedIds]);

  const handleExportFilteredJson = useCallback(() => {
    if (filteredTasks.length === 0) {
      return;
    }
    const blob = new Blob([JSON.stringify(filteredTasks, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'ai-image-history-filtered.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }, [filteredTasks]);

  const handleExportAllJson = useCallback(async () => {
    const data = await listTasks();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'ai-image-history.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleExportCurrentPageJson = useCallback(() => {
    if (pagedTasks.length === 0) {
      return;
    }
    const blob = new Blob([JSON.stringify(pagedTasks, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'ai-image-history-page.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }, [pagedTasks]);

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3 sm:pb-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <CardTitle className="text-lg sm:text-xl">{t('history.title')}</CardTitle>
            <CardDescription className="text-sm text-muted-foreground/80 mt-1">
              {t('history.description')}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleExportAllJson}>
            {t('history.exportJson')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <HistoryFilters
          query={query}
          sortMode={sortMode}
          filterState={{ onlyExif, onlyStyle, onlyRetouch }}
          filterConfigs={buildFilterConfigs(t)}
          onQueryChange={setQuery}
          onSortChange={setSortMode}
          onToggleFilter={(key, checked) => {
            if (key === 'onlyExif') setOnlyExif(checked);
            else if (key === 'onlyStyle') setOnlyStyle(checked);
            else setOnlyRetouch(checked);
          }}
        />

        <HistoryActionsBar
          filteredCount={filteredTasks.length}
          page={page}
          totalPages={totalPages}
          selectedCount={selectedIds.size}
          pagedCount={pagedTasks.length}
          onSelectAll={() => setSelectedIds(new Set(filteredTasks.map((task) => task.id)))}
          onClearSelection={() => setSelectedIds(new Set())}
          onExportFilteredJson={handleExportFilteredJson}
          onExportCurrentPage={handleExportCurrentPageJson}
          onExportZip={handleExportSelectedZip}
          onExportXmp={handleExportSelectedXmp}
          onDeleteSelected={async () => {
            if (selectedIds.size === 0) {
              return;
            }
            await deleteTasks([...selectedIds]);
            setSelectedIds(new Set());
            await load();
          }}
        />

        <HistoryEmptyState hasTasks={tasks.length > 0} hasFiltered={filteredTasks.length > 0} />

        <HistoryTaskGrid
          tasks={pagedTasks}
          selectedIds={selectedIds}
          getAgentName={(agentId) => {
            const agent = getAgentById(agentId ?? '');
            return agent ? resolveAgentLocale(agent, i18n.language).name : null;
          }}
          onToggleSelected={(id, checked) => {
            const next = new Set(selectedIds);
            if (checked) {
              next.add(id);
            } else {
              next.delete(id);
            }
            setSelectedIds(next);
          }}
          buildActions={(task) =>
            buildTaskItemActions(
              t,
              i18n.language,
              setEvaluation,
              setSelectedAgentId,
              setStyleResult,
              setSelectedFileName,
              setPreviewImageBase64,
              setProcessedImage,
              setRecommendedAgents,
              setSkipCache,
              deleteTask,
              load
            ).map((action) => ({ ...action, handler: () => action.handler(task) }))
          }
        />

        <HistoryPagination
          page={page}
          totalPages={totalPages}
          onPrevious={() => setPage((current) => Math.max(1, current - 1))}
          onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
        />
      </CardContent>
    </Card>
  );
}
