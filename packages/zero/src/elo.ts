import type { Quiz } from "./types";

// Adaptive difficulty via a per-user ELO (bk-z5t.18). Users and videos share one
// 0-1000+ scale: video.difficulty is the ingestion prior; user.elo starts from
// the onboarding self-assessment and moves with quiz performance. Pure +
// side-effect-free so it unit-tests without a DB; the mutators apply it.

// Logistic scale: smaller S than chess's 400 because our range is compressed
// (~0-1000, not ~0-2800). A 50-point gap -> expected ≈ 0.43.
export const ELO_SCALE = 200;

export const ELO_MIN = 0;
export const ELO_MAX = 1200;

// K-factor per quiz type: harder task types move ELO more.
export const K_BY_TYPE: Record<Quiz["type"], number> = {
  mc: 16,
  meaning: 16,
  fill: 24,
  reorder: 32,
};

// Provisional rating: the first few answers swing harder so a noisy onboarding
// seed converges fast (chess-style provisional ratings).
export const PROVISIONAL_GAMES = 5;
export const PROVISIONAL_MULT = 2;

// Re-attempt (rewatch + retry) costs a small fixed amount and never grants ELO
// (anti-farm). Capped so honest review isn't punished into the ground.
export const REWATCH_PENALTY = 8;

// Onboarding self-assessment label -> starting ELO. No CEFR shown to users.
export const ELO_SEED: Record<string, number> = {
  only_starting: 150,
  knows_basics: 350,
  intermediate: 500,
  confident: 700,
  fluent: 900,
};
export const DEFAULT_ELO = 500;

const clampElo = (x: number) => Math.max(ELO_MIN, Math.min(ELO_MAX, Math.round(x)));

/** Starting ELO from the onboarding answer (unknown label -> neutral). */
export function seedElo(label: string): number {
  return ELO_SEED[label] ?? DEFAULT_ELO;
}

/** Expected score (win probability) for a user of `elo` facing `difficulty`. */
export function expectedScore(elo: number, difficulty: number): number {
  return 1 / (1 + 10 ** ((difficulty - elo) / ELO_SCALE));
}

export type EloState = { elo: number; games: number };

/** Apply one graded answer (first attempt). Returns the new ELO + game count. */
export function applyEloResult(
  state: EloState,
  difficulty: number,
  quizType: Quiz["type"],
  correct: boolean,
): EloState {
  const k =
    K_BY_TYPE[quizType] *
    (state.games < PROVISIONAL_GAMES ? PROVISIONAL_MULT : 1);
  const delta = k * ((correct ? 1 : 0) - expectedScore(state.elo, difficulty));
  return { elo: clampElo(state.elo + delta), games: state.games + 1 };
}

/** Apply a rewatch/re-attempt penalty (no game counted, no positive credit). */
export function applyRewatchPenalty(state: EloState): EloState {
  return { elo: clampElo(state.elo - REWATCH_PENALTY), games: state.games };
}
