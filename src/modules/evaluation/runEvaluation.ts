import type { ProcessedImage } from '@/modules/upload/processImage';
import type { StyleRecognitionResult } from '@/modules/style/recognizeStyle';
import type { AgentProfile } from '@/config/agents';
import type { LanguageCode } from '@/config/i18n-config';
import { assemblePrompt } from '@/modules/prompt/assemblePrompt';
import { callAiProvider } from '@/modules/ai/client';
import { validateResult } from '@/modules/validation/validateResult';
import { wrapMemorySafeAiCall } from '@/modules/ai/memoryOptimization';

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

  const response = await wrapMemorySafeAiCall(() =>
    callWithRetry(
      () =>
        callAiProvider({
          base64Image: input.processedImage.base64,
          systemPrompt: assembled.system,
          userPrompt: assembled.user,
          apiKey: input.apiKey,
          provider: input.provider,
          model: input.model,
          baseUrl: input.baseUrl,
          temperature: input.temperature,
          maxTokens: input.maxTokens,
          timeoutMs: input.timeoutMs
        }),
      2
    )
  );

  const payload = safeParseJson(response);
  return validateResult(payload, input.language || 'en');
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

function safeParseJson(text: string) {
  const trimmed = text.trim();
  const candidates = [trimmed, extractJsonBlock(trimmed)].filter(Boolean) as string[];
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      continue;
    }
  }
  return null;
}

function extractJsonBlock(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    return fenced[1];
  }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    return text.slice(start, end + 1);
  }
  return null;
}
