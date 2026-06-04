/**
 * Shared data-contract types for the Zero schema's JSON columns. These describe
 * the *data*, not UI — both the mobile app and the server depend on them, so
 * they live in the shared package (not in the app's constants/feed modules).
 */

/** Gradient identity stored on rows (creator/leaderboard accents). */
export type GradientName = 'brand' | 'reward' | 'fun' | 'streak';

/** One word/token in a live subtitle line. `key` words are tappable + saveable. */
export type SubtitleToken = {
  w: string;
  /** Translation; present on translatable tokens. */
  t?: string;
  /** Highlighted (tappable) vocabulary word. */
  key?: boolean;
};

type QuizBase = { prompt: string; xp: number; explain: string };

/** Multiple-choice ("mc") and meaning ("meaning") share the same shape. */
export type QuizChoice = QuizBase & {
  type: 'mc' | 'meaning';
  options: string[];
  answer: number;
};
export type QuizFill = QuizBase & {
  type: 'fill';
  sentence: string[];
  choices: string[];
  answer: number;
};
export type QuizReorder = QuizBase & {
  type: 'reorder';
  words: string[];
  answer: string[];
};
export type Quiz = QuizChoice | QuizFill | QuizReorder;
