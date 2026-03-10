// ─── SHARED TYPES ─────────────────────────────────────────────────────────────
// Extracted from page.tsx so all components can import them instead of using `any`.

export interface CFSubmission {
  verdict: string;
  creationTimeSeconds: number;
  timeConsumedMillis: number;
  memoryConsumedBytes: number;
  author: { participantType: string };
  problem: {
    contestId: number;
    index: string;
    name: string;
    rating?: number;
    tags?: string[];
  };
}

export interface CFInfo {
  handle: string;
  rating?: number;
  maxRating?: number;
  rank?: string;
  titlePhoto: string;
  contribution?: number;
}

export interface CFRating {
  ratingUpdateTimeSeconds: number;
  oldRating: number;
  newRating: number;
}

export interface ProcessedMetrics {
  score: number;
  weeklyScore: number;
  monthlyScore: number;
  unique: number;
  acc: number;
  upsolveRate: number;
  verdictsDist: Record<string, number>;
  tagsDist: Record<string, number>;
  ratingsDist: Record<string, number>;
  weaknessRatios: Record<string, number>;
  timeToSolveDist: Record<string, number>;
  tagResourceStress: Record<string, { timeAvg: number; memAvg: number }>;
  rawSubsList: CFSubmission[];
}

export interface SquadMemberData {
  info: CFInfo;
  metrics: ProcessedMetrics;
  history: CFRating[];
}
