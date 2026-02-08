import type { StyleTag, StyleTagScore } from '@/config/style-tags';
import { STYLE_TAGS } from '@/config/style-tags';
import {
  getLanguagePromptLabel,
  getStyleRecognitionI18n,
  type LanguageCode
} from '@/config/i18n-config';
import { loadApiKey } from '@/modules/storage/keys';
import { loadProviderSettings } from '@/modules/storage/settings';
import type { ProviderSettings } from '@/modules/storage/settings';
import { callAiProvider } from '@/modules/ai/client';
import type { ChatMessage } from '@/types/conversation';

export interface StyleRecognitionResult {
  styleTags: StyleTagScore[];
  styleDescription: string;
  inferenceTime: number;
  modelUsed: string;
}

const STYLE_TAG_SET = new Set(STYLE_TAGS);

const STYLE_SYSTEM_PROMPT_STATIC = [
  'You are a professional photography style analyzer.',
  'Analyze the image and identify photographic style tags.',
  'CRITICAL: You MUST return ONLY valid JSON in this exact format: {"styleTags":[{"name":"TagName","weight":0.5,"confidence":0.9}],"description":"..."}',
  'Rules:',
  '1. Output ONLY the JSON object, nothing else.',
  '2. No explanation text, no markdown, no code fences, no backticks.',
  '3. The JSON must be valid and parseable.',
  '4. Do not include thinking tags or any other content.'
];

const STYLE_USER_PROMPT_STATIC = [
  'Analyze this image and return only JSON with 3-5 style tags.',
  'Weights must sum to ~1.0. Confidence is 0.0-1.0.',
  'Do not translate tag names; if you add any explanatory text, keep it in the required language.'
];

function buildStyleSystemPrompt(languageLabel: string): string {
  return [
    STYLE_SYSTEM_PROMPT_STATIC[0],
    STYLE_SYSTEM_PROMPT_STATIC[1],
    `Any human-readable text (like description) must be written in ${languageLabel}.`,
    STYLE_SYSTEM_PROMPT_STATIC[2],
    STYLE_SYSTEM_PROMPT_STATIC[3],
    STYLE_SYSTEM_PROMPT_STATIC[4],
    STYLE_SYSTEM_PROMPT_STATIC[5],
    STYLE_SYSTEM_PROMPT_STATIC[6],
    STYLE_SYSTEM_PROMPT_STATIC[7]
  ].join('\n');
}

function buildStyleUserPrompt(): string {
  const basePrompt = [
    STYLE_USER_PROMPT_STATIC[0],
    `Tags (choose ONLY from this list): ${STYLE_TAGS.join(', ')}.`,
    STYLE_USER_PROMPT_STATIC[1],
    STYLE_USER_PROMPT_STATIC[2]
  ].join('\n');

  return basePrompt;
}

type RawStyleTag = {
  name: string;
  weight: number;
  confidence: number;
};

function normalizeStyleTagName(input: unknown): StyleTag | null {
  if (typeof input !== 'string') {
    return null;
  }

  const trimmed = input.trim();
  if (STYLE_TAG_SET.has(trimmed as StyleTag)) {
    return trimmed as StyleTag;
  }

  const lower = trimmed.toLowerCase();
  const matched = STYLE_TAGS.find((tag) => tag.toLowerCase() === lower);
  return matched ?? null;
}

function isRawStyleTag(value: Record<string, unknown>): value is RawStyleTag {
  return (
    typeof value.name === 'string' &&
    typeof value.weight === 'number' &&
    typeof value.confidence === 'number'
  );
}

function deriveStyleTagsFromText(text: string): StyleTagScore[] {
  const lower = text.toLowerCase();
  const matched = STYLE_TAGS.filter((tag) => lower.includes(tag.toLowerCase()));
  const selected = (matched.length > 0 ? matched : ['Documentary', 'Street', 'City'])
    .filter((tag) => STYLE_TAG_SET.has(tag as StyleTag))
    .slice(0, 5) as StyleTag[];

  const weight = selected.length > 0 ? 1 / selected.length : 1;
  return selected.map((tag) => ({
    name: tag,
    weight,
    confidence: 0.4
  }));
}

