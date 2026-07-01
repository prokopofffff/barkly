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

// --- watch analytics: retention + engagement curves --------------------------

// One recorded watch event. `posPct` is 0-100 position within the clip; `kind`
// distinguishes how far a viewer reached ("reach") from active interactions
// ("replay" scrub-backs / "answer" quiz answers) that feed the engagement heat.
export type WatchEventRow = {
  userID: string;
  videoID: string;
  posPct: number;
  kind: "reach" | "replay" | "answer";
};

/**
 * Materialize per-video retention + engagement curves from raw watch events.
 * Events are grouped by videoID, then for each video:
 *  - retention[b] (length `buckets`) = round(100 * distinctViewers whose MAX
 *    posPct >= threshold(b) / distinctViewers), threshold(b) = ((b+1)/buckets)*100.
 *    A viewer is anyone who produced any event. No viewers -> all zeros. The
 *    curve is monotonically non-increasing and starts at 100.
 *  - engagement (length `cells`) = count of replay/answer events binned by
 *    posPct into `cells` bins, then divided by the max bin count so the hottest
 *    cell is 1 (all zeros if there are no such events). Deterministic.
 */
export function materializeVideoAnalytics(
  events: readonly WatchEventRow[],
  buckets = 10,
  cells = 35,
): Map<string, { retention: number[]; engagement: number[] }> {
  const byVideo = new Map<string, WatchEventRow[]>();
  for (const e of events) {
    const group = byVideo.get(e.videoID);
    if (group) group.push(e);
    else byVideo.set(e.videoID, [e]);
  }

  const out = new Map<string, { retention: number[]; engagement: number[] }>();
  for (const [videoID, group] of byVideo) {
    // Retention: each viewer's furthest-reached position.
    const maxPos = new Map<string, number>();
    for (const e of group) {
      const prev = maxPos.get(e.userID) ?? 0;
      if (e.posPct > prev) maxPos.set(e.userID, e.posPct);
    }
    const viewers = maxPos.size;
    const retention: number[] = [];
    for (let b = 0; b < buckets; b++) {
      if (viewers === 0) {
        retention.push(0);
        continue;
      }
      const threshold = ((b + 1) / buckets) * 100;
      let reached = 0;
      for (const p of maxPos.values()) if (p >= threshold) reached += 1;
      retention.push(Math.round((100 * reached) / viewers));
    }

    // Engagement: replay/answer events binned by position, normalized to [0,1].
    const bins = new Array<number>(cells).fill(0);
    for (const e of group) {
      if (e.kind !== "replay" && e.kind !== "answer") continue;
      let idx = Math.floor((e.posPct / 100) * cells);
      if (idx < 0) idx = 0;
      if (idx >= cells) idx = cells - 1;
      bins[idx] = (bins[idx] as number) + 1;
    }
    const max = bins.reduce((m, x) => (x > m ? x : m), 0);
    const engagement = bins.map((x) => (max > 0 ? x / max : 0));

    out.set(videoID, { retention, engagement });
  }
  return out;
}
