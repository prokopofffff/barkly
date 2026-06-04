import type { Quiz } from "@barkly/zero";

// Authoritative economy rules (BACKEND_PLAN §5). Pure + side-effect-free so they
// can be unit-tested without a database; the server mutators apply them against
// real rows. Never trust client-supplied totals — derive everything here.

/** Hard cap on XP a single action can grant (anti-cheat clamp). */
export const MAX_XP_PER_ACTION = 100;
/** Per-day XP ceiling (resets via the streak-rollover cron). */
export const DAILY_XP_CAP = 5000;

/** Re-grade a quiz answer against the stored correct answer. */
export function gradeQuiz(quiz: Quiz, selected: number | readonly string[]): boolean {
  if (quiz.type === "reorder") {
    return (
      Array.isArray(selected) &&
      selected.length === quiz.answer.length &&
      selected.every((w, i) => w === quiz.answer[i])
    );
  }
  // mc | meaning | fill → the answer is an index into the options/choices.
  return selected === quiz.answer;
}

/**
 * New gamification totals after earning `amount` XP, recomputed from the user's
 * current state: clamp per action, respect the daily cap, derive gems = ⌊xp/2⌋.
 */
export function applyEarn(
  current: { xp: number; xpToday: number },
  amount: number,
): { xp: number; xpToday: number; gems: number } {
  const remainingToday = Math.max(0, DAILY_XP_CAP - current.xpToday);
  const granted = Math.max(0, Math.min(amount, MAX_XP_PER_ACTION, remainingToday));
  const xp = current.xp + granted;
  return { xp, xpToday: current.xpToday + granted, gems: Math.floor(xp / 2) };
}
