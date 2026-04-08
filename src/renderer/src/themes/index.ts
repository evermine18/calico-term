export type ThemeId =
  | 'cyber-teal'
  | 'neon-purple'
  | 'amber-glow'
  | 'emerald'
  | 'rose'
  | 'frost-blue';

export interface Theme {
  id: ThemeId;
  name: string;
  description: string;
  colors: {
    100: string;
    300: string;
    400: string;
    500: string;
    600: string;
    rgb: string;    // "r, g, b" — for rgba() usage
    oklch: string;  // full oklch(...) value — for shadcn --primary / --ring
  };
}

export const themes: Theme[] = [
  {
    id: 'cyber-teal',
    name: 'Cyber Teal',
    description: 'Classic hacker terminal',
    colors: {
      100: '#cffafe',
      300: '#67e8f9',
      400: '#22d3ee',
      500: '#06b6d4',
      600: '#0891b2',
      rgb: '6, 182, 212',
      oklch: 'oklch(0.70 0.15 200)',
    },
  },
  {
    id: 'neon-purple',
    name: 'Neon Purple',
    description: 'Synthwave vibes',
    colors: {
      100: '#ede9fe',
      300: '#c4b5fd',
      400: '#a78bfa',
      500: '#8b5cf6',
      600: '#7c3aed',
      rgb: '139, 92, 246',
      oklch: 'oklch(0.65 0.25 280)',
    },
  },
  {
    id: 'amber-glow',
    name: 'Amber Glow',
    description: 'Warm retro terminal',
    colors: {
      100: '#fef3c7',
      300: '#fcd34d',
      400: '#fbbf24',
      500: '#f59e0b',
      600: '#d97706',
      rgb: '245, 158, 11',
      oklch: 'oklch(0.78 0.18 80)',
    },
  },
  {
    id: 'emerald',
    name: 'Emerald',
    description: 'Matrix-inspired green',
    colors: {
      100: '#d1fae5',
      300: '#6ee7b7',
      400: '#34d399',
      500: '#10b981',
      600: '#059669',
      rgb: '16, 185, 129',
      oklch: 'oklch(0.70 0.17 162)',
    },
  },
  {
    id: 'rose',
    name: 'Rose',
    description: 'Bold and vivid pink',
    colors: {
      100: '#ffe4e6',
      300: '#fda4af',
      400: '#fb7185',
      500: '#f43f5e',
      600: '#e11d48',
      rgb: '244, 63, 94',
      oklch: 'oklch(0.65 0.25 15)',
    },
  },
  {
    id: 'frost-blue',
    name: 'Frost Blue',
    description: 'Cool and crisp blue',
    colors: {
      100: '#dbeafe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',
      600: '#2563eb',
      rgb: '59, 130, 246',
      oklch: 'oklch(0.68 0.18 240)',
    },
  },
];

export const DEFAULT_THEME_ID: ThemeId = 'cyber-teal';

export function getTheme(id: ThemeId): Theme {
  return themes.find((t) => t.id === id) ?? themes[0];
}
