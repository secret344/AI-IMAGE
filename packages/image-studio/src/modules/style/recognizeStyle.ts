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
import { limitConversationMessages } from '@/modules/ai/limitConversationMessages';
import { callAiProvider } from '@/modules/ai/client';
import type { ChatMessage } from '@/types/conversation';

/**
 * 风格识别结果
 * 包含识别到的风格标签、描述、推理时间和使用的模型
 */
export interface StyleRecognitionResult {
  styleTags: StyleTagScore[];
  styleDescription: string;
  inferenceTime: number;
  modelUsed: string;
}

const STYLE_TAG_SET = new Set(STYLE_TAGS);

const STYLE_SYSTEM_PROMPT_EN = [
  'You are a professional photography style analyzer.',
  'Analyze the image and identify photographic style tags.',
  'CRITICAL: You MUST return ONLY valid JSON in this exact format: {"styleTags":[{"name":"TagName","weight":0.5,"confidence":0.9}],"description":"..."}',
  'Rules:',
  '1. Output ONLY the JSON object, nothing else.',
  '2. No explanation text, no markdown, no code fences, no backticks.',
  '3. The JSON must be valid and parseable.',
  '4. Do not include thinking tags or any other content.'
];

const STYLE_SYSTEM_PROMPT_ZH = [
  '你是一名专业的摄影风格分析师。',
  '请分析图片并识别摄影风格标签。',
  '关键要求：你必须只返回严格有效的 JSON，格式为：{"styleTags":[{"name":"TagName","weight":0.5,"confidence":0.9}],"description":"..."}',
  '规则：',
  '1. 仅输出 JSON 对象，不得输出其他内容。',
  '2. 禁止解释文字、Markdown、代码块或反引号。',
  '3. JSON 必须可解析。',
  '4. 不要输出思考标签或其他额外内容。'
];

const STYLE_USER_PROMPT_EN = [
  'Analyze this image and return only JSON with 3-5 style tags.',
  'Weights must sum to ~1.0. Confidence is 0.0-1.0.',
  'Do not translate tag names; if you add any explanatory text, keep it in the required language.'
];

const STYLE_USER_PROMPT_ZH = [
  '请分析这张图片，并仅返回包含 3-5 个风格标签的 JSON。',
  '权重之和应约等于 1.0，置信度范围 0.0-1.0。',
  '不要翻译标签名称；如需任何说明文字，务必使用要求的语言。'
];

function buildStyleSystemPrompt(language: LanguageCode, languageLabel: string): string {
  const useZh = language.toLowerCase().startsWith('zh');
  const base = useZh ? STYLE_SYSTEM_PROMPT_ZH : STYLE_SYSTEM_PROMPT_EN;
  const languageHint = useZh
    ? '所有可读文本（如描述）必须使用简体中文。'
    : `Any human-readable text (like description) must be written in ${languageLabel}.`;

  return [
    base[0],
    base[1],
    languageHint,
    base[2],
    base[3],
    base[4],
    base[5],
    base[6],
    base[7]
  ].join('\n');
}

function buildStyleUserPrompt(language: LanguageCode): string {
  const useZh = language.toLowerCase().startsWith('zh');
  const base = useZh ? STYLE_USER_PROMPT_ZH : STYLE_USER_PROMPT_EN;
  const tagLine = useZh
    ? `标签（仅可从以下列表中选择）：${STYLE_TAGS.join(', ')}。`
    : `Tags (choose ONLY from this list): ${STYLE_TAGS.join(', ')}.`;

  return [base[0], tagLine, base[1], base[2]].join('\n');
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
  const systemPrompt = buildStyleSystemPrompt(userLanguage, languageLabel);
  const userPrompt = buildStyleUserPrompt(userLanguage);

  let response = '';
  try {
    const limitedHistory = limitConversationMessages(chatHistory ?? [], settings.contextMaxChars);
    const apiResponse = await callAiProvider({
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
      messages: limitedHistory.map((message) => ({
        role: message.role,
        content: message.content
      }))
    });
    // callAiProvider 现在返回 { content, thinking }
    response = apiResponse.content;
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
