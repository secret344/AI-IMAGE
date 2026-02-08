import { OptimizedStringBuffer } from '@/modules/ai/memoryOptimization';

export interface AiRequest {
  base64Image: string;
  systemPrompt: string;
  userPrompt: string;
  apiKey: string | null;
  provider: 'openai' | 'gemini' | 'claude' | 'ollama' | 'mock';
  model: string;
  baseUrl: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  signal?: AbortSignal;
  onToken?: (chunk: string) => void;
  includeThinking?: boolean;
  messages?: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
}

const THINK_TAG_REGEX = /<think>[\s\S]*?<\/think>/gi;
const THINK_FENCE_REGEX = /```(?:thinking|think|thoughts)[\s\S]*?```/gi;
const THINKING_START_MARKER = '[[THINKING]]';
const THINKING_END_MARKER = '[[/THINKING]]';

function stripThinkingSegments(text?: string | null): string {
  if (!text) {
    return '';
  }
  return text.replace(THINK_TAG_REGEX, '').replace(THINK_FENCE_REGEX, '').trim();
}

interface JsonRequestOptions {
  url: string;
  providerLabel: string;
  timeoutMs: number;
  method?: 'POST' | 'GET';
  headers?: Record<string, string>;
  body?: unknown;
  includeContentType?: boolean;
  signal?: AbortSignal;
}

async function sendJsonRequest(options: JsonRequestOptions): Promise<Response> {
  const {
    url,
    providerLabel,
    timeoutMs,
    method = 'POST',
    headers = {},
    body,
    includeContentType = true
  } = options;

  const mergedHeaders = {
    ...(includeContentType ? { 'Content-Type': 'application/json' } : {}),
    ...headers
  };

  const response = await fetchWithTimeout(
    url,
    {
      method,
      headers: mergedHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined
    },
    timeoutMs,
    options.signal
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw toAiError(
      `${providerLabel} request failed: ${response.status} ${errorText}`,
      response.status
    );
  }

  return response;
}

async function readSseStream(
  response: Response,
  extractContentFn: (data: Record<string, unknown>) => string | null,
  _provider: string,
  onToken?: (chunk: string) => void
): Promise<string> {
  if (!response.body) {
    throw new Error('Response body is missing');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let lineBuffer = '';
  const contentBuffer = new OptimizedStringBuffer();

  const processLine = (rawLine: string) => {
    const line = rawLine.trim();
    if (!line.startsWith('data:')) {
      return;
    }

    const payload = line.slice(5).trimStart();
    if (!payload || payload === '[DONE]') {
      return;
    }

    try {
      const data = JSON.parse(payload) as Record<string, unknown>;
      const content = extractContentFn(data);
      if (content) {
        contentBuffer.append(content);
        onToken?.(content);
      }
    } catch {
      // Ignore malformed SSE payloads
    }
  };

  // eslint-disable-next-line no-constant-condition
  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      lineBuffer += decoder.decode(value, { stream: true });
      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop() ?? '';

      for (const rawLine of lines) {
        processLine(rawLine);
      }
    }

    if (lineBuffer.trim()) {
      processLine(lineBuffer);
    }

    return contentBuffer.toString();
  } finally {
    contentBuffer.clear();
    lineBuffer = '';
    reader.cancel().catch(() => {
      // Ignore cancel errors
    });
  }
}

function getRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  return value as Record<string, unknown>;
}

function getArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function extractOpenAiContent(data: Record<string, unknown>): string | null {
  const choices = getArray(data.choices);
  const firstChoice = getRecord(choices[0]);
  const delta = getRecord(firstChoice?.delta);
  if (!delta || delta.thinking || delta.reasoning_content) {
    return null;
  }

  const rawContent = delta.content;
  if (typeof rawContent === 'string') {
    const sanitized = stripThinkingSegments(rawContent);
    return sanitized || null;
  }

  if (Array.isArray(rawContent)) {
    const combined = rawContent
      .map((part) => {
        const record = getRecord(part);
        return typeof record?.text === 'string' ? record.text : '';
      })
      .join('');
    const sanitized = stripThinkingSegments(combined);
    return sanitized || null;
  }

  return null;
}

function extractClaudeContent(data: Record<string, unknown>): string | null {
  const type = typeof data.type === 'string' ? data.type : null;
  if (type === 'content_block_delta') {
    const delta = getRecord(data.delta);
    const deltaType = typeof delta?.type === 'string' ? delta.type : null;
    if (deltaType === 'thinking_delta') {
      return null;
    }
    if (deltaType === 'text_delta') {
      const deltaText = typeof delta?.text === 'string' ? delta.text : '';
      const sanitized = stripThinkingSegments(deltaText);
      return sanitized || null;
    }
  }
  return null;
}