// Helper function to extract and validate JSON from text
function extractAndParseJSON(text: string): unknown {
  const trimmed = text.trim();

  if (!trimmed) {
    console.warn('Empty response text for JSON parsing');
    return null;
  }

  // Try candidates in order of likelihood
  const candidates: string[] = [];

  // 1. Try the text as-is first
  candidates.push(trimmed);

  // 2. Extract JSON between { and } - find first { and last }
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const extracted = trimmed.slice(firstBrace, lastBrace + 1);
    if (extracted !== trimmed) {
      candidates.push(extracted);
    }
  }

  // 3. Extract JSON from markdown code fence (multiple patterns)
  const fencePatterns = [/```json\s*([\s\S]*?)\s*```/i, /```\s*([\s\S]*?)\s*```/, /`([^`]+)`/];

  for (const pattern of fencePatterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) {
      const extracted = match[1].trim();
      if (extracted && !candidates.includes(extracted)) {
        candidates.push(extracted);
      }
    }
  }

  // 4. Try to extract JSON after common prefixes
  const prefixes = ['Here is the JSON:', "Here's the JSON:", 'JSON:', 'Response:', 'Result:'];

  for (const prefix of prefixes) {
    const idx = trimmed.indexOf(prefix);
    if (idx !== -1) {
      const afterPrefix = trimmed.slice(idx + prefix.length).trim();
      if (afterPrefix && !candidates.includes(afterPrefix)) {
        candidates.push(afterPrefix);
      }
    }
  }

  // Try to parse each candidate
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate);

      return parsed as unknown;
    } catch (e) {
      // Continue to next candidate
      continue;
    }
  }

  // If all candidates failed, try to be more aggressive
  // Try to find valid JSON by counting braces
  if (firstBrace !== -1) {
    let braceCount = 0;
    for (let i = firstBrace; i < trimmed.length; i++) {
      const char = trimmed[i];
      if (char === '{' || char === '[') braceCount++;
      if (char === '}' || char === ']') braceCount--;

      if (braceCount === 0 && i > firstBrace) {
        const candidate = trimmed.slice(firstBrace, i + 1);
        try {
          const parsed = JSON.parse(candidate);

          return parsed as unknown;
        } catch (e) {
          // Continue
        }
      }
    }
  }

  // Log the failure for debugging
  console.error('Failed to parse JSON from response. First 500 chars:', trimmed.slice(0, 500));
  return null;
}

export async function recognizeStyle(
  base64Image: string,
  userLanguage: LanguageCode,
  passphrase?: string,
  chatHistory?: ChatMessage[],
  providerSettings?: ProviderSettings
): Promise<StyleRecognitionResult> {
  const start = performance.now();
  const languageLabel = getLanguagePromptLabel(userLanguage);

  const settings = providerSettings ?? loadProviderSettings();

  // If using mock provider, return mock data
  if (settings.provider === 'mock') {
    const styleTags: StyleTagScore[] = [
      { name: 'City', weight: 0.42, confidence: 0.87 },
      { name: 'Documentary', weight: 0.33, confidence: 0.76 },
      { name: 'Street', weight: 0.25, confidence: 0.68 }
    ];

    return {
      styleTags,
      styleDescription: getStyleRecognitionI18n(userLanguage).mockDescription,
      inferenceTime: Math.round(performance.now() - start),
      modelUsed: 'mock'
    };
  }

  // Load API key if needed
  const loadedKey =
    settings.provider === 'ollama' ? '' : await loadApiKey(settings.keyLabel, passphrase ?? '');
  const apiKey = loadedKey ?? '';

  if (!loadedKey && settings.provider !== 'ollama') {
    console.warn('[StyleRecognition] API key missing, attempting provider call without key.');
  }

  // Create the style recognition prompt - keep it short to prevent excessive thinking
  const systemPrompt = buildStyleSystemPrompt(languageLabel);
  const userPrompt = buildStyleUserPrompt();

  let response = '';
  try {
    response = await callAiProvider({
      base64Image,
      systemPrompt,
      userPrompt,
      apiKey,
      provider: settings.provider,
      model: settings.model,
      baseUrl: settings.baseUrl,
      temperature: 0.3, // Lower temperature for consistency
      maxTokens: settings.maxTokens,
      timeoutMs: settings.timeoutMs,
      messages: chatHistory?.map((message) => ({
        role: message.role,
        content: message.content
      }))
    });
  } catch (error) {
    console.error('Style recognition API call failed:', error);
    response = '';
  }

  if (!response || !response.trim()) {
    console.warn('Empty response from style recognition API. Using fallback heuristic tags.');
    return {
      styleTags: deriveStyleTagsFromText(''),
      styleDescription: getStyleRecognitionI18n(userLanguage).descriptionPrefix,
      inferenceTime: Math.round(performance.now() - start),
      modelUsed: `${settings.model}-fallback`
    };
  }

  // Parse the response - extract and validate JSON more carefully
  const parsed = extractAndParseJSON(response);
  if (!parsed) {
    console.warn(
      'Failed to extract JSON from style recognition response. Response preview:',
      response.slice(0, 300)
    );
    console.warn('Falling back to heuristic tags.');
  }

  const rawTags =
    parsed && Array.isArray((parsed as Record<string, unknown>)?.styleTags)
      ? ((parsed as Record<string, unknown>).styleTags as Record<string, unknown>[])
      : [];
  const rawDescription =
    parsed && typeof (parsed as Record<string, unknown>)?.description === 'string'
      ? ((parsed as Record<string, unknown>).description as string)
      : '';

  // Validate and normalize the response
  const styleTags: StyleTagScore[] = rawTags
    .filter((tag) => Boolean(tag))
    .filter(isRawStyleTag)
    .map((tag) => {
      const normalizedName = normalizeStyleTagName(tag.name);
      if (!normalizedName) {
        return null;
      }

      return {
        name: normalizedName,
        weight: Math.max(0, Math.min(1, tag.weight)), // Clamp to 0-1
        confidence: Math.max(0, Math.min(1, tag.confidence)) // Clamp to 0-1
      };
    })
    .filter((tag): tag is StyleTagScore => Boolean(tag))
    .slice(0, 5); // Limit to 5 tags

  // If no valid tags, provide fallback
  if (styleTags.length === 0) {
    styleTags.push(...deriveStyleTagsFromText(response));
  }

  const fallbackStyleI18n = getStyleRecognitionI18n(userLanguage);
  const styleDescription = rawDescription.trim()
    ? rawDescription.trim()
    : `${fallbackStyleI18n.descriptionPrefix}${styleTags
        .map((tag) => tag.name)
        .join(userLanguage === 'zh' ? '、' : ', ')}`;

  // Normalize weights to sum to approximately 1.0
  const totalWeight = styleTags.reduce((sum, tag) => sum + tag.weight, 0);
  if (totalWeight > 0) {
    styleTags.forEach((tag) => {
      tag.weight = tag.weight / totalWeight;
    });
  }

  return {
    styleTags,
    styleDescription,
    inferenceTime: Math.round(performance.now() - start),
    modelUsed: settings.model
  };
}
