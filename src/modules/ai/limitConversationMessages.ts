/**
 * Limit conversation messages by total character length.
 * Keeps only the latest system message and counts it toward the limit.
 */

import type { ChatMessage } from '@/types/conversation';

type MessageList = ChatMessage[];

function normalizeContentLength(content: string): number {
  return content.replace(/\s+/g, ' ').trim().length;
}

export function limitConversationMessages(messages: MessageList, maxChars?: number): MessageList {
  if (!Array.isArray(messages) || messages.length === 0 || !maxChars || maxChars <= 0) {
    return messages;
  }

  const systemMessages = messages.filter((message) => message.role === 'system');
  const latestSystem = systemMessages.length
    ? systemMessages[systemMessages.length - 1]
    : null;
  const history = messages.filter((message) => message.role !== 'system');
  const limited: MessageList = [];
  const systemLength = latestSystem ? normalizeContentLength(latestSystem.content) : 0;
  let totalLength = systemLength;

  if (latestSystem && systemLength >= maxChars) {
    return [latestSystem];
  }

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index];
    const nextLength = totalLength + normalizeContentLength(message.content);
    if (nextLength > maxChars) {
      break;
    }
    limited.push(message);
    totalLength = nextLength;
  }

  return latestSystem ? [latestSystem, ...limited.reverse()] : limited.reverse();
}