function extractGeminiContent(data: Record<string, unknown>): string | null {
  const candidates = getArray(data.candidates);
  const candidate = getRecord(candidates[0]);
  if (!candidate) {
    return null;
  }

  const candidateContent = getRecord(candidate.content);
  const candidateDelta = getRecord(candidate.delta);
  const partsValue = candidateContent?.parts ?? candidateDelta?.parts;

  if (Array.isArray(partsValue)) {
    const text = partsValue
      .map((part) => {
        const record = getRecord(part);
        return typeof record?.text === 'string' ? record.text : '';
      })
      .join('');
    const sanitized = stripThinkingSegments(text);
    return sanitized || null;
  }

  const deltaText = typeof candidateDelta?.text === 'string' ? candidateDelta.text : '';
  if (deltaText) {
    const sanitized = stripThinkingSegments(deltaText);
    return sanitized || null;
  }

  const parts = Array.isArray(candidateContent?.parts) ? candidateContent?.parts : [];
  const firstPart = getRecord(parts[0]);
  const partText = typeof firstPart?.text === 'string' ? firstPart.text : '';
  const sanitized = stripThinkingSegments(partText);
  return sanitized || null;
}

function buildOpenAiMessages(request: AiRequest) {
  const history = (request.messages ?? []).filter((message) => message.role !== 'system');
  const baseMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: request.systemPrompt },
    ...history
  ];

  const userContent = request.base64Image
    ? [
        { type: 'text', text: request.userPrompt },
        {
          type: 'image_url',
          image_url: {
            url: request.base64Image
          }
        }
      ]
    : request.userPrompt;

  return [...baseMessages, { role: 'user', content: userContent }];
}

type ClaudeContentBlock =
  | { type: 'text'; text: string }
  | {
      type: 'image';
      source: { type: 'base64'; media_type: string; data: string };
    };

type ClaudeMessage = { role: 'user' | 'assistant'; content: ClaudeContentBlock[] };

type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } };

type GeminiContent = { role: 'user' | 'model'; parts: GeminiPart[] };

function buildClaudeMessages(request: AiRequest): ClaudeMessage[] {
  const history = (request.messages ?? []).filter((message) => message.role !== 'system');
  const messages: ClaudeMessage[] = history.map((message) => ({
    role: message.role === 'assistant' ? 'assistant' : 'user',
    content: [{ type: 'text', text: message.content }]
  }));

  let userContent: ClaudeContentBlock[] = [{ type: 'text', text: request.userPrompt }];

  if (request.base64Image) {
    const { data, mimeType } = extractDataUrl(request.base64Image);
    userContent = [
      { type: 'text', text: request.userPrompt },
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: mimeType,
          data
        }
      }
    ];
  }

  messages.push({ role: 'user', content: userContent });
  return messages;
}

function buildGeminiContents(request: AiRequest) {
  const history = request.messages ?? [];
  const contents: GeminiContent[] = history.map((message) => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: message.content }]
  }));

  if (request.base64Image) {
    const { data, mimeType } = extractDataUrl(request.base64Image);
    contents.push({
      role: 'user',
      parts: [
        { text: `${request.systemPrompt}\n${request.userPrompt}` },
        {
          inline_data: {
            mime_type: mimeType,
            data
          }
        }
      ]
    });
  } else {
    contents.push({
      role: 'user',
      parts: [{ text: `${request.systemPrompt}\n${request.userPrompt}` }]
    });
  }

  return contents;
}

// Helper function to read Gemini streaming response
async function readGeminiStreamResponse(
  response: Response,
  onToken?: (chunk: string) => void
): Promise<string> {
  const content = await readSseStream(response, extractGeminiContent, 'Gemini', onToken);
  if (!content) {
    throw new Error('Gemini response missing content.');
  }
  return content;
}

