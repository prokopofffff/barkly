import { describe, expect, test } from "bun:test";
import {
  applyEloResult,
  applyRewatchPenalty,
  DEFAULT_ELO,
  ELO_MAX,
  ELO_MIN,
  expectedScore,
  FEED_SIZE,
  matchmake,
  MIN_IN_WINDOW,
  PROVISIONAL_GAMES,
  REWATCH_PENALTY,
  seedElo,
} from "@barkly/zero";

describe("seedElo", () => {
  test("maps onboarding labels to starting ELO", () => {
    expect(seedElo("only_starting")).toBe(150);
    expect(seedElo("fluent")).toBe(900);
  });
  test("unknown label -> neutral default", () => {
    expect(seedElo("???")).toBe(DEFAULT_ELO);
  });
});

describe("expectedScore", () => {
  test("equal rating -> 0.5", () => {
    expect(expectedScore(500, 500)).toBeCloseTo(0.5);
  });
  test("higher difficulty -> lower expected", () => {
    expect(expectedScore(500, 700)).toBeLessThan(0.5);
    expect(expectedScore(700, 500)).toBeGreaterThan(0.5);
  });
});

describe("applyEloResult", () => {
  const post = { elo: 500, games: 10 }; // past provisional

  test("correct raises, wrong lowers, around a matched video", () => {
    const up = applyEloResult(post, 500, "fill", true);
    const down = applyEloResult(post, 500, "fill", false);
    expect(up.elo).toBeGreaterThan(500);
    expect(down.elo).toBeLessThan(500);
    expect(up.games).toBe(11);
  });

  test("harder quiz type moves ELO more", () => {
    const mc = applyEloResult(post, 500, "mc", true).elo - 500;
    const reorder = applyEloResult(post, 500, "reorder", true).elo - 500;
    expect(reorder).toBeGreaterThan(mc);
  });

  test("correct on a harder-than-user video gains more than on an easier one", () => {
    const hard = applyEloResult(post, 700, "fill", true).elo - 500;
    const easy = applyEloResult(post, 300, "fill", true).elo - 500;
    expect(hard).toBeGreaterThan(easy);
  });

  test("provisional games swing harder", () => {
    const prov = applyEloResult({ elo: 500, games: 0 }, 700, "fill", true).elo - 500;
    const settled = applyEloResult({ elo: 500, games: PROVISIONAL_GAMES }, 700, "fill", true).elo - 500;
    expect(prov).toBeGreaterThan(settled);
  });

  test("clamps to [ELO_MIN, ELO_MAX]", () => {
    expect(applyEloResult({ elo: ELO_MAX, games: 99 }, 0, "reorder", true).elo).toBeLessThanOrEqual(ELO_MAX);
    expect(applyEloResult({ elo: ELO_MIN, games: 99 }, 1200, "reorder", false).elo).toBeGreaterThanOrEqual(ELO_MIN);
  });
});

describe("matchmake", () => {
  // Build n videos at a fixed difficulty (helper to stock the candidate pool).
  const at = (difficulty: number, n: number) =>
    Array.from({ length: n }, (_, i) => ({ id: `${difficulty}-${i}`, difficulty }));

  test("settled: returns clips nearest the user's ELO, sorted by distance", () => {
    const rows = [...at(500, 20), ...at(520, 20), ...at(900, 20)];
    const out = matchmake(rows, 500, 50);
    // 500s are dead-on, then 520s; the far 900s never make the ±50 window.
    expect(out.every((v) => Math.abs(v.difficulty - 500) <= 50)).toBe(true);
    expect(out[0]?.difficulty).toBe(500);
  });

  test("widens the window when too few clips qualify nearby", () => {
    // Only 5 within ±50 (< MIN_IN_WINDOW) but plenty within ±100 → window widens.
    const rows = [...at(500, 5), ...at(580, 20)];
    const out = matchmake(rows, 500, 50);
    expect(out.length).toBeGreaterThanOrEqual(MIN_IN_WINDOW);
    expect(out.some((v) => v.difficulty === 580)).toBe(true);
  });

  test("provisional ratings match on a wider window than settled", () => {
    // 10 clips 200 away: outside the settled ±100/±200? 200 is within settled
    // 200 window but provisional's first window (250) is wider still. Use 240:
    const rows = [...at(500, 3), ...at(740, 12)];
    // Provisional (games < PROVISIONAL_GAMES): 740 is within ±250 → included.
    const prov = matchmake(rows, 500, 0);
    expect(prov.some((v) => v.difficulty === 740)).toBe(true);
    // Settled: ±50/100/200 all exclude 740 (only 3 nearby) → falls back to ∞,
    // so 740s appear only after the nearer 500s (distance sort).
    const settled = matchmake(rows, 500, PROVISIONAL_GAMES);
    expect(settled[0]?.difficulty).toBe(500);
  });

  test("falls back to all rows (Infinity) rather than returning empty", () => {
    const rows = at(50, 3); // far from elo, fewer than MIN_IN_WINDOW
    const out = matchmake(rows, 900, 50);
    expect(out.length).toBe(3); // no window matched → Infinity returns everything
  });

  test("caps the result at FEED_SIZE", () => {
    const out = matchmake(at(500, FEED_SIZE + 30), 500, 50);
    expect(out.length).toBe(FEED_SIZE);
  });

  test("treats a null difficulty as 0", () => {
    const out = matchmake([{ id: "x", difficulty: null }], 0, 50);
    expect(out).toHaveLength(1);
  });
});

describe("applyRewatchPenalty", () => {
  test("subtracts a fixed amount, no game counted", () => {
    expect(applyRewatchPenalty({ elo: 500, games: 3 })).toEqual({
      elo: 500 - REWATCH_PENALTY,
      games: 3,
    });
  });
  test("never goes below ELO_MIN", () => {
    expect(applyRewatchPenalty({ elo: 2, games: 1 }).elo).toBe(ELO_MIN);
  });
});
