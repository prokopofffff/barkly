import { describe, expect, test } from "bun:test";
import { computeDifficultyPrior, type DifficultyInput } from "@/ingest/difficulty";

const easy: DifficultyInput = {
  wpm: 110, // slow
  rareWordRatio: 0.03, // mostly common words
  avgSentenceLen: 6, // short sentences
  speechClarity: 10, // crystal clear
  englishLevel: "A1",
};

const hard: DifficultyInput = {
  wpm: 210, // fast
  rareWordRatio: 0.3, // lots of rare words
  avgSentenceLen: 24, // long sentences
  speechClarity: 2, // muddy
  englishLevel: "C2",
};

describe("computeDifficultyPrior", () => {
  test("stays within [0, 1000]", () => {
    expect(computeDifficultyPrior(easy)).toBeGreaterThanOrEqual(0);
    expect(computeDifficultyPrior(hard)).toBeLessThanOrEqual(1000);
  });

  test("easy clip scores low, hard clip scores high", () => {
    expect(computeDifficultyPrior(easy)).toBeLessThan(150);
    expect(computeDifficultyPrior(hard)).toBeGreaterThan(850);
  });

  test("faster speech raises difficulty", () => {
    const slow = computeDifficultyPrior({ ...easy, wpm: 110 });
    const fast = computeDifficultyPrior({ ...easy, wpm: 220 });
    expect(fast).toBeGreaterThan(slow);
  });

  test("clearer speech lowers difficulty", () => {
    const muddy = computeDifficultyPrior({ ...hard, speechClarity: 1 });
    const clear = computeDifficultyPrior({ ...hard, speechClarity: 10 });
    expect(clear).toBeLessThan(muddy);
  });

  test("higher CEFR level raises difficulty", () => {
    const a2 = computeDifficultyPrior({ ...easy, englishLevel: "A2" });
    const c1 = computeDifficultyPrior({ ...easy, englishLevel: "C1" });
    expect(c1).toBeGreaterThan(a2);
  });

  test("unknown level falls back to mid difficulty", () => {
    const unknown = computeDifficultyPrior({ ...easy, englishLevel: "" });
    const a1 = computeDifficultyPrior({ ...easy, englishLevel: "A1" });
    expect(unknown).toBeGreaterThan(a1); // mid (0.5) > A1 (0.0)
  });

  test("clamps out-of-range inputs", () => {
    const beyond = computeDifficultyPrior({
      wpm: 999,
      rareWordRatio: 5,
      avgSentenceLen: 999,
      speechClarity: 0,
      englishLevel: "C2",
    });
    expect(beyond).toBe(1000);
  });
});
