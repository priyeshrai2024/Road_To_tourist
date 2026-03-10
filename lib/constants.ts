// ─── SHARED CONSTANTS ─────────────────────────────────────────────────────────
// Single source of truth for CF scoring and squad colors.
// Previously duplicated across page.tsx, GrindMode.tsx, Nemesis.tsx, SquadClash.tsx

export const CF_SCORE_MAP: Record<number, number> = {
  800: 15, 900: 20, 1000: 30, 1100: 45, 1200: 65, 1300: 90,
  1400: 130, 1500: 180, 1600: 250, 1700: 350, 1800: 500, 1900: 720,
  2000: 1050, 2100: 1530, 2200: 2250, 2300: 3300, 2400: 4800,
};

export const SQUAD_COLORS = ['#58a6ff', '#d2a8ff', '#56d364', '#f85149'];
