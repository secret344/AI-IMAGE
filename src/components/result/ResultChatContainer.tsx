/**
 * 结果-聊天集成容器 (低耦合设计)
 * 职责：管理聊天与结果展示的协调
 * 特点：通过 Props 和 Callbacks 与父组件通信，无直接状态耦合
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EvaluationResults } from '@/components/result/EvaluationResults';
import { ChatPanel } from '@/components/result/ChatPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ChatMessage } from '@/types/conversation';
import type { EvaluationResult } from '@/types/evaluation';

export interface ResultChatContainerProps {
  /** 评估结果 */
  evaluation: EvaluationResult | null;
  /** EXIF 数据 */
  exif: any;
  /** 聊天消息列表 */
  chatMessages: ChatMessage[];
  /** 聊天是否加载中 */
  chatLoading?: boolean;
  /** 聊天错误消息 */
  chatError?: string | null;
  /** 其他属性从结果展示面板传递 */
  lastLatencyMs?: number;
  isProcessing?: boolean;
  processingStage?: string;
  /** 回调函数 */
  onChatSend: (message: string) => void;
  onDownloadXmp: () => void;
  onSaveToHistory: () => void;
  onClearChatError?: () => void;
}

/**
 * 结果与聊天的集成容器
 * 通过 Tabs 在结果和聊天之间切换
 */
export function ResultChatContainer({
  evaluation,
  exif,
  chatMessages,
  chatLoading = false,
  chatError = null,
  lastLatencyMs,
  isProcessing,
  processingStage,
  onChatSend,
  onDownloadXmp,
  onSaveToHistory,
  onClearChatError,
}: ResultChatContainerProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('evaluation');

  // 如果没有评估结果，只显示聊天
  if (!evaluation) {
    return null;
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="evaluation">{t('result.title') || '评估结果'}</TabsTrigger>
        <TabsTrigger value="chat">{t('chat.title') || '与智能体讨论'}</TabsTrigger>
      </TabsList>

      {/* 评估结果面板 */}
      <TabsContent value="evaluation" className="space-y-4">
        <EvaluationResults
          evaluation={evaluation}
          exif={exif}
          lastLatencyMs={lastLatencyMs ?? null}
          isProcessing={isProcessing ?? false}
          processingStage={processingStage ?? null}
          onDownloadXmp={onDownloadXmp}
          onSaveToHistory={onSaveToHistory}
        />
      </TabsContent>

      {/* 聊天面板 */}
      <TabsContent value="chat" className="h-[600px]">
        <ChatPanel
          messages={chatMessages}
          onSend={onChatSend}
          isLoading={chatLoading}
          error={chatError}
          onClearError={onClearChatError}
          disabled={isProcessing}
        />
      </TabsContent>
    </Tabs>
  );
}
