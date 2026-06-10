import { describe, expect, test } from "bun:test";
import {
  applyEloResult,
  applyRewatchPenalty,
  DEFAULT_ELO,
  ELO_MAX,
  ELO_MIN,
  expectedScore,
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
