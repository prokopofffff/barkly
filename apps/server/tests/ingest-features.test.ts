import { describe, expect, test } from "bun:test";
import { computeFeatures, tokenize } from "@/ingest/features";

describe("tokenize", () => {
  test("lowercases and keeps intra-word apostrophes", () => {
    expect(tokenize("Don't STOP, it's fun!")).toEqual(["don't", "stop", "it's", "fun"]);
  });
  test("drops digits and punctuation", () => {
    expect(tokenize("3 cats... and 2 dogs")).toEqual(["cats", "and", "dogs"]);
  });
});

describe("computeFeatures", () => {
  test("counts words, unique, ttr", () => {
    const f = computeFeatures("the cat sat the cat", null);
    expect(f.wordCount).toBe(5);
    expect(f.uniqueWords).toBe(3); // the, cat, sat
    expect(f.ttr).toBeCloseTo(3 / 5);
  });

  test("wpm from duration; 0 when duration missing", () => {
    // 6 words over 30s -> 12 wpm
    const f = computeFeatures("one two three four five six", 30);
    expect(f.wpm).toBeCloseTo(12);
    expect(computeFeatures("one two three", null).wpm).toBe(0);
  });

  test("rare words = tokens outside the top-5000 list", () => {
    // common words vs an invented rare token
    const f = computeFeatures("the and of zqxwv", null);
    expect(f.freqDistribution.beyond).toBe(1); // zqxwv
    expect(f.rareWordRatio).toBeCloseTo(1 / 4);
    expect(f.freqDistribution.top1000).toBe(3); // the, and, of
  });

  test("avgSentenceLen splits on sentence punctuation", () => {
    const f = computeFeatures("I cook. You eat now.", null);
    // 5 words across 2 sentences
    expect(f.wordCount).toBe(5);
    expect(f.avgSentenceLen).toBeCloseTo(2.5);
  });

  test("no punctuation -> single run", () => {
    const f = computeFeatures("one two three four", null);
    expect(f.avgSentenceLen).toBe(4);
  });
});
