import { OptimizedStringBuffer } from '@/modules/ai/memoryOptimization';

export interface AiRequest {
  base64Image: string;
  systemPrompt: string;
  userPrompt: string;
  apiKey: string;
  provider: 'openai' | 'gemini' | 'claude' | 'ollama' | 'mock';
  model: string;
  baseUrl: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
}

const THINK_TAG_REGEX = /<think>[\s\S]*?<\/think>/gi;
const THINK_FENCE_REGEX = /```(?:thinking|think|thoughts)[\s\S]*?```/gi;

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
    timeoutMs
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
  _provider: string
): Promise<string> {
  if (!response.body) {
    throw new Error('Response body is missing');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let lineBuffer = '';
  const contentBuffer = new OptimizedStringBuffer();

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
        const line = rawLine.trim();
        if (!line.startsWith('data:')) {
          continue;
        }

        const payload = line.slice(5).trimStart();
        if (!payload || payload === '[DONE]') {
          continue;
        }

        try {
          const data = JSON.parse(payload) as Record<string, unknown>;
          const content = extractContentFn(data);
          if (content) {
            contentBuffer.append(content);
          }
        } catch {
          // Ignore malformed SSE payloads
        }
      }
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

// Helper function to read streaming response
async function readStreamResponse(response: Response): Promise<string> {
  return readSseStream(response, extractOpenAiContent, 'OpenAI');
}

// Helper function to read Claude streaming response
async function readClaudeStreamResponse(response: Response): Promise<string> {
  return readSseStream(response, extractClaudeContent, 'Claude');
}

// Helper function to read Gemini streaming response
async function readGeminiStreamResponse(response: Response): Promise<string> {
  const content = await readSseStream(response, extractGeminiContent, 'Gemini');
  if (!content) {
    throw new Error('Gemini response missing content.');
  }
  return content;
}

// Helper function to read Ollama streaming response
async function readOllamaStreamResponse(response: Response): Promise<string> {
  if (!response.body) {
    throw new Error('Response body is missing');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';

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
          if (typeof (data?.message as Record<string, unknown>)?.thinking === 'string') {
            continue; // Ignore explicit thinking channel
          }

          const message = getRecord(data.message);
          const messageContent = typeof message?.content === 'string' ? message.content : '';
          const responseText = typeof data.response === 'string' ? data.response : '';
          const chunk = messageContent || responseText;

          if (chunk) {
            const sanitized = stripThinkingSegments(chunk);
            if (sanitized) {
              fullContent += sanitized;
            }
          }
        } catch {
          // Ignore partial JSON lines until buffer provides full objects
        }
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
    headers: {
      Accept: 'text/event-stream',
      Authorization: `Bearer ${request.apiKey}`
    },
    body: {
      model: request.model,
      temperature: request.temperature,
      stream: true,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: request.systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: request.userPrompt },
            {
              type: 'image_url',
              image_url: {
                url: request.base64Image
              }
            }
          ]
        }
      ]
    }
  });

  return readStreamResponse(response);
}

async function callGemini(request: AiRequest): Promise<string> {
  const { data, mimeType } = extractDataUrl(request.base64Image);
  // Use streaming endpoint
  const url = `${request.baseUrl}/models/${request.model}:streamGenerateContent?key=${request.apiKey}&alt=sse`;
  const response = await sendJsonRequest({
    url,
    providerLabel: 'Gemini',
    timeoutMs: request.timeoutMs,
    headers: {
      Accept: 'text/event-stream'
    },
    body: {
      contents: [
        {
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
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: request.temperature
      }
    }
  });

  return readGeminiStreamResponse(response);
}

async function callClaude(request: AiRequest): Promise<string> {
  const { data, mimeType } = extractDataUrl(request.base64Image);
  const response = await sendJsonRequest({
    url: `${request.baseUrl}/messages`,
    providerLabel: 'Claude',
    timeoutMs: request.timeoutMs,
    headers: {
      Accept: 'text/event-stream',
      'x-api-key': request.apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: {
      model: request.model,
      system: request.systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: request.userPrompt },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data
              }
            }
          ]
        }
      ],
      temperature: request.temperature,
      stream: true
    }
  });

  return readClaudeStreamResponse(response);
}

async function callOllama(request: AiRequest): Promise<string> {
  const { data } = extractDataUrl(request.base64Image);



  const response = await sendJsonRequest({
    url: `${request.baseUrl}/api/chat`,
    providerLabel: 'Ollama',
    timeoutMs: request.timeoutMs,
    headers: {
      Accept: 'application/x-ndjson'
    },
    body: {
      model: request.model,
      stream: true,
      options: {
        temperature: request.temperature
      },
      messages: [
        {
          role: 'system',
          content: request.systemPrompt
        },
        {
          role: 'user',
          content: request.userPrompt,
          images: [data]
        }
      ]
    }
  });

  return readOllamaStreamResponse(response);
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

async function fetchWithTimeout(input: RequestInfo, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const id = window.setTimeout(() => controller.abort(), timeoutMs);
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
          Authorization: `Bearer ${request.apiKey}`
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
      `${request.baseUrl}/models/${request.model}:generateContent?key=${request.apiKey}`,
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
        'x-api-key': request.apiKey,
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
