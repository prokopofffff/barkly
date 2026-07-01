// Denormalized creator stats aggregated from the progress table (bk-cj6.24).
// Each video carries `views` (distinct viewers) and `completionRate` (0-100 % of
// those viewers who finished the clip). Pure + side-effect-free so it unit-tests
// without a DB; the seed and (eventually) the mutators recompute + persist these.

// Minimal shape we read off a progress row — only the fields the aggregation
// touches, so callers can pass richer rows freely.
export type ProgressRow = {
  userID: string;
  videoID: string;
  completed: boolean;
};

export type VideoStats = {
  views: number;
  completionRate: number; // 0-100
};

/**
 * Aggregate the progress rows of ONE video into denormalized stats.
 * `views` = number of DISTINCT userID; `completionRate` = round(100 * completed
 * / views). There is exactly one progress row per (user, video), so the count of
 * `completed === true` rows is at most `views` and the rate never exceeds 100.
 * Empty input (views === 0) returns { views: 0, completionRate: 0 }.
 */
export function computeVideoStats(rows: readonly ProgressRow[]): VideoStats {
  const viewers = new Set<string>();
  let completed = 0;
  for (const r of rows) {
    viewers.add(r.userID);
    if (r.completed) completed += 1;
  }
  const views = viewers.size;
  if (views === 0) return { views: 0, completionRate: 0 };
  return { views, completionRate: Math.round((100 * completed) / views) };
}

/**
 * Aggregate progress rows spanning MANY videos into per-video stats. Groups the
 * rows by videoID then runs {@link computeVideoStats} per group. Returns a Map
 * keyed by videoID; an empty input yields an empty Map.
 */
export function aggregateByVideo(
  rows: readonly ProgressRow[],
): Map<string, VideoStats> {
  const byVideo = new Map<string, ProgressRow[]>();
  for (const r of rows) {
    const group = byVideo.get(r.videoID);
    if (group) group.push(r);
    else byVideo.set(r.videoID, [r]);
  }
  const out = new Map<string, VideoStats>();
  for (const [videoID, group] of byVideo) {
    out.set(videoID, computeVideoStats(group));
  }
  return out;
}
