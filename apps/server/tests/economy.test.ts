import { describe, expect, it } from "bun:test";
import type { Quiz } from "@barkly/zero";
import { applyEarn, gradeQuiz, MAX_XP_PER_ACTION, DAILY_XP_CAP } from "@/domain/lessons/economy";

describe("gradeQuiz", () => {
  const mc: Quiz = { type: "mc", prompt: "?", xp: 30, explain: "", options: ["a", "b", "c"], answer: 1 };
  const reorder: Quiz = { type: "reorder", prompt: "?", xp: 35, explain: "", words: ["I", "am"], answer: ["I", "am"] };

  it("grades index answers", () => {
    expect(gradeQuiz(mc, 1)).toBe(true);
    expect(gradeQuiz(mc, 0)).toBe(false);
  });

  it("grades reorder answers (order matters)", () => {
    expect(gradeQuiz(reorder, ["I", "am"])).toBe(true);
    expect(gradeQuiz(reorder, ["am", "I"])).toBe(false);
    expect(gradeQuiz(reorder, ["I"])).toBe(false);
  });
});

describe("applyEarn", () => {
  it("derives gems = floor(xp/2)", () => {
    expect(applyEarn({ xp: 0, xpToday: 0 }, 30)).toEqual({ xp: 30, xpToday: 30, gems: 15 });
    expect(applyEarn({ xp: 31, xpToday: 0 }, 0)).toEqual({ xp: 31, xpToday: 0, gems: 15 });
  });

  it("clamps a single action to MAX_XP_PER_ACTION", () => {
    const r = applyEarn({ xp: 0, xpToday: 0 }, 10_000);
    expect(r.xp).toBe(MAX_XP_PER_ACTION);
    expect(r.xpToday).toBe(MAX_XP_PER_ACTION);
  });

  it("respects the daily cap and never grants negative xp", () => {
    expect(applyEarn({ xp: 9000, xpToday: DAILY_XP_CAP }, 50).xp).toBe(9000); // no more today
    expect(applyEarn({ xp: 100, xpToday: 0 }, -50).xp).toBe(100); // negative ignored
  });
});
