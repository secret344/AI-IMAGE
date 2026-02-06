import type { StyleTag } from '@/config/style-tags';

export interface AgentProfile {
  id: string;
  name: string;
  description: string;
  photographer: string;
  tagWeights: Partial<Record<StyleTag, number>>;
  prompt: string;
}

export const AGENTS: AgentProfile[] = [
  {
    id: 'street-narrative',
    name: 'Street Narrative',
    description: 'Decisive moments and narrative tension.',
    photographer: 'Henri Cartier-Bresson',
    tagWeights: { Documentary: 1.0, Street: 0.9, City: 0.7 },
    prompt: 'Prioritize decisive moments and narrative flow.'
  },
  {
    id: 'landscape-epic',
    name: 'Landscape Epic',
    description: 'Tonal range and depth layers.',
    photographer: 'Ansel Adams',
    tagWeights: { Landscape: 1.0, Travel: 0.8 },
    prompt: 'Emphasize tonal range, depth, and horizon balance.'
  },
  {
    id: 'urban-geometry',
    name: 'Urban Geometry',
    description: 'Light-shadow geometry and minimalism.',
    photographer: 'Fan Ho',
    tagWeights: { City: 1.0, Architecture: 0.9, Night: 0.7 },
    prompt: 'Focus on geometry, lines, and light-shadow contrast.'
  },
  {
    id: 'portrait-texture',
    name: 'Portrait Texture',
    description: 'Texture fidelity and natural light.',
    photographer: 'Peter Lindbergh',
    tagWeights: { Portrait: 1.0, Documentary: 0.6 },
    prompt: 'Emphasize texture, eye light, and authenticity.'
  },
  {
    id: 'film-color',
    name: 'Film Color',
    description: 'Soft tones and color richness.',
    photographer: 'Kodak Portra',
    tagWeights: { Street: 0.9, Travel: 0.8, Documentary: 0.7 },
    prompt: 'Focus on soft highlight rolloff and layered colors.'
  }
];
