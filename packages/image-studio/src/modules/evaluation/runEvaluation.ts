import type { ProcessedImage } from '@/modules/upload/processImage';
import type { StyleRecognitionResult } from '@/modules/style/recognizeStyle';
import type { AgentProfile } from '@/config/agents';
import type { LanguageCode } from '@/config/i18n-config';
import type { ChatMessage } from '@/types/conversation';
import { assemblePrompt } from '@/modules/prompt/assemblePrompt';
import { callAiProvider } from '@/modules/ai/client';
import { validateResult } from '@/modules/validation/validateResult';
import { wrapMemorySafeAiCall } from '@/modules/ai/memoryOptimization';
import { limitConversationMessages } from '@/modules/ai/limitConversationMessages';

/**
 * 运行评估的输入参数
 * 包含处理后的图片、风格识别结果、代理配置和 AI 提供商设置
 */
export interface RunEvaluationInput {
  processedImage: ProcessedImage;
  styleResult: StyleRecognitionResult;
  agent: AgentProfile;
  apiKey: string;
  provider: 'openai' | 'gemini' | 'claude' | 'ollama' | 'mock';
  model: string;
  baseUrl: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  language?: LanguageCode;
  conversationHistory?: ChatMessage[];
  contextMaxChars?: number;
}

export async function runEvaluation(input: RunEvaluationInput) {
  // 使用新的 V2 版本，支持中英双语
  const assembled = assemblePrompt(
    input.agent,
    {
      exif: input.processedImage.exif,
      styleTags: input.styleResult.styleTags,
      styleDescription: input.styleResult.styleDescription
    },
    input.language || 'en',
    false // 生产环境不需要调试信息
  );

  // Convert chat history to messages format for AI
  const limitedHistory = limitConversationMessages(
    input.conversationHistory ?? [],
    input.contextMaxChars
  );
  const messages = limitedHistory.map((msg) => ({
    role: msg.role as 'system' | 'user' | 'assistant',
    content: msg.content
  }));

  // When there's conversation history as context, prepend a clarification to explain
  // that only non-system messages are background context and this is an independent evaluation
  let userPrompt = assembled.user;
  if (messages.length > 0) {
    const contextClue =
      input.language === 'zh'
        ? `【重要说明】
      以下非 system 角色的消息（不包括当前这条 user 请求）是与该图片相关的历史讨论内容（仅供参考）。这些讨论中的调整、建议或评论不适用于当前的新评估任务。
你需要忽略历史消息中的任何评分或建议，针对该图片进行全新、独立的评估，返回严格的 JSON 格式结果。

---

`
        : `【Important Note】
      The following non-system messages (excluding the current user request) are historical discussion content related to this image (for reference only). Any adjustments, suggestions, or comments in these discussions do not apply to the current new evaluation task.
You must ignore any scores or suggestions in the historical messages and perform a fresh, independent evaluation of the image, returning strict JSON format results.

---

`;
    userPrompt = contextClue + userPrompt;
  }

  const response = await wrapMemorySafeAiCall(() =>
    callWithRetry(
      () =>
        callAiProvider({
          base64Image: input.processedImage.base64,
          systemPrompt: assembled.system,
          userPrompt,
          apiKey: input.apiKey,
          provider: input.provider,
          model: input.model,
          baseUrl: input.baseUrl,
          temperature: input.temperature,
          maxTokens: input.maxTokens,
          timeoutMs: input.timeoutMs,
          messages
        }),
      2
    )
  );

  // callAiProvider 现在返回 { content, thinking }，只需 content 用于解析
  const parsed = safeParseJson(response.content);
  if (parsed.recovered) {
    console.warn('[Evaluation] JSON recovery applied: mixed or duplicated output detected.');
  }
  const result = validateResult(parsed.payload, input.language || 'en');
  return { ...result, parseRecovered: parsed.recovered };
}

async function callWithRetry<T>(fn: () => Promise<T>, retries: number): Promise<T> {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fn();
    } catch (error) {
      attempt += 1;
      const err = error as { retryable?: boolean; message?: string };
      if (!err.retryable || attempt > retries) {
        throw error;
      }
      const delay = Math.min(2000, 500 * Math.pow(2, attempt - 1));
      await new Promise((resolve) => setTimeout(resolve, delay + Math.random() * 200));
    }
  }
}

function safeParseJson(text: string): { payload: unknown; recovered: boolean } {
  const trimmed = text.trim();
  const candidates = [
    trimmed,
    extractJsonBlock(trimmed),
    ...extractJsonObjects(trimmed),
    extractFirstJsonObject(trimmed)
  ].filter(Boolean) as string[];
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    try {
      return { payload: JSON.parse(candidate), recovered: index > 0 };
    } catch {
      continue;
    }
  }
  return { payload: null, recovered: false };
}

function extractJsonBlock(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    return fenced[1];
  }
  return null;
}

function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const char = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\' && inString) {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) {
      continue;
    }
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
}

function extractJsonObjects(text: string): string[] {
  const results: string[] = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\' && inString) {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) {
      continue;
    }

    if (char === '{') {
      if (depth === 0) {
        start = i;
      }
      depth += 1;
    } else if (char === '}') {
      if (depth > 0) {
        depth -= 1;
        if (depth === 0 && start !== -1) {
          results.push(text.slice(start, i + 1));
          start = -1;
        }
      }
    }
  }

  return results;
}
