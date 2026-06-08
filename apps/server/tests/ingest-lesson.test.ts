import { describe, expect, test } from "bun:test";
import {
  LESSON_JSON_SCHEMA,
  lessonSchema,
  toQuiz,
  toSubtitleTokens,
} from "@/ingest/lesson";

describe("toSubtitleTokens", () => {
  test("keeps order; drops empty translations; keeps key only when translated", () => {
    const out = toSubtitleTokens([
      { w: "I", t: "", key: false },
      { w: "pulled", t: "провернул", key: true },
      { w: "it", t: "", key: false },
      { w: "off", t: "(до конца)", key: true },
      { w: "stranded", t: "", key: true }, // key but no translation -> plain
    ]);
    expect(out).toEqual([
      { w: "I" },
      { w: "pulled", t: "провернул", key: true },
      { w: "it" },
      { w: "off", t: "(до конца)", key: true },
      { w: "stranded" },
    ]);
  });
});

describe("toQuiz", () => {
  test("builds an mc quiz", () => {
    expect(
      toQuiz({
        type: "mc",
        prompt: "Что значит X?",
        options: ["a", "b", "c", "d"],
        answer: 2,
        explain: "потому что",
        xp: 30,
      }),
    ).toEqual({
      type: "mc",
      prompt: "Что значит X?",
      options: ["a", "b", "c", "d"],
      answer: 2,
      xp: 30,
      explain: "потому что",
    });
  });

  test("clamps an out-of-range answer index", () => {
    const q = toQuiz({
      type: "mc",
      prompt: "?",
      options: ["a", "b"],
      answer: 9,
      explain: "",
      xp: 20,
    });
    expect(q.type === "mc" && q.answer).toBe(1);
  });
});

describe("lessonSchema / JSON schema", () => {
  test("validates a well-formed raw lesson", () => {
    const raw = {
      caption_ru: "Полезная фраза 🎬",
      subtitle: [{ w: "hello", t: "", key: false }],
      quiz: {
        type: "mc" as const,
        prompt: "?",
        options: ["a", "b", "c", "d"],
        answer: 0,
        explain: "e",
        xp: 25,
      },
    };
    expect(lessonSchema.parse(raw)).toEqual(raw);
  });

  test("top-level required keys match the zod shape", () => {
    const zodKeys = Object.keys(lessonSchema.shape).sort();
    const requiredKeys: string[] = [...LESSON_JSON_SCHEMA.required];
    requiredKeys.sort();
    expect(requiredKeys).toEqual(zodKeys);
    expect(LESSON_JSON_SCHEMA.additionalProperties).toBe(false);
  });
});
