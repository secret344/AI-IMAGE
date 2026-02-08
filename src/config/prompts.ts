/**
 * 提示词配置 - 中英双语版本
 * 所有提示词统一管理，支持动态语言切换
 */

import { type LanguageCode } from '@/config/i18n-config';

export type Language = LanguageCode;

export interface PromptTemplates {
  system: string;
  userBase: string;
  languageInstruction: string;
  contentRequirements: string;
  outputFormat: string;
}

/**
 * 系统提示词 - 中文版本
 */
const SYSTEM_PROMPT_ZH = `你是一位专业的摄影评论家和后期修图师，擅长从多个维度分析照片质量，并根据不同美学流派提供针对性的拍摄与修图建议。

你必须严格遵循以下输出格式，只返回有效的 JSON，不包含任何 markdown、代码块或额外文本。`;

/**
 * 系统提示词 - 英文版本
 */
const SYSTEM_PROMPT_EN = `You are a professional photography critic and retoucher, adept at analyzing photo quality from multiple dimensions and providing targeted shooting and retouching advice based on different aesthetic schools.

You must strictly follow the output format below, returning ONLY valid JSON without any markdown, code fences, or extra text.`;

/**
 * 用户提示词基础部分 - 中文版本
 */
const USER_BASE_ZH = `请根据以下信息评价这张摄影作品：

主要风格：{styles}
风格描述：{styleDescription}
相机参数：{exif}

重点分析维度：
1. 构图（Composition）：主体安排、视觉引导、负空间平衡
2. 光影（Lighting）：曝光准确性、明暗对比、光线质感
3. 色彩（Color）：色调和谐性、饱和度控制、色彩情绪
4. 主体（Subject）：清晰度、焦点准确性、主体表现力`;

/**
 * 用户提示词基础部分 - 英文版本
 */
const USER_BASE_EN = `Please evaluate this photography based on the following information:

Main styles: {styles}
Style summary: {styleDescription}
Camera parameters: {exif}

Analysis dimensions:
1. Composition: Subject placement, visual flow, negative space balance
2. Lighting: Exposure accuracy, contrast, light quality
3. Color: Tonal harmony, saturation control, color mood
4. Subject: Sharpness, focus accuracy, subject expressiveness`;

/**
 * 语言要求指令 - 中文版本
 */
const LANGUAGE_INSTRUCTION_ZH = `重要：你必须只用简体中文（中文）回答。所有文本字段（理由、建议、步骤、操作）都必须用中文编写。
只有固定的枚举字段"Composition/Lighting/Color/Subject"和"Lightroom/Photoshop"可以保持英文。`;

/**
 * 语言要求指令 - 英文版本
 */
const LANGUAGE_INSTRUCTION_EN = `Important: You MUST respond in English ONLY. All text fields (reasons, tips, steps, actions) MUST be in English.
Only the fixed enum fields "Composition/Lighting/Color/Subject" and "Lightroom/Photoshop" may remain in English.`;

/**
 * 内容要求指令 - 中文版本
 */
const CONTENT_REQUIREMENTS_ZH = `内容要求：
- 确保返回恰好 4 个维度，顺序为：Composition, Lighting, Color, Subject
- shootingTips：提供 5-8 条不同的拍摄建议，每条都要有具体、可操作的指导
- retouchPlan：提供 6-10 个修图步骤，每个步骤都要有明确的操作指导
- Lightroom 步骤：包含数值参数，可使用 Exposure, Contrast, Highlights, Shadows, Whites, Blacks, Texture, Clarity, Dehaze, Vibrance, Saturation, Temperature, Tint, Sharpening, NoiseReductionLuminance, NoiseReductionColor, Grain, HueAdjustmentRed/Orange/Yellow/Green/Aqua/Blue/Purple/Magenta, SaturationAdjustment*, LuminanceAdjustment*, SplitToningHighlightHue/Saturation, SplitToningShadowHue/Saturation, SplitToningBalance
- Photoshop 步骤：描述具体操作（如减淡/加深、遮罩、清理），包含数值参数（Opacity, Flow, Feather, Radius, Amount）`;

/**
 * 内容要求指令 - 英文版本
 */
const CONTENT_REQUIREMENTS_EN = `Content Requirements:
- Ensure exactly 4 dimensions in order: Composition, Lighting, Color, Subject
- shootingTips: Provide 5-8 distinct shooting tips with concrete, actionable advice for each
- retouchPlan: Provide 6-10 retouching steps with actionable guidance for each step
- Lightroom steps: Include numeric values and may use Exposure, Contrast, Highlights, Shadows, Whites, Blacks, Texture, Clarity, Dehaze, Vibrance, Saturation, Temperature, Tint, Sharpening, NoiseReductionLuminance, NoiseReductionColor, Grain, HueAdjustmentRed/Orange/Yellow/Green/Aqua/Blue/Purple/Magenta, SaturationAdjustment*, LuminanceAdjustment*, SplitToningHighlightHue/Saturation, SplitToningShadowHue/Saturation, SplitToningBalance
- Photoshop steps: Describe concrete actions (e.g., dodge/burn, masking, cleanup) and include numeric values when applicable (Opacity, Flow, Feather, Radius, Amount)`;