// Helper function to read Ollama streaming response
async function readOllamaStreamResponse(
  response: Response,
  onToken?: (chunk: string) => void,
  includeThinking?: boolean
): Promise<string> {
  if (!response.body) {
    throw new Error('Response body is missing');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';
  let hasThinking = false;
  let hasAnswer = false;

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        try {
          const data = JSON.parse(line) as Record<string, unknown>;
          const message = getRecord(data.message);
          const thinkingChunk = typeof message?.thinking === 'string' ? message.thinking : '';
          const messageContent = typeof message?.content === 'string' ? message.content : '';
          const responseText = typeof data.response === 'string' ? data.response : '';

          if (thinkingChunk && includeThinking) {
            if (!hasThinking) {
              fullContent += THINKING_START_MARKER;
              onToken?.(THINKING_START_MARKER);
            }
            fullContent += thinkingChunk;
            hasThinking = true;
            onToken?.(thinkingChunk);
          }

          const chunk = messageContent || responseText;
          if (chunk) {
            const sanitized = stripThinkingSegments(chunk);
            if (sanitized) {
              if (includeThinking && hasThinking && !hasAnswer) {
                fullContent += `${THINKING_END_MARKER}\n\n`;
                onToken?.(`${THINKING_END_MARKER}\n\n`);
              }
              hasAnswer = true;
              fullContent += sanitized;
              onToken?.(sanitized);
            }
          }
        } catch {
          // Ignore partial JSON lines until buffer provides full objects
        }
      }
    }

    const remaining = buffer.trim();
    if (remaining) {
      try {
        const data = JSON.parse(remaining) as Record<string, unknown>;
        const message = getRecord(data.message);
        const thinkingChunk = typeof message?.thinking === 'string' ? message.thinking : '';
        const messageContent = typeof message?.content === 'string' ? message.content : '';
        const responseText = typeof data.response === 'string' ? data.response : '';

        if (thinkingChunk && includeThinking) {
          if (!hasThinking) {
            fullContent += THINKING_START_MARKER;
            onToken?.(THINKING_START_MARKER);
          }
          fullContent += thinkingChunk;
          hasThinking = true;
          onToken?.(thinkingChunk);
        }

        const chunk = messageContent || responseText;
        if (chunk) {
          const sanitized = stripThinkingSegments(chunk);
          if (sanitized) {
            if (includeThinking && hasThinking && !hasAnswer) {
              fullContent += `${THINKING_END_MARKER}\n\n`;
              onToken?.(`${THINKING_END_MARKER}\n\n`);
            }
            hasAnswer = true;
            fullContent += sanitized;
            onToken?.(sanitized);
          }
        }
      } catch {
        // Ignore trailing partial JSON
      }
    }
  } finally {
    reader.releaseLock();
  }

  return fullContent;
}

// Helper function for Ollama requests with better timeout handling
async function fetchOllamaWithCorsSupport(
  url: string,
  options: RequestInit = {},
  timeoutMs = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        ...options.headers,
        Accept: 'application/json'
      }
    });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

export async function callAiProvider(request: AiRequest): Promise<string> {
  if (request.provider === 'mock') {
    throw new Error('Mock provider does not call APIs.');
  }

  if (request.provider === 'openai') {
    return callOpenAi(request);
  }
  if (request.provider === 'gemini') {
    return callGemini(request);
  }
  if (request.provider === 'claude') {
    return callClaude(request);
  }
  if (request.provider === 'ollama') {
    return callOllama(request);
  }

  throw new Error(`Provider ${request.provider} not implemented.`);
}

async function callOpenAi(request: AiRequest): Promise<string> {
  const response = await sendJsonRequest({
    url: `${request.baseUrl}/chat/completions`,
    providerLabel: 'OpenAI',
    timeoutMs: request.timeoutMs,
    signal: request.signal,
    headers: {
      Accept: 'text/event-stream',
      Authorization: `Bearer ${request.apiKey!}`
    },
    body: {
      model: request.model,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      stream: true,
      response_format: { type: 'json_object' },
      messages: buildOpenAiMessages(request)
    }
  });

  return readSseStream(response, extractOpenAiContent, 'OpenAI', request.onToken);
}

async function callGemini(request: AiRequest): Promise<string> {
  // Use streaming endpoint
  const url = `${request.baseUrl}/models/${request.model}:streamGenerateContent?key=${request.apiKey!}&alt=sse`;
  const response = await sendJsonRequest({
    url,
    providerLabel: 'Gemini',
    timeoutMs: request.timeoutMs,
    signal: request.signal,
    headers: {
      Accept: 'text/event-stream'
    },
    body: {
      contents: buildGeminiContents(request),
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: request.temperature,
        maxOutputTokens: request.maxTokens
      }
    }
  });

  return readGeminiStreamResponse(response, request.onToken);
}

async function callClaude(request: AiRequest): Promise<string> {
  const response = await sendJsonRequest({
    url: `${request.baseUrl}/messages`,
    providerLabel: 'Claude',
    timeoutMs: request.timeoutMs,
    signal: request.signal,
    headers: {
      Accept: 'text/event-stream',
      'x-api-key': request.apiKey!,
      'anthropic-version': '2023-06-01'
    },
    body: {
      model: request.model,
      system: request.systemPrompt,
      messages: buildClaudeMessages(request),
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      stream: true
    }
  });

  return readSseStream(response, extractClaudeContent, 'Claude', request.onToken);
}

