// ─── THEME DEFINITIONS ────────────────────────────────────────────────────────
// Each theme maps to CSS custom properties injected on :root
// c[0] = bg-base      (page background)
// c[1] = bg-card      (card / surface background)
// c[2] = border       (border color)
// c[3] = text-main    (primary text)
// c[4] = accent-main  (primary accent — buttons, highlights, active states)
// c[5] = status-ac    (accepted / success green)
// c[6] = status-wa    (wrong / error red)

export interface AppTheme {
  id: string;
  name: string;
  emoji: string;
  c: [string, string, string, string, string, string, string];
}

export const THEMES: AppTheme[] = [
  {
    id: 'supabase',
    name: 'Supabase Midnight',
    emoji: '🟢',
    c: ['#131313', '#1e1e1e', '#2e2e2e', '#ededed', '#3ecf8e', '#3ecf8e', '#f87171'],
  },
  {
    id: 'obsidian',
    name: 'Obsidian Bronze',
    emoji: '🥉',
    c: ['#111111', '#1a1a1a', '#2d2d2d', '#e0e0e0', '#C6A87C', '#6B9E78', '#CD5C5C'],
  },
  {
    id: 'minimal',
    name: 'Modern Minimal',
    emoji: '⬜',
    c: ['#0a0a0a', '#141414', '#252525', '#F5F5F5', '#ffffff', '#4ade80', '#f87171'],
  },
  {
    id: 'sunset',
    name: 'Sunset',
    emoji: '🌅',
    c: ['#1a1118', '#231520', '#3a2535', '#f5e6ff', '#f97316', '#a78bfa', '#f43f5e'],
  },
  {
    id: 'amber',
    name: 'Amber Dusk',
    emoji: '🌙',
    c: ['#181410', '#221c17', '#3a2f26', '#f5ead8', '#fbbf24', '#fb923c', '#f87171'],
  },
];

export const DEFAULT_THEME_ID = 'supabase';

export function getTheme(id: string): AppTheme {
  return THEMES.find(t => t.id === id) ?? THEMES[0];
}

export function applyTheme(theme: AppTheme) {
  const root = document.documentElement;
  root.style.setProperty('--bg-base',     theme.c[0]);
  root.style.setProperty('--bg-card',     theme.c[1]);
  root.style.setProperty('--border',      theme.c[2]);
  root.style.setProperty('--text-main',   theme.c[3]);
  root.style.setProperty('--accent',      theme.c[4]);
  root.style.setProperty('--status-ac',   theme.c[5]);
  root.style.setProperty('--status-wa',   theme.c[6]);

  // Auto-derived values
  const r = parseInt(theme.c[4].slice(1, 3), 16);
  const g = parseInt(theme.c[4].slice(3, 5), 16);
  const b = parseInt(theme.c[4].slice(5, 7), 16);
  root.style.setProperty('--accent-10',  `rgba(${r},${g},${b},0.10)`);
  root.style.setProperty('--accent-15',  `rgba(${r},${g},${b},0.15)`);
  root.style.setProperty('--accent-20',  `rgba(${r},${g},${b},0.20)`);

  // Muted text — always 55% opacity of main text color
  root.style.setProperty('--text-muted', theme.c[3] + '80');
  root.style.setProperty('--text-dim',   theme.c[3] + '40');
}
