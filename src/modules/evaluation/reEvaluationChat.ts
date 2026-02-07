/**
 * 重评流程中的聊天集成 (低耦合设计)
 * 职责：在重评时收集并注入聊天上下文
 * 特点：作为独立的集成点，不改变现有重评逻辑
 */

import { getChatContextForReEvaluation } from './chatIntegration';
import { generateConversationSummary, updateConversationSummary } from '@/modules/storage/conversation';

/**
 * 为重评准备聊天上下文
 * 返回可注入到提示词中的聊天摘要
 */
export async function prepareChatContextForReEvaluation(
  taskId: string
): Promise<string> {
  try {
    // 获取聊天上下文
    const chatContext = await getChatContextForReEvaluation(taskId, 5);

    if (!chatContext) {
      return '';
    }

    return `\n\n【用户与智能体之前的讨论】\n${chatContext}`;
  } catch (error) {
    console.warn('Failed to prepare chat context for re-evaluation:', error);
    return '';
  }
}

/**
 * 重评完成后，更新聊天摘要
 * 在 TaskRecord 中保存聊天摘要，用于后续参考
 */
export async function updateChatSummaryAfterReEvaluation(
  taskId: string
): Promise<void> {
  try {
    const summary = await generateConversationSummary(taskId);
    if (summary) {
      await updateConversationSummary(taskId, summary);
    }
  } catch (error) {
    console.warn('Failed to update chat summary after re-evaluation:', error);
  }
}

/**
 * [预留] 构建用于新重评的完整聊天提示词
 * 格式：原始评估结果 + 用户反馈 = 新的评估上下文
 */
export function buildChatAugmentedPrompt(
  originalPrompt: string,
  chatContext: string
): string {
  if (!chatContext) {
    return originalPrompt;
  }

  return `${originalPrompt}${chatContext}

【任务】
基于上述用户反馈，重新进行评估。保持客观性，但考虑用户的具体关注点。`;
}