async function callOllama(request: AiRequest): Promise<string> {
  // 聊天时可能没有图片，只处理有图片的情况
  let messages: Array<{ role: string; content: string; images?: string[] }> = [];

  if (request.messages && request.messages.length > 0) {
    messages = [
      {
        role: 'system',
        content: request.systemPrompt
      },
      ...request.messages.map((message) => ({
        role: message.role,
        content: message.content
      })),
      {
        role: 'user',
        content: request.userPrompt
      }
    ];
  } else {
    messages = [
      {
        role: 'system',
        content: request.systemPrompt
      },
      {
        role: 'user',
        content: request.userPrompt
      }
    ];
  }

  // 如果有图片，添加到消息中
  if (request.base64Image) {
    try {
      const { data } = extractDataUrl(request.base64Image);
      const lastUserIndex = [...messages].reverse().findIndex((message) => message.role === 'user');
      const targetIndex =
        lastUserIndex === -1 ? messages.length - 1 : messages.length - 1 - lastUserIndex;
      if (messages[targetIndex]) {
        messages[targetIndex].images = [data];
      }
    } catch {
      // 如果图片格式不正确，继续处理纯文本消息
    }
  }

  const response = await sendJsonRequest({
    url: `${request.baseUrl}/api/chat`,
    providerLabel: 'Ollama',
    timeoutMs: request.timeoutMs,
    signal: request.signal,
    headers: {
      Accept: 'application/x-ndjson'
    },
    body: {
      model: request.model,
      stream: true,
      options: {
        temperature: request.temperature,
        num_predict: request.maxTokens
      },
      messages
    }
  });

  return readOllamaStreamResponse(response, request.onToken, request.includeThinking);
}

function extractDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
  if (!match) {
    throw new Error('Invalid image data URL.');
  }
  return { mimeType: match[1], data: match[2] };
}

class AiError extends Error {
  status?: number;
  retryable?: boolean;

  constructor(message: string, status?: number, retryable?: boolean) {
    super(message);
    this.name = 'AiError';
    this.status = status;
    this.retryable = retryable;
  }
}

function toAiError(message: string, status?: number) {
  const retryable = status !== undefined && (status === 408 || status === 429 || status >= 500);
  return new AiError(message, status, retryable);
}

async function fetchWithTimeout(
  input: RequestInfo,
  init: RequestInit,
  timeoutMs: number,
  signal?: AbortSignal
) {
  const controller = new AbortController();
  const id = window.setTimeout(() => controller.abort(), timeoutMs);
  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    const err = error as Error;
    if (err.name === 'AbortError') {
      throw new AiError('Request timed out.', undefined, true);
    }
    throw new AiError(err.message || 'Network error.', undefined, true);
  } finally {
    window.clearTimeout(id);
  }
}

export async function healthCheck(request: {
  provider: 'openai' | 'gemini' | 'claude' | 'ollama';
  model: string;
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
}) {
  if (request.provider === 'openai') {
    const response = await fetchWithTimeout(
      `${request.baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${request.apiKey!}`
        },
        body: JSON.stringify({
          model: request.model,
          max_tokens: 8,
          messages: [{ role: 'user', content: 'ping' }]
        })
      },
      request.timeoutMs
    );
    if (!response.ok) {
      const errorText = await response.text();
      throw toAiError(
        `OpenAI health check failed: ${response.status} ${errorText}`,
        response.status
      );
    }
    return;
  }

  if (request.provider === 'gemini') {
    const response = await fetchWithTimeout(
      `${request.baseUrl}/models/${request.model}:generateContent?key=${request.apiKey!}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
          generationConfig: { maxOutputTokens: 8 }
        })
      },
      request.timeoutMs
    );
    if (!response.ok) {
      const errorText = await response.text();
      throw toAiError(
        `Gemini health check failed: ${response.status} ${errorText}`,
        response.status
      );
    }
    return;
  }

  if (request.provider === 'ollama') {
    const response = await fetchOllamaWithCorsSupport(
      `${request.baseUrl}/api/tags`,
      {
        method: 'GET'
      },
      request.timeoutMs
    );
    if (!response.ok) {
      const errorText = await response.text();
      throw toAiError(
        `Ollama health check failed: ${response.status} ${errorText}`,
        response.status
      );
    }
    return;
  }

  const response = await fetchWithTimeout(
    `${request.baseUrl}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': request.apiKey!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: request.model,
        max_tokens: 8,
        messages: [{ role: 'user', content: [{ type: 'text', text: 'ping' }] }]
      })
    },
    request.timeoutMs
  );
  if (!response.ok) {
    const errorText = await response.text();
    throw toAiError(`Claude health check failed: ${response.status} ${errorText}`, response.status);
  }
}
