import { create } from 'zustand';
import type { EvaluationResult } from '@/types/evaluation';
import type { ProcessedImage } from '@/modules/upload/processImage';
import type { StyleRecognitionResult } from '@/modules/style/recognizeStyle';
import type { AgentRecommendation } from '@/modules/agent/recommendAgents';

interface AppState {
  selectedFileName: string | null;
  processedImage: ProcessedImage | null;
  previewImageBase64: string | null;
  styleResult: StyleRecognitionResult | null;
  recommendedAgents: AgentRecommendation[];
  selectedAgentId: string | null;
  isProcessing: boolean;
  processingStage: string | null;
  lastLatencyMs: number | null;
  isOnline: boolean;
  evaluation: EvaluationResult | null;
  setSelectedFileName: (value: string | null) => void;
  setProcessedImage: (value: ProcessedImage | null) => void;
  setPreviewImageBase64: (value: string | null) => void;
  setStyleResult: (value: StyleRecognitionResult | null) => void;
  setRecommendedAgents: (value: AgentRecommendation[]) => void;
  setSelectedAgentId: (value: string | null) => void;
  setIsProcessing: (value: boolean) => void;
  setProcessingStage: (value: string | null) => void;
  setLastLatencyMs: (value: number | null) => void;
  setIsOnline: (value: boolean) => void;
  setEvaluation: (value: EvaluationResult | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedFileName: null,
  processedImage: null,
  previewImageBase64: null,
  styleResult: null,
  recommendedAgents: [],
  selectedAgentId: null,
  isProcessing: false,
  processingStage: null,
  lastLatencyMs: null,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  evaluation: null,
  setSelectedFileName: (value) => set({ selectedFileName: value }),
  setProcessedImage: (value) => set({ processedImage: value }),
  setPreviewImageBase64: (value) => set({ previewImageBase64: value }),
  setStyleResult: (value) => set({ styleResult: value }),
  setRecommendedAgents: (value) => set({ recommendedAgents: value }),
  setSelectedAgentId: (value) => set({ selectedAgentId: value }),
  setIsProcessing: (value) => set({ isProcessing: value }),
  setProcessingStage: (value) => set({ processingStage: value }),
  setLastLatencyMs: (value) => set({ lastLatencyMs: value }),
  setIsOnline: (value) => set({ isOnline: value }),
  setEvaluation: (value) => set({ evaluation: value })
}));
