// Shared analytics helpers used by both the mobile app (rendering the weekly XP
// chart) and the server (aggregating watch analytics). Pure + side-effect-free —
// no DB, no schema imports — so they unit-test in isolation and render the same
// bars optimistically on the client as the server would compute.

/**
 * Normalize per-day XP into bar heights (0-100) aligned to `dayKeys`.
 * For each key in order we look up that day's XP (0 if the day is absent from
 * `rows`), then scale against the largest XP across the requested days:
 * `height = max > 0 ? round((xp / max) * 100) : 0`. The tallest day is 100 and
 * the rest scale proportionally. Empty input (or all-zero XP) yields all zeros.
 * Returns an array the same length as `dayKeys` (e.g. 7 for the weekly chart).
 */
export function weeklyHeights(
  rows: readonly { day: string; xp: number }[],
  dayKeys: readonly string[],
): number[] {
  const byDay = new Map<string, number>();
  for (const r of rows) byDay.set(r.day, r.xp);
  const xps = dayKeys.map((k) => byDay.get(k) ?? 0);
  const max = xps.reduce((m, x) => (x > m ? x : m), 0);
  if (max <= 0) return xps.map(() => 0);
  return xps.map((x) => Math.round((x / max) * 100));
}