/**
 * 输出格式定义 - 中文版本
 */
const OUTPUT_FORMAT_ZH = `JSON 输出格式（必须严格遵循）：
{
  "score": <0-100 的数字，表示总体评分>,
  "dimensions": [
    {
      "name": "Composition" | "Lighting" | "Color" | "Subject",
      "score": <0-100 的数字>,
      "reason": "<详细评分理由>"
    }
  ],
  "shootingTips": [
    "<具体的拍摄建议 1>",
    "<具体的拍摄建议 2>",
    ...
  ],
  "retouchPlan": [
    {
      "tool": "Lightroom" | "Photoshop",
      "step": "<步骤名称>",
      "action": "<操作描述>",
      "values": { "<参数名>": <数值> },
      "reason": "<调整理由>"
    }
  ]
}`;

/**
 * 输出格式定义 - 英文版本
 */
const OUTPUT_FORMAT_EN = `JSON output format (must strictly follow):
{
  "score": <number 0-100 for overall score>,
  "dimensions": [
    {
      "name": "Composition" | "Lighting" | "Color" | "Subject",
      "score": <number 0-100>,
      "reason": "<detailed scoring rationale>"
    }
  ],
  "shootingTips": [
    "<concrete shooting tip 1>",
    "<concrete shooting tip 2>",
    ...
  ],
  "retouchPlan": [
    {
      "tool": "Lightroom" | "Photoshop",
      "step": "<step name>",
      "action": "<operation description>",
      "values": { "<param_name>": <numeric_value> },
      "reason": "<adjustment rationale>"
    }
  ]
}`;

/**
 * 获取中文版本的所有提示词模板
 * @return {PromptTemplates} 包含所有中文提示词部分的 PromptTemplates 对象
 */
function getChinesePrompts(): PromptTemplates {
  return {
    system: SYSTEM_PROMPT_ZH,
    userBase: USER_BASE_ZH,
    languageInstruction: LANGUAGE_INSTRUCTION_ZH,
    contentRequirements: CONTENT_REQUIREMENTS_ZH,
    outputFormat: OUTPUT_FORMAT_ZH
  };
}

/**
 * 获取英文版本的所有提示词模板
 * @return {PromptTemplates} 包含所有英文提示词部分的 PromptTemplates 对象
 */
function getEnglishPrompts(): PromptTemplates {
  return {
    system: SYSTEM_PROMPT_EN,
    userBase: USER_BASE_EN,
    languageInstruction: LANGUAGE_INSTRUCTION_EN,
    contentRequirements: CONTENT_REQUIREMENTS_EN,
    outputFormat: OUTPUT_FORMAT_EN
  };
}

/**
 * 根据语言获取对应的提示词模板
 * @param {Language} language 语言代码：'zh' 或 'en'
 * @return {PromptTemplates} 对应语言的提示词模板集合
 */
export function getPromptsByLanguage(language: Language): PromptTemplates {
  return language === 'zh' ? getChinesePrompts() : getEnglishPrompts();
}

/**
 * 获取系统提示词 - 包含格式和语言要求
 * @param {Language} language 语言代码（'zh' 或 'en'）
 * @return {string} 完整的系统提示词字符串
 */
export function buildSystemPrompt(language: Language): string {
  const templates = getPromptsByLanguage(language);
  return [templates.system, '', templates.outputFormat, '', templates.languageInstruction].join(
    '\n'
  );
}

/**
 * Build user prompt with agent instructions, style tags, EXIF data and language requirements
 * @param {string} agentPrompt - Agent-specific prompt section
 * @param {string} styles - Style tags string (comma-separated)
 * @param {string} exif - Camera parameters string
 * @param {string} styleDescription - Style description text
 * @param {Language} language - Language code ('zh' or 'en')
 * @return {string} Complete user prompt string
 */
export function buildUserPrompt(
  agentPrompt: string,
  styles: string,
  exif: string,
  styleDescription: string,
  language: Language
): string {
  const templates = getPromptsByLanguage(language);

  const userBase = templates.userBase
    .replace('{styles}', styles || 'Unknown')
    .replace('{styleDescription}', styleDescription || 'None')
    .replace('{exif}', exif || 'None');

  return [
    userBase,
    '',
    agentPrompt,
    '',
    templates.languageInstruction,
    '',
    templates.contentRequirements
  ].join('\n');
}
