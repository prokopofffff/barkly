import { describe, expect, test } from "bun:test";
import {
  formatCount,
  pickBgGradient,
  pickGradient,
  topicLabels,
} from "@/ingest/promote";

describe("topicLabels", () => {
  test("maps a known topic to RU + EN labels", () => {
    expect(topicLabels("food")).toEqual({ ru: "Еда", en: "FOOD" });
  });
  test("falls back to 'other' for an unknown topic", () => {
    expect(topicLabels("nope")).toEqual({ ru: "Разное", en: "MISC" });
  });
});

describe("formatCount", () => {
  test("formats thousands and millions", () => {
    expect(formatCount(950)).toBe("950");
    expect(formatCount(1234)).toBe("1.2K");
    expect(formatCount(2_500_000)).toBe("2.5M");
  });
});

describe("pickGradient / pickBgGradient", () => {
  test("deterministic for the same seed", () => {
    expect(pickGradient("abc")).toBe(pickGradient("abc"));
    expect(pickBgGradient("abc")).toEqual(pickBgGradient("abc"));
  });
  test("gradient is a valid GradientName", () => {
    expect(["brand", "reward", "fun", "streak"]).toContain(pickGradient("xyz123"));
  });
  test("bg gradient is a [top, bottom] hex pair", () => {
    const g = pickBgGradient("xyz123");
    expect(g).toHaveLength(2);
    expect(g[0]).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
