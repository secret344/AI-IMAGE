import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppStore } from '@/state/useAppStore';
import { getAgentById, recommendAgents } from '@/modules/agent/recommendAgents';
import { loadProviderSettings } from '@/modules/storage/settings';
import { AgentSelector } from '@/components/result/AgentSelector';
import { ActiveAgentDisplay } from '@/components/result/ActiveAgentDisplay';
import { EvaluationResults } from '@/components/result/EvaluationResults';
import { EvaluationControls } from '@/components/result/EvaluationControls';
import { StatusMessages } from '@/components/result/StatusMessages';
import { useResultActions } from '@/components/result/useResultActions';

export function ResultPanel() {
  const { t } = useTranslation();
  const [passphrase, setPassphrase] = useState('');
  const [runError, setRunError] = useState<string | null>(null);
  const [highlightRun, setHighlightRun] = useState(false);
  const [isAgentSelectorExpanded, setIsAgentSelectorExpanded] = useState(false);
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const {
    evaluation,
    selectedAgentId,
    styleResult,
    isProcessing,
    processingStage,
    lastLatencyMs,
    isOnline,
    recommendedAgents,
    selectedFileName,
    processedImage,
    setEvaluation,
    setIsProcessing,
    setProcessingStage,
    setLastLatencyMs,
    setRecommendedAgents,
    setSelectedAgentId
  } = useAppStore();
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
    selectedFileName,
    selectedAgentId,
    styleResult,
    agent,
    agentRec,
    isOnline,
    passphrase,
    setEvaluation,
    setIsProcessing,
    setProcessingStage,
    setLastLatencyMs,
    setRunError
  });

  useEffect(() => {
    const handler = () => {
      setHighlightRun(true);
      sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.setTimeout(() => setHighlightRun(false), 1500);
    };
    window.addEventListener('highlight-run', handler);
    return () => window.removeEventListener('highlight-run', handler);
  }, []);

  useEffect(() => {
    const handler = () => {
      if (!styleResult) {
        return;
      }
      const settings = loadProviderSettings();
      const agents = recommendAgents(styleResult.styleTags, { limit: settings.topAgents });
      setRecommendedAgents(agents);
      setSelectedAgentId(agents[0]?.id ?? null);
    };
    window.addEventListener('settings-updated', handler);
    return () => window.removeEventListener('settings-updated', handler);
  }, [setRecommendedAgents, setSelectedAgentId, styleResult]);

  return (
    <div ref={sectionRef}>
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm sticky top-6 sm:top-8">
        <CardHeader className="pb-3 sm:pb-4">
          <CardTitle className="text-lg sm:text-xl">{t('result.title')}</CardTitle>
          <CardDescription className="text-sm text-muted-foreground/80">
            {t('result.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
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
              onSelectAgent={setSelectedAgentId}
              isExpanded={isAgentSelectorExpanded}
              onToggleExpand={setIsAgentSelectorExpanded}
            />
          )}

          {/* Evaluation Results */}
          <EvaluationResults
            evaluation={evaluation}
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
    </div>
  );
}
