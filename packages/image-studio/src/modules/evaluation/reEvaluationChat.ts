/**
 * 重评流程中的聊天集成 (低耦合设计)
 * 职责：在重评时收集并注入聊天上下文
 * 特点：作为独立的集成点，不改变现有重评逻辑
 */

import type { ChatMessage } from '@/types/conversation';
import { getChatContextForReEvaluation } from './chatIntegration';
import {
  generateConversationSummary,
  updateConversationSummary
} from '@/modules/storage/conversation';

/**
 * Prepare chat context for re-evaluation by summarizing previous messages
 * @param {ChatMessage[]} messages - Previous chat messages
 * @return {Promise<string>} Formatted chat context string for prompt injection
 */
export async function prepareChatContextForReEvaluation(messages: ChatMessage[]): Promise<string> {
  try {
    // 获取聊天上下文
    const chatContext = await getChatContextForReEvaluation(messages, 5);

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
 * Update chat summary in task after re-evaluation completes
 * @param {string} taskId - Task identifier
 * @return {Promise<void>} Promise resolving when updated
 */
export async function updateChatSummaryAfterReEvaluation(taskId: string): Promise<void> {
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
 * Build complete chat prompt for re-evaluation with new prompt
 * @param {string} originalPrompt - Original evaluation prompt
 * @param {string} chatContext - Previous conversation context
 * @return {string} Combined prompt string for re-evaluation
 */
export function buildChatAugmentedPrompt(originalPrompt: string, chatContext: string): string {
  if (!chatContext) {
    return originalPrompt;
  }

  return `${originalPrompt}${chatContext}

【任务】
基于上述用户反馈，重新进行评估。保持客观性，但考虑用户的具体关注点。`;
}
