import type { AgentProfile } from '@/config/agents';
import type { StyleTagScore } from '@/config/style-tags';

export interface PromptContext {
  exif: Record<string, string | number>;
  styleTags: StyleTagScore[];
}

export function assemblePrompt(
  agent: AgentProfile,
  context: PromptContext,
  language: 'zh' | 'en' = 'en'
): { system: string; user: string } {
  const styleContext = context.styleTags
    .map((tag) => `${tag.name} (${Math.round(tag.weight * 100)}%)`)
    .join(', ');

  const exifContext = Object.entries(context.exif)
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ');

  const languageInstruction =
    language === 'zh'
      ? 'You MUST respond in simplified Chinese (简体中文) ONLY. ALL text fields (reasons, tips, steps, actions) MUST be in Chinese. Only the fixed enum fields "Composition/Lighting/Color/Subject" and "Lightroom/Photoshop" may remain in English.'
      : 'You MUST respond in English ONLY. ALL text fields (reasons, tips, steps, actions) MUST be in English.';

  const system = [
    'You are a professional photography critic and retoucher.',
    languageInstruction,
    'Return ONLY valid JSON. No markdown, no code fences, no extra text.',
    'JSON schema:',
    '{',
    '  "score": number (0-100),',
    '  "dimensions": [',
    '    {"name":"Composition"|"Lighting"|"Color"|"Subject","score":0-100,"reason":"..."}',
    '  ],',
    '  "shootingTips": ["..."],',
    '  "retouchPlan": [',
    '    {"tool":"Lightroom"|"Photoshop","step":"...","action":"...","values":{...},"reason":"..."}',
    '  ]',
    '}'
  ].join('\n');
  const user = [
    agent.prompt,
    `Main styles: ${styleContext}.`,
    `EXIF: ${exifContext || 'None'}.`,
    languageInstruction, // Repeat language requirement
    'Ensure exactly 4 dimensions in order: Composition, Lighting, Color, Subject.',
    'For shootingTips: provide 5-8 distinct tips with concrete, actionable advice.',
    'For retouchPlan: provide 6-10 steps with actionable guidance.',
    'For Lightroom steps, include numeric values and DO NOT limit to only 4 parameters. Use keys such as Exposure, Contrast, Highlights, Shadows, Whites, Blacks, Texture, Clarity, Dehaze, Vibrance, Saturation, Temperature, Tint, Sharpening, NoiseReductionLuminance, NoiseReductionColor, Grain.',
    'For HSL: use HueAdjustmentRed/Orange/Yellow/Green/Aqua/Blue/Purple/Magenta, SaturationAdjustment*, LuminanceAdjustment*.',
    'For split toning: use SplitToningHighlightHue/Saturation, SplitToningShadowHue/Saturation, SplitToningBalance.',
    'For Photoshop steps, describe concrete actions (e.g., dodge/burn, masking, cleanup) and include numeric values when applicable (Opacity, Flow, Feather, Radius, Amount).'
  ].join(' ');

  return { system, user };
}
