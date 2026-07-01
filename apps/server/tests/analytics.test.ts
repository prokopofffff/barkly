import { describe, expect, test } from "bun:test";
import { aggregateByVideo, computeVideoStats, type ProgressRow } from "@/domain/analytics";

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
