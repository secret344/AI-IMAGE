import type { StyleTag, StyleTagScore } from '@/config/style-tags';
import { STYLE_TAGS } from '@/config/style-tags';
import { loadApiKey } from '@/modules/storage/keys';
import { loadProviderSettings } from '@/modules/storage/settings';
import { callAiProvider } from '@/modules/ai/client';

export interface StyleRecognitionResult {
  styleTags: StyleTagScore[];
  inferenceTime: number;
  modelUsed: string;
}

const STYLE_TAG_SET = new Set(STYLE_TAGS);

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
      console.log('Successfully parsed JSON from candidate');
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
          console.log('Successfully parsed JSON using brace counting');
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
  userLanguage: 'zh' | 'en',
  passphrase?: string
): Promise<StyleRecognitionResult> {
  const start = performance.now();
  const languageLabel = userLanguage === 'zh' ? 'Simplified Chinese' : 'English';

  const settings = loadProviderSettings();

  // If using mock provider, return mock data
  if (settings.provider === 'mock') {
    const styleTags: StyleTagScore[] = [
      { name: 'City', weight: 0.42, confidence: 0.87 },
      { name: 'Documentary', weight: 0.33, confidence: 0.76 },
      { name: 'Street', weight: 0.25, confidence: 0.68 }
    ];

    return {
      styleTags,
      inferenceTime: Math.round(performance.now() - start),
      modelUsed: 'mock'
    };
  }

  // Load API key if needed
  const loadedKey =
    settings.provider === 'ollama' ? '' : await loadApiKey(settings.keyLabel, passphrase ?? '');
  const apiKey = loadedKey ?? '';

  if (!loadedKey && settings.provider !== 'ollama') {
    throw new Error('API key not found. Please configure it in settings.');
  }

  // Create the style recognition prompt - keep it short to prevent excessive thinking
  const systemPrompt = [
    'You are a professional photography style analyzer.',
    'Analyze the image and identify photographic style tags.',
    `Any human-readable text must be written in ${languageLabel}.`,
    'CRITICAL: Return ONLY valid JSON. No explanation, no markdown, no code fences, no text before or after the JSON.',
    'Use this exact schema: {"styleTags":[{"name":"TagName","weight":0.5,"confidence":0.9}]}'
  ].join('\n');

  const userPrompt = [
    'Analyze this image and return only JSON with 3-5 style tags.',
    `Tags (choose ONLY from this list): ${STYLE_TAGS.join(', ')}.`,
    'Weights must sum to ~1.0. Confidence is 0.0-1.0.',
    'Do not translate tag names; if you add any explanatory text, keep it in the required language.'
  ].join('\n');

  const response = await callAiProvider({
    base64Image,
    systemPrompt,
    userPrompt,
    apiKey,
    provider: settings.provider,
    model: settings.model,
    baseUrl: settings.baseUrl,
    temperature: 0.3, // Lower temperature for consistency
    maxTokens: 500,
    timeoutMs: settings.timeoutMs
  });

  console.log('Style recognition raw response (first 200 chars):', response.slice(0, 200));

  // Parse the response - extract and validate JSON more carefully
  const parsed = extractAndParseJSON(response);
  if (!parsed) {
    console.error('Failed to extract JSON from style recognition response');
    throw new Error(
      `Failed to parse style recognition response - invalid JSON format. Response preview: ${response.slice(0, 200)}`
    );
  }

  const rawTags = Array.isArray((parsed as Record<string, unknown>)?.styleTags)
    ? ((parsed as Record<string, unknown>).styleTags as Record<string, unknown>[])
    : [];

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
    styleTags.push({
      name: 'Documentary',
      weight: 0.5,
      confidence: 0.5
    });
  }

  // Normalize weights to sum to approximately 1.0
  const totalWeight = styleTags.reduce((sum, tag) => sum + tag.weight, 0);
  if (totalWeight > 0) {
    styleTags.forEach((tag) => {
      tag.weight = tag.weight / totalWeight;
    });
  }

  return {
    styleTags,
    inferenceTime: Math.round(performance.now() - start),
    modelUsed: settings.model
  };
}
