export const STYLE_TAGS = [
  'Documentary',
  'Street',
  'City',
  'Architecture',
  'Night',
  'Portrait',
  'Landscape',
  'Travel',
  'Nature',
  'Macro',
  'Abstract',
  'Fashion',
  'Food',
  'Sport',
  'Wedding',
  'Product'
] as const;

export type StyleTag = (typeof STYLE_TAGS)[number];

export interface StyleTagScore {
  name: StyleTag;
  weight: number;
  confidence: number;
}
