import { describe, expect, test } from "bun:test";
import {
  buildUserContent,
  classificationSchema,
  CLASSIFICATION_JSON_SCHEMA,
  PROFANITY_THRESHOLD,
  rejectReason,
  type Classification,
} from "@/ingest/classify";

const safe: Classification = {
  safe: true,
  topic: "food",
  contains_politics: false,
  contains_war: false,
  contains_sexual: false,
  contains_hate: false,
  contains_profanity: false,
  profanity_count: 0,
  english_level: "B1",
  speech_clarity: 8,
  learning_score: 82,
  has_dialogue: false,
  idiom_density: 2,
  syntax_complexity: 3,
  abstractness: 2,
};

describe("rejectReason", () => {
  test("keeps a clean safe clip", () => {
    expect(rejectReason(safe)).toBeNull();
  });
  test("rejects unsafe", () => {
    expect(rejectReason({ ...safe, safe: false })).toBe("unsafe");
  });
  test("rejects each banned category", () => {
    expect(rejectReason({ ...safe, contains_politics: true })).toBe("politics");
    expect(rejectReason({ ...safe, contains_war: true })).toBe("war");
    expect(rejectReason({ ...safe, contains_sexual: true })).toBe("sexual");
    expect(rejectReason({ ...safe, contains_hate: true })).toBe("hate");
  });
  test("rejects profanity only at/above the threshold", () => {
    expect(
      rejectReason({
        ...safe,
        contains_profanity: true,
        profanity_count: PROFANITY_THRESHOLD - 1,
      }),
    ).toBeNull();
    expect(
      rejectReason({
        ...safe,
        contains_profanity: true,
        profanity_count: PROFANITY_THRESHOLD,
      }),
    ).toBe(`profanity:${PROFANITY_THRESHOLD}`);
  });
});

describe("classificationSchema", () => {
  test("validates a well-formed object", () => {
    expect(classificationSchema.parse(safe)).toEqual(safe);
  });
  test("rejects an out-of-range score", () => {
    expect(() => classificationSchema.parse({ ...safe, learning_score: 200 })).toThrow();
  });
});

describe("CLASSIFICATION_JSON_SCHEMA", () => {
  test("is in lockstep with the zod schema (same fields, all required)", () => {
    const zodKeys = Object.keys(classificationSchema.shape).sort();
    const jsonKeys = Object.keys(CLASSIFICATION_JSON_SCHEMA.properties).sort();
    const requiredKeys: string[] = [...CLASSIFICATION_JSON_SCHEMA.required];
    requiredKeys.sort();
    expect(jsonKeys).toEqual(zodKeys);
    expect(requiredKeys).toEqual(zodKeys);
  });
  test("forbids extra properties (structured-output requirement)", () => {
    expect(CLASSIFICATION_JSON_SCHEMA.additionalProperties).toBe(false);
  });
});

describe("buildUserContent", () => {
  test("includes all fields and labels empty tags", () => {
    const out = buildUserContent({
      title: "Tacos",
      description: "",
      tags: [],
      transcript: "hello there",
    });
    expect(out).toContain("TITLE: Tacos");
    expect(out).toContain("DESCRIPTION: (none)");
    expect(out).toContain("TAGS: (none)");
    expect(out).toContain("TRANSCRIPT:\nhello there");
  });
});
