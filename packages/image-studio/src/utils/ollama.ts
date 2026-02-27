const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434';

const NON_OLLAMA_HOST_PATTERNS = [
  /openai\.com$/i,
  /anthropic\.com$/i,
  /googleapis\.com$/i,
  /openrouter\.ai$/i
];

export function normalizeOllamaBaseUrl(input?: string): string {
  const rawInput = input?.trim() ?? '';
  if (!rawInput) {
    return DEFAULT_OLLAMA_BASE_URL;
  }

  const candidate = /^https?:\/\//i.test(rawInput) ? rawInput : `http://${rawInput}`;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(candidate);
  } catch {
    return DEFAULT_OLLAMA_BASE_URL;
  }

  if (NON_OLLAMA_HOST_PATTERNS.some((pattern) => pattern.test(parsedUrl.hostname))) {
    return DEFAULT_OLLAMA_BASE_URL;
  }

  let pathname = parsedUrl.pathname.replace(/\/+$/, '');
  if (pathname === '/v1' || pathname === '/api') {
    pathname = '';
  }

  parsedUrl.pathname = pathname || '/';
  parsedUrl.search = '';
  parsedUrl.hash = '';

  return `${parsedUrl.origin}${parsedUrl.pathname === '/' ? '' : parsedUrl.pathname}`;
}

export function buildOllamaUrl(baseUrl: string, endpoint: string): string {
  const normalizedBaseUrl = normalizeOllamaBaseUrl(baseUrl);
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${normalizedBaseUrl}${normalizedEndpoint}`;
}
