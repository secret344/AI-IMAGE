/**
 * 聊天记录存储层 (低耦合设计)
 * 职责：聊天数据的 CRUD 操作，与业务逻辑无关
 * 依赖：conversation.ts 类型定义，db.ts IndexedDB 包装器
 */

import type { ChatMessage, ConversationThread, TaskConversationData } from '@/types/conversation';
import { db } from './db';

/** 生成 UUID v4 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * 初始化新对话 (创建任务时调用)
 */
export function initializeConversation(): TaskConversationData {
  const defaultThread: ConversationThread = {
    threadId: generateUUID(),
    name: '主讨论',
    purpose: 'main',
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  return {
    defaultThread,
  };
}

/**
 * 向主线程添加消息
 */
export async function addMessageToThread(
  taskId: string,
  threadId: string,
  message: Omit<ChatMessage, 'id' | 'timestamp'>
): Promise<ChatMessage> {
  const task = await db.tasks.get(taskId);
  if (!task) throw new Error(`Task ${taskId} not found`);

  const newMessage: ChatMessage = {
    ...message,
    id: generateUUID(),
    timestamp: Date.now(),
  };

  if (!task.conversations) {
    task.conversations = initializeConversation();
  }

  // 如果是主线程，直接修改
  if (threadId === task.conversations.defaultThread.threadId) {
    task.conversations.defaultThread.messages.push(newMessage);
    task.conversations.defaultThread.updatedAt = Date.now();
  } else if (task.conversations.additionalThreads) {
    // [预留] 其他线程支持
    const thread = task.conversations.additionalThreads.find(t => t.threadId === threadId);
    if (thread) {
      thread.messages.push(newMessage);
      thread.updatedAt = Date.now();
    }
  }

  await db.tasks.update(taskId, { conversations: task.conversations });
  return newMessage;
}

/**
 * 获取任务的所有聊天记录
 */
export async function getConversations(taskId: string): Promise<TaskConversationData | null> {
  const task = await db.tasks.get(taskId);
  return task?.conversations || null;
}

/**
 * 获取主线程的消息列表
 */
export async function getMainThreadMessages(taskId: string): Promise<ChatMessage[]> {
  const conversations = await getConversations(taskId);
  return conversations?.defaultThread?.messages || [];
}

/**
 * 生成聊天摘要 (用于重评时注入上下文)
 * 策略：提取最后5条消息的关键信息
 */
export async function generateConversationSummary(taskId: string): Promise<string> {
  const messages = await getMainThreadMessages(taskId);
  if (messages.length === 0) return '';

  // 取最后5条消息
  const recentMessages = messages.slice(-5);

  // 生成摘要
  const summary = recentMessages
    .map(msg => `${msg.role === 'user' ? '用户' : '助手'}: ${msg.content}`)
    .join('\n\n');

  return summary;
}

/**
 * 清空任务的所有聊天记录
 */
export async function clearConversations(taskId: string): Promise<void> {
  const task = await db.tasks.get(taskId);
  if (!task) return;

  task.conversations = initializeConversation();
  await db.tasks.update(taskId, { conversations: task.conversations });
}

/**
 * 更新聊天摘要 (重评后调用)
 */
export async function updateConversationSummary(
  taskId: string,
  summary: string
): Promise<void> {
  const task = await db.tasks.get(taskId);
  if (!task || !task.conversations) return;

  task.conversations.conversationSummary = summary;
  await db.tasks.update(taskId, { conversations: task.conversations });
}
