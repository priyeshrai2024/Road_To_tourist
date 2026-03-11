// ─── LOCALSTORAGE KEY REGISTRY ────────────────────────────────────────────────
// Single source of truth for all localStorage keys used across the app.
// If you ever need to bust a cache, bump the version suffix here — one change,
// all consumers update automatically.

export const STORAGE_KEYS = {
  /** Main user + squad config (handles) */
  CONFIG:           'cf_config_v6',

  /** Cached squad telemetry payload (info + rawSubs + history per handle) */
  SQUAD_CACHE:      'cf_squad_cache_v2',

  /** Grind session history logs */
  GRIND_SESSIONS:   'cf_grind_v4',

  /** Grind task list */
  GRIND_TASKS:      'cf_grind_tasks_v4',

  /** Tomorrow's priority plan (GrindMode) */
  GRIND_TMR_PLAN:   'cf_grind_tmr',

  /** Weekly grind target hours */
  GRIND_TARGET_HRS: 'cf_grind_target',

  /** Contest archive cache (ContestTracker) */
  CONTEST_ARCHIVE:  'cf_contest_archive_v2',
} as const;
