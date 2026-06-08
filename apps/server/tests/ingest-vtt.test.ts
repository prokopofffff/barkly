import { describe, expect, test } from "bun:test";
import { parseVtt } from "@/ingest/vtt";

describe("parseVtt", () => {
  test("parses a clean manual caption with timings + good quality", () => {
    const vtt = [
      "WEBVTT",
      "",
      "00:00:00.000 --> 00:00:02.500",
      "Hello, and welcome back.",
      "",
      "00:00:02.500 --> 00:00:05.000",
      "Today we cook an omelette.",
      "",
    ].join("\n");

    const r = parseVtt(vtt);
    expect(r.segments).toHaveLength(2);
    expect(r.segments[0]).toEqual({
      start: 0,
      end: 2.5,
      text: "Hello, and welcome back.",
    });
    expect(r.text).toBe("Hello, and welcome back. Today we cook an omelette.");
    expect(r.quality).toBeGreaterThan(0.6); // punctuation + capitalization
  });

  test("strips inline tags and de-dups rolling auto-caption repeats", () => {
    const vtt = [
      "WEBVTT",
      "",
      "00:00:00.000 --> 00:00:01.000",
      "so today",
      "",
      "00:00:01.000 --> 00:00:02.000",
      "so today<00:00:01.500><c> we</c>",
      "",
      "00:00:02.000 --> 00:00:03.000",
      "so today we are cooking",
      "",
    ].join("\n");

    const r = parseVtt(vtt);
    // tags stripped, rolling prefix-growth collapsed to the final line
    expect(r.text).toBe("so today we are cooking");
    expect(r.quality).toBeLessThan(0.5); // lowercase, no punctuation
  });

  test("ignores NOTE/STYLE/header blocks and malformed timings", () => {
    const vtt = [
      "WEBVTT",
      "Kind: captions",
      "Language: en",
      "",
      "NOTE this is a comment",
      "",
      "not-a-timing line",
      "",
      "00:00:04.000 --> 00:00:06.000",
      "Real line.",
      "",
    ].join("\n");

    const r = parseVtt(vtt);
    expect(r.segments).toHaveLength(1);
    expect(r.text).toBe("Real line.");
  });
});
