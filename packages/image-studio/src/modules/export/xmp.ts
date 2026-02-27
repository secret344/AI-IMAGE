import type { RetouchStep } from '@/types/evaluation';

export function buildXmp(retouchPlan: RetouchStep[]): string {
  const mappedValues = collectMappedValues(retouchPlan);
  const mergedValues: Record<string, number> = {
    Exposure: 0,
    Contrast: 0,
    Highlights: 0,
    Shadows: 0,
    ...mappedValues
  };
  const xmpAttributes = Object.entries(mergedValues)
    .map(([key, value]) => ({ xmpKey: XMP_KEY_MAP[key], value }))
    .filter((entry): entry is { xmpKey: string; value: number } =>
      Boolean(entry.xmpKey && Number.isFinite(entry.value))
    )
    .map((entry) => `      crs:${entry.xmpKey}="${entry.value}"`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:crs="http://ns.adobe.com/camera-raw-settings/1.0/"
${xmpAttributes} />
  </rdf:RDF>
</x:xmpmeta>`;
}

const XMP_KEY_MAP: Record<string, string> = {
  Exposure: 'Exposure2012',
  Contrast: 'Contrast2012',
  Highlights: 'Highlights2012',
  Shadows: 'Shadows2012',
  Whites: 'Whites2012',
  Blacks: 'Blacks2012',
  Texture: 'Texture',
  Clarity: 'Clarity2012',
  Dehaze: 'Dehaze',
  Vibrance: 'Vibrance',
  Saturation: 'Saturation',
  Temperature: 'Temperature',
  Tint: 'Tint',
  Sharpening: 'Sharpness',
  NoiseReductionLuminance: 'LuminanceSmoothing',
  NoiseReductionColor: 'ColorNoiseReduction',
  Grain: 'GrainAmount',
  HueAdjustmentRed: 'HueAdjustmentRed',
  HueAdjustmentOrange: 'HueAdjustmentOrange',
  HueAdjustmentYellow: 'HueAdjustmentYellow',
  HueAdjustmentGreen: 'HueAdjustmentGreen',
  HueAdjustmentAqua: 'HueAdjustmentAqua',
  HueAdjustmentBlue: 'HueAdjustmentBlue',
  HueAdjustmentPurple: 'HueAdjustmentPurple',
  HueAdjustmentMagenta: 'HueAdjustmentMagenta',
  SaturationAdjustmentRed: 'SaturationAdjustmentRed',
  SaturationAdjustmentOrange: 'SaturationAdjustmentOrange',
  SaturationAdjustmentYellow: 'SaturationAdjustmentYellow',
  SaturationAdjustmentGreen: 'SaturationAdjustmentGreen',
  SaturationAdjustmentAqua: 'SaturationAdjustmentAqua',
  SaturationAdjustmentBlue: 'SaturationAdjustmentBlue',
  SaturationAdjustmentPurple: 'SaturationAdjustmentPurple',
  SaturationAdjustmentMagenta: 'SaturationAdjustmentMagenta',
  LuminanceAdjustmentRed: 'LuminanceAdjustmentRed',
  LuminanceAdjustmentOrange: 'LuminanceAdjustmentOrange',
  LuminanceAdjustmentYellow: 'LuminanceAdjustmentYellow',
  LuminanceAdjustmentGreen: 'LuminanceAdjustmentGreen',
  LuminanceAdjustmentAqua: 'LuminanceAdjustmentAqua',
  LuminanceAdjustmentBlue: 'LuminanceAdjustmentBlue',
  LuminanceAdjustmentPurple: 'LuminanceAdjustmentPurple',
  LuminanceAdjustmentMagenta: 'LuminanceAdjustmentMagenta',
  SplitToningHighlightHue: 'SplitToningHighlightHue',
  SplitToningHighlightSaturation: 'SplitToningHighlightSaturation',
  SplitToningShadowHue: 'SplitToningShadowHue',
  SplitToningShadowSaturation: 'SplitToningShadowSaturation',
  SplitToningBalance: 'SplitToningBalance'
};

function collectMappedValues(plan: RetouchStep[]): Record<string, number> {
  const values: Record<string, number> = {};
  for (const step of plan) {
    if (step.tool !== 'Lightroom' || !step.values) {
      continue;
    }
    for (const [key, value] of Object.entries(step.values)) {
      if (!XMP_KEY_MAP[key]) {
        continue;
      }
      if (typeof value === 'number' && Number.isFinite(value) && values[key] === undefined) {
        values[key] = value;
      }
    }
  }
  return values;
}
