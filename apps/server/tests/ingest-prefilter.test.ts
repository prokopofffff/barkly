import { describe, expect, test } from "bun:test";
import {
  englishCaptionSource,
  evaluatePrefilter,
  looksLatin,
  matchesDenylist,
  type PrefilterInput,
} from "@/ingest/prefilter";
import { parseVideoMeta } from "@/ingest/ytdlp";

const base: PrefilterInput = {
  title: "How to cook the perfect omelette",
  description: "A quick breakfast tutorial.",
  durationS: 45,
  manualCaptionLangs: ["en"],
  autoCaptionLangs: ["en", "es"],
};

describe("matchesDenylist", () => {
  test("matches a whole word, case-insensitive", () => {
    expect(matchesDenylist("The 2024 ELECTION results")).toBe("election");
  });
  test("does not match inside another word", () => {
    expect(matchesDenylist("warm porridge")).toBeNull(); // not 'war'/'porn'
    expect(matchesDenylist("a calm cooking video")).toBeNull();
  });
});

describe("englishCaptionSource", () => {
  test("prefers manual English", () => {
    expect(englishCaptionSource(["en-US"], ["en"])).toBe("manual");
  });
  test("falls back to auto English", () => {
    expect(englishCaptionSource(["es"], ["en"])).toBe("auto");
  });
  test("none when no English captions", () => {
    expect(englishCaptionSource(["es"], ["fr"])).toBe("none");
  });
});

describe("looksLatin", () => {
  test("Latin title passes", () => expect(looksLatin("Best tacos ever")).toBe(true));
  test("emoji-only title passes", () => expect(looksLatin("🔥🔥🔥")).toBe(true));
  test("Cyrillic title fails", () => expect(looksLatin("Лучшие тако")).toBe(false));
});

describe("evaluatePrefilter", () => {
  test("keeps a clean English short", () => {
    const v = evaluatePrefilter(base);
    expect(v).toEqual({ ok: true, captionSource: "manual", langCode: "en" });
  });
  test("drops on denylist before other checks", () => {
    const v = evaluatePrefilter({ ...base, title: "My honest take on the election" });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe("denylist:election");
  });
  test("drops over-long video", () => {
    const v = evaluatePrefilter({ ...base, durationS: 600 });
    expect(v).toMatchObject({ ok: false, reason: "duration:600s" });
  });
  test("drops when no English captions", () => {
    const v = evaluatePrefilter({
      ...base,
      manualCaptionLangs: [],
      autoCaptionLangs: ["es"],
    });
    expect(v).toMatchObject({ ok: false, reason: "no_english_captions" });
  });
  test("missing duration is not a reason to drop", () => {
    expect(evaluatePrefilter({ ...base, durationS: null }).ok).toBe(true);
  });
});

describe("parseVideoMeta", () => {
  test("normalizes caption langs and stats", () => {
    const json = JSON.stringify({
      id: "abc",
      title: "T",
      description: "D",
      duration: 42,
      upload_date: "20260101",
      tags: ["a", 1, "b"],
      view_count: 1000,
      like_count: 50,
      subtitles: { en: [{}], es: [{}] },
      automatic_captions: { en: [{}], fr: [{}] },
    });
    const m = parseVideoMeta(json);
    expect(m.durationS).toBe(42);
    expect(m.tags).toEqual(["a", "b"]); // non-strings dropped
    expect(m.views).toBe(1000);
    expect(m.comments).toBeNull();
    expect(m.manualCaptionLangs).toEqual(["en", "es"]);
    expect(m.autoCaptionLangs).toEqual(["en", "fr"]);
  });
});
