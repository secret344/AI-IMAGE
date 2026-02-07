/**
 * 聊天业务流程集成 (低耦合设计)
 * 职责：连接聊天 UI 与存储、API 层
 * 特点：无状态函数，便于测试和扩展
 */

import type { ChatMessage, ChatRequestConfig, ChatContext } from '@/types/conversation';
import { addMessageToThread, getConversations, getMainThreadMessages } from '@/modules/storage/conversation';
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
  taskId: string,
  threadId: string,
  userMessage: string,
  chatContext: ChatContext,
  chatConfig: ChatRequestConfig
): Promise<{ userMsg: ChatMessage; assistantMsg: ChatMessage } | null> {
  try {
    // 1. 存储用户消息
    const storedUserMsg = await addMessageToThread(taskId, threadId, {
      role: 'user',
      content: userMessage,
      threadId,
    });

    // 2. 获取当前对话历史 (用于 AI 上下文)
    const messages = await getMainThreadMessages(taskId);
    const updatedContext: ChatContext = {
      ...chatContext,
      conversationHistory: messages,
    };

    // 3. 调用 AI 获取回复
    const assistantResponse = await callAgentChat(updatedContext, userMessage, chatConfig);

    // 4. 存储 AI 回复
    const storedAssistantMsg = await addMessageToThread(taskId, threadId, {
      role: 'assistant',
      content: assistantResponse.content,
      threadId,
      modelUsed: chatConfig.provider,
    });

    return {
      userMsg: storedUserMsg,
      assistantMsg: storedAssistantMsg,
    };
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
  taskId: string,
  maxMessages: number = 5
): Promise<string> {
  try {
    const messages = await getMainThreadMessages(taskId);
    if (messages.length === 0) return '';

    // 取最后 N 条消息
    const recentMessages = messages.slice(-maxMessages);

    // 格式化为可读文本
    const summary = recentMessages
      .map(msg => {
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
    .map(d => `- ${d.name}: ${d.score}/100 - ${d.reason}`)
    .join('\n');

  const tipsSummary = result.shootingTips.slice(0, 3).join('\n- ');

  return `【评估总分】${result.score}/100

【各维度评分】
${dimensionsSummary}

【主要建议】
- ${tipsSummary}`;
}
