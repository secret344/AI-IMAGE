/**
 * 聊天业务流程集成 (低耦合设计)
 * 职责：连接聊天 UI 与存储、API 层
 * 特点：无状态函数，便于测试和扩展
 */

import type { ChatMessage, ChatRequestConfig, ChatContext } from '@/types/conversation';
import { callAgentChat } from '@/modules/ai/chatClient';
import type { EvaluationResult } from '@/types/evaluation';

/**
 * 处理用户发送消息的完整流程
 * 1. 存储用户消息
 * 2. 调用 AI 获取回复
 * 3. 存储 AI 回复
 * 4. 返回两条消息
 */
export async function processChatMessage(
  userMessage: string,
  chatContext: ChatContext,
  chatConfig: ChatRequestConfig,
  conversationHistory: ChatMessage[]
): Promise<ChatMessage | null> {
  try {
    const updatedContext: ChatContext = {
      ...chatContext,
      conversationHistory
    };

    const assistantResponse = await callAgentChat(updatedContext, userMessage, chatConfig);
    return assistantResponse;
  } catch (error) {
    console.error('Failed to process chat message:', error);
    throw error;
  }
}

/**
 * 为重评生成聊天摘要
 * 用于在重评时注入用户与智能体的讨论反馈
 */
export async function getChatContextForReEvaluation(
  messages: ChatMessage[],
  maxMessages: number = 5
): Promise<string> {
  try {
    if (messages.length === 0) return '';

    // 取最后 N 条消息
    const recentMessages = messages.slice(-maxMessages);

    // 格式化为可读文本
    const summary = recentMessages
      .map((msg) => {
        const role = msg.role === 'user' ? '📝 用户' : '🤖 智能体';
        return `${role}:\n${msg.content}`;
      })
      .join('\n\n---\n\n');

    return summary;
  } catch (error) {
    console.error('Failed to generate chat context:', error);
    return '';
  }
}

/**
 * 生成评估结果摘要，用于聊天时的上下文
 */
export function generateEvaluationSummary(result: EvaluationResult): string {
  const dimensionsSummary = result.dimensions
    .map((d) => `- ${d.name}: ${d.score}/100 - ${d.reason}`)
    .join('\n');

  const tipsSummary = result.shootingTips.slice(0, 3).join('\n- ');

  return `【评估总分】${result.score}/100

【各维度评分】
${dimensionsSummary}

【主要建议】
- ${tipsSummary}`;
}
