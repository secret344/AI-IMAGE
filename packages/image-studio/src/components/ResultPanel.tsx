import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ui/card';
import { useAppStore } from '@/state/useAppStore';
import { useTaskContext } from '@/state/TaskContext';
import { getAgentById, recommendAgents } from '@/modules/agent/recommendAgents';
import { AgentSelector } from '@/components/result/AgentSelector';
import { ActiveAgentDisplay } from '@/components/result/ActiveAgentDisplay';
import { EvaluationResults } from '@/components/result/EvaluationResults';
import { EvaluationControls } from '@/components/result/EvaluationControls';
import { StatusMessages } from '@/components/result/StatusMessages';
import { useResultActions } from '@/components/result/useResultActions';

export function ResultPanel() {
  const { t, i18n } = useTranslation();
  const [passphrase, setPassphrase] = useState('');
  const [runError, setRunError] = useState<string | null>(null);
  const [highlightRun, setHighlightRun] = useState(false);
  const [isAgentSelectorExpanded, setIsAgentSelectorExpanded] = useState(false);
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const { isOnline, globalProviderSettings } = useAppStore();
  const { taskState, setTaskState, taskSettings } = useTaskContext();
  const {
    evaluation,
    selectedAgentId,
    styleResult,
    isProcessing,
    processingStage,
    lastLatencyMs,
    recommendedAgents,
    processedImage
  } = taskState;
  const agent = useMemo(
    () => (selectedAgentId ? (getAgentById(selectedAgentId) ?? null) : null),
    [selectedAgentId]
  );
  const agentRec = useMemo(
    () =>
      selectedAgentId
        ? (recommendedAgents.find((item) => item.id === selectedAgentId) ?? null)
        : null,
    [recommendedAgents, selectedAgentId]
  );

  const { handleDownloadXmp, handleSaveHistory, handleRun, handleRunMock } = useResultActions({
    evaluation,
    processedImage,
    selectedAgentId,
    styleResult,
    agent,
    agentRec,
    isOnline,
    passphrase,
    taskSettings,
    setEvaluation: (value) => setTaskState({ evaluation: value }),
    setIsProcessing: (value) => setTaskState({ isProcessing: value }),
    setProcessingStage: (value) => setTaskState({ processingStage: value }),
    setLastLatencyMs: (value) => setTaskState({ lastLatencyMs: value }),
    setRunError
  });

  useEffect(() => {
    const handler = () => {
      setHighlightRun(true);
      sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.setTimeout(() => setHighlightRun(false), 1500);
    };
    window.addEventListener('highlight-run', handler);
    return () => {
      window.removeEventListener('highlight-run', handler);
    };
  }, []);

  useEffect(() => {
    if (!styleResult || !globalProviderSettings) {
      return;
    }
    const agents = recommendAgents(
      styleResult.styleTags,
      { limit: globalProviderSettings.topAgents },
      i18n.language
    );
    setTaskState({
      recommendedAgents: agents,
      selectedAgentId: agents[0]?.id ?? null
    });
  }, [setTaskState, styleResult, globalProviderSettings, i18n.language]);

  return (
    <Card
      className="border-border/50 bg-card/60 backdrop-blur-sm shadow-sm rounded-xl h-full flex flex-col"
      ref={sectionRef}
    >
      <CardHeader className="pb-3 sm:pb-4 flex-shrink-0">
        <CardTitle className="text-lg sm:text-xl">{t('result.title')}</CardTitle>
        <CardDescription className="text-sm text-muted-foreground/80">
          {t('result.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 flex-1 overflow-y-auto min-h-0">
        {/* Status Messages */}
        <StatusMessages
          isOnline={isOnline}
          runError={runError}
          styleResult={!!styleResult}
          evaluation={!!evaluation}
          lastLatencyMs={lastLatencyMs}
        />

        {/* Active Agent Display */}
        <ActiveAgentDisplay agent={agent} />

        {/* Agent Selector */}
        {!evaluation && styleResult && (
          <AgentSelector
            recommendedAgents={recommendedAgents}
            selectedAgentId={selectedAgentId}
            onSelectAgent={(id) => setTaskState({ selectedAgentId: id })}
            isExpanded={isAgentSelectorExpanded}
            onToggleExpand={setIsAgentSelectorExpanded}
          />
        )}

        {/* Evaluation Results */}
        <EvaluationResults
          evaluation={evaluation}
          exif={processedImage?.exif ?? null}
          lastLatencyMs={lastLatencyMs}
          isProcessing={isProcessing}
          processingStage={processingStage}
          onDownloadXmp={handleDownloadXmp}
          onSaveToHistory={handleSaveHistory}
        />

        {/* Evaluation Controls */}
        <EvaluationControls
          styleResult={!!styleResult}
          evaluation={!!evaluation}
          isProcessing={isProcessing}
          passphrase={passphrase}
          highlightRun={highlightRun}
          onChangePassphrase={setPassphrase}
          onRun={handleRun}
          onRunMock={handleRunMock}
        />
      </CardContent>
    </Card>
  );
}
