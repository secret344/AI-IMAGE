/**
 * 聊天记录存储层 (低耦合设计)
 * 职责：聊天数据的 CRUD 操作，与业务逻辑无关
 * 依赖：conversation.ts 类型定义，db.ts IndexedDB 包装器
 */

import type { ChatMessage, ConversationThread, TaskConversationData } from '@/types/conversation';
import { db } from './db';

/**
 * Generate UUID v4 identifier for threads and messages
 * @return {string} Generated UUID v4 string
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Initialize new conversation with default main thread
 * @return {TaskConversationData} Task conversation data with default thread
 */
export function initializeConversation(): TaskConversationData {
  const defaultThread: ConversationThread = {
    threadId: generateUUID(),
    name: '主讨论',
    purpose: 'main',
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  return {
    defaultThread
  };
}

/**
 * Ensure task conversation exists, creating if necessary
 * @param {string} taskId - Task identifier
 * @return {Promise<TaskConversationData>} Task conversation data
 */
async function ensureConversation(taskId: string): Promise<TaskConversationData> {
  const detail = await db.taskDetails.get(taskId);
  if (!detail) {
    const conversations = initializeConversation();
    await db.taskDetails.put({ taskId, conversations });
    return conversations;
  }

  if (!detail.conversations) {
    const conversations = initializeConversation();
    await db.taskDetails.update(taskId, { conversations });
    return conversations;
  }

  return detail.conversations;
}

/**
 * Add message to specific conversation thread
 * @param {string} taskId - Task identifier
 * @param {string} threadId - Thread identifier
 * @param {Object} message - Chat message to add
 * @return {Promise<ChatMessage>} Created chat message with id and timestamp
 */
export async function addMessageToThread(
  taskId: string,
  threadId: string,
  message: Omit<ChatMessage, 'id' | 'timestamp'>
): Promise<ChatMessage> {
  const detail = await db.taskDetails.get(taskId);
  if (!detail) throw new Error(`Task ${taskId} not found`);

  const newMessage: ChatMessage = {
    ...message,
    id: generateUUID(),
    timestamp: Date.now()
  };

  if (!detail.conversations) {
    detail.conversations = initializeConversation();
  }

  // 如果是主线程，直接修改
  if (threadId === detail.conversations.defaultThread.threadId) {
    detail.conversations.defaultThread.messages.push(newMessage);
    detail.conversations.defaultThread.updatedAt = Date.now();
  } else if (detail.conversations.additionalThreads) {
    // [预留] 其他线程支持
    const thread = detail.conversations.additionalThreads.find((t) => t.threadId === threadId);
    if (thread) {
      thread.messages.push(newMessage);
      thread.updatedAt = Date.now();
    }
  }

  await db.taskDetails.update(taskId, { conversations: detail.conversations });
  return newMessage;
}

/**
 * Add message to main conversation thread, auto-creating if needed
 * @param {string} taskId - Task identifier
 * @param {Object} message - Chat message to add
 * @return {Promise<ChatMessage>} Created chat message with id and timestamp
 */
export async function addMessageToMainThread(
  taskId: string,
  message: Omit<ChatMessage, 'id' | 'timestamp'>
): Promise<ChatMessage> {
  const conversations = await ensureConversation(taskId);
  return addMessageToThread(taskId, conversations.defaultThread.threadId, message);
}

/**
 * Get all conversations for a task
 * @param {string} taskId - Task identifier
 * @return {Promise<TaskConversationData|null>} Task conversation data or null if not found
 */
export async function getConversations(taskId: string): Promise<TaskConversationData | null> {
  const detail = await db.taskDetails.get(taskId);
  return detail?.conversations || null;
}

/**
 * Get messages from main conversation thread
 * @param {string} taskId - Task identifier
 * @return {Promise<ChatMessage[]>} Array of chat messages from main thread
 */
export async function getMainThreadMessages(taskId: string): Promise<ChatMessage[]> {
  const conversations = await getConversations(taskId);
  return conversations?.defaultThread?.messages || [];
}

/**
 * Generate conversation summary from recent messages for re-evaluation context
 * @param {string} taskId - Task identifier
 * @return {Promise<string>} Formatted conversation summary text
 */
export async function generateConversationSummary(taskId: string): Promise<string> {
  const messages = await getMainThreadMessages(taskId);
  if (messages.length === 0) return '';

  // 取最后5条消息
  const recentMessages = messages.slice(-5);

  // 生成摘要
  const summary = recentMessages
    .map((msg) => `${msg.role === 'user' ? '用户' : '助手'}: ${msg.content}`)
    .join('\n\n');

  return summary;
}

/**
 * Clear all conversations for a task
 * @param {string} taskId - Task identifier
 * @return {Promise<void>} Promise resolving when cleared
 */
export async function clearConversations(taskId: string): Promise<void> {
  const detail = await db.taskDetails.get(taskId);
  if (!detail) return;

  detail.conversations = initializeConversation();
  await db.taskDetails.update(taskId, { conversations: detail.conversations });
}

/**
 * Replace main thread messages (for rollback scenarios)
 * @param {string} taskId - Task identifier
 * @param {ChatMessage[]} messages - New messages to set
 * @return {Promise<void>} Promise resolving when replaced
 */
export async function replaceMainThreadMessages(
  taskId: string,
  messages: ChatMessage[]
): Promise<void> {
  const conversations = await ensureConversation(taskId);
  conversations.defaultThread.messages = [...messages];
  conversations.defaultThread.updatedAt = Date.now();
  await db.taskDetails.update(taskId, { conversations });
}

/**
 * Update conversation summary after re-evaluation
 * @param {string} taskId - Task identifier
 * @param {string} summary - New conversation summary text
 * @return {Promise<void>} Promise resolving when updated
 */
export async function updateConversationSummary(taskId: string, summary: string): Promise<void> {
  const detail = await db.taskDetails.get(taskId);
  if (!detail || !detail.conversations) return;

  detail.conversations.conversationSummary = summary;
  await db.taskDetails.update(taskId, { conversations: detail.conversations });
}
