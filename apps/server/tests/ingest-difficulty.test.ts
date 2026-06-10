import { describe, expect, test } from "bun:test";
import { computeDifficultyPrior, type DifficultyInput } from "@/ingest/difficulty";

const easy: DifficultyInput = {
  wpm: 110, // slow
  rareWordRatio: 0.03, // mostly common words
  avgSentenceLen: 6, // short sentences
  speechClarity: 10, // crystal clear
  idiomDensity: 1,
  slangDensity: 1,
  syntaxComplexity: 1,
  abstractness: 1,
};

const hard: DifficultyInput = {
  wpm: 210, // fast
  rareWordRatio: 0.3, // lots of rare words
  avgSentenceLen: 24, // long sentences
  speechClarity: 2, // muddy
  idiomDensity: 5,
  slangDensity: 5,
  syntaxComplexity: 5,
  abstractness: 5,
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
    expect(computeDifficultyPrior({ ...easy, wpm: 220 })).toBeGreaterThan(
      computeDifficultyPrior({ ...easy, wpm: 110 }),
    );
  });

  test("clearer speech lowers difficulty", () => {
    expect(computeDifficultyPrior({ ...hard, speechClarity: 10 })).toBeLessThan(
      computeDifficultyPrior({ ...hard, speechClarity: 1 }),
    );
  });

  test("each rubric rating monotonically raises difficulty", () => {
    for (const k of [
      "idiomDensity",
      "slangDensity",
      "syntaxComplexity",
      "abstractness",
    ] as const) {
      expect(computeDifficultyPrior({ ...easy, [k]: 5 })).toBeGreaterThan(
        computeDifficultyPrior(easy),
      );
    }
  });

  test("clamps out-of-range inputs", () => {
    expect(
      computeDifficultyPrior({
        wpm: 999,
        rareWordRatio: 5,
        avgSentenceLen: 999,
        speechClarity: 0,
        idiomDensity: 5,
        slangDensity: 5,
        syntaxComplexity: 5,
        abstractness: 5,
      }),
    ).toBe(1000);
  });
});
