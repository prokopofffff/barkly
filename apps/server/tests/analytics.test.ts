import { describe, expect, test } from "bun:test";
import { weeklyHeights } from "@barkly/zero";
import {
  aggregateByVideo,
  computeVideoStats,
  materializeVideoAnalytics,
  type ProgressRow,
  type WatchEventRow,
} from "@/domain/analytics";

// Helper: build a progress row (only the fields the aggregation reads).
const row = (userID: string, videoID: string, completed: boolean): ProgressRow => ({
  userID,
  videoID,
  completed,
});

describe("computeVideoStats", () => {
  test("empty rows -> zeroed stats", () => {
    expect(computeVideoStats([])).toEqual({ views: 0, completionRate: 0 });
  });

  test("3 distinct viewers, 2 completed -> 67% (rounded)", () => {
    const rows = [
      row("u_max", "v1", true),
      row("u_sofia", "v1", true),
      row("u_timur", "v1", false),
    ];
    expect(computeVideoStats(rows)).toEqual({ views: 3, completionRate: 67 });
  });

  test("all viewers completed -> 100%", () => {
    const rows = [
      row("u_max", "v1", true),
      row("u_sofia", "v1", true),
    ];
    expect(computeVideoStats(rows)).toEqual({ views: 2, completionRate: 100 });
  });

  test("a duplicate userID counts once toward views", () => {
    const rows = [
      row("u_max", "v1", true),
      row("u_max", "v1", true), // same viewer again
      row("u_sofia", "v1", false),
    ];
    expect(computeVideoStats(rows).views).toBe(2);
  });
});

describe("aggregateByVideo", () => {
  test("empty input -> empty map", () => {
    expect(aggregateByVideo([]).size).toBe(0);
  });

  test("groups two videos correctly", () => {
    const rows = [
      row("u_max", "v1", true),
      row("u_sofia", "v1", true),
      row("u_timur", "v1", false),
      row("u_max", "v2", false),
      row("u_sofia", "v2", false),
    ];
    const byVideo = aggregateByVideo(rows);
    expect(byVideo.get("v1")).toEqual({ views: 3, completionRate: 67 });
    expect(byVideo.get("v2")).toEqual({ views: 2, completionRate: 0 });
  });
});

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

describe("weeklyHeights", () => {
  test("empty input -> all zeros aligned to dayKeys", () => {
    expect(weeklyHeights([], DAYS)).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  test("normalizes so the max day is 100 and others scale", () => {
    const rows = [
      { day: "mon", xp: 50 },
      { day: "wed", xp: 100 }, // the max -> 100
      { day: "fri", xp: 25 },
    ];
    const heights = weeklyHeights(rows, DAYS);
    expect(heights).toEqual([50, 0, 100, 0, 25, 0, 0]);
    expect(Math.max(...heights)).toBe(100);
  });

  test("all-zero XP stays all zeros (no divide by zero)", () => {
    const rows = [
      { day: "mon", xp: 0 },
      { day: "tue", xp: 0 },
    ];
    expect(weeklyHeights(rows, DAYS)).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
});

describe("materializeVideoAnalytics", () => {
  const ev = (
    userID: string,
    posPct: number,
    kind: WatchEventRow["kind"],
    videoID = "v1",
  ): WatchEventRow => ({ userID, videoID, posPct, kind });

  test("retention is non-increasing, starts at 100; engagement max is 1", () => {
    // 4 viewers reaching progressively less of the clip, plus interactions.
    const events: WatchEventRow[] = [
      ev("u1", 100, "reach"),
      ev("u2", 80, "reach"),
      ev("u3", 50, "reach"),
      ev("u4", 20, "reach"),
      ev("u1", 30, "replay"),
      ev("u1", 30, "answer"),
      ev("u2", 30, "replay"),
      ev("u3", 90, "answer"),
    ];
    const { retention, engagement } = materializeVideoAnalytics(events)!.get("v1")!;

    expect(retention).toHaveLength(10);
    expect(retention[0]).toBe(100); // everyone reached the first bucket
    for (let i = 1; i < retention.length; i++) {
      expect(retention[i]!).toBeLessThanOrEqual(retention[i - 1]!);
    }

    expect(engagement).toHaveLength(35);
    expect(Math.max(...engagement)).toBe(1);
    expect(Math.min(...engagement)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...engagement)).toBeLessThanOrEqual(1);
  });

  test("no viewers -> all-zero retention", () => {
    expect(materializeVideoAnalytics([]).size).toBe(0);
  });
});
