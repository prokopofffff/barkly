import { describe, expect, test } from "bun:test";
import { posterArgs, transcodeArgs } from "@/ingest/ffmpeg";
import { pickEnglishVtt, videoDownloadArgs } from "@/ingest/ytdlp";

describe("transcodeArgs", () => {
  const args = transcodeArgs("in.mp4", "out.mp4");
  test("uses H.264 + faststart + the 720x1280 fit box", () => {
    expect(args).toContain("libx264");
    expect(args.join(" ")).toContain("+faststart");
    expect(args.join(" ")).toContain(
      "scale=w=720:h=1280:force_original_aspect_ratio=decrease",
    );
  });
  test("ends with the output path", () => {
    expect(args.at(-1)).toBe("out.mp4");
  });
});

describe("posterArgs", () => {
  test("seeks ~1s and grabs a single frame", () => {
    const a = posterArgs("in.mp4", "p.jpg");
    expect(a.slice(0, 4)).toEqual(["-ss", "1", "-i", "in.mp4"]);
    expect(a).toContain("-frames:v");
    expect(a.at(-1)).toBe("p.jpg");
  });
});

describe("videoDownloadArgs", () => {
  test("manual source writes creator subs", () => {
    const a = videoDownloadArgs("abc", "out/%(id)s.%(ext)s", "manual");
    expect(a).toContain("--write-subs");
    expect(a).not.toContain("--write-auto-subs");
    expect(a.join(" ")).toContain("--merge-output-format mp4");
    expect(a.at(-1)).toBe("https://www.youtube.com/watch?v=abc");
  });
  test("auto source writes ASR subs", () => {
    const a = videoDownloadArgs("abc", "out/%(id)s.%(ext)s", "auto");
    expect(a).toContain("--write-auto-subs");
    expect(a).not.toContain("--write-subs");
  });
  test("none source requests no subs", () => {
    const a = videoDownloadArgs("abc", "out/%(id)s.%(ext)s", "none");
    expect(a).not.toContain("--write-subs");
    expect(a).not.toContain("--write-auto-subs");
  });
});

describe("pickEnglishVtt", () => {
  test("prefers plain .en.vtt over regional/other langs", () => {
    const files = ["abc.mp4", "abc.es.vtt", "abc.en-US.vtt", "abc.en.vtt"];
    expect(pickEnglishVtt("abc", files)).toBe("abc.en.vtt");
  });
  test("falls back to a regional English variant", () => {
    expect(pickEnglishVtt("abc", ["abc.mp4", "abc.en-GB.vtt"])).toBe("abc.en-GB.vtt");
  });
  test("returns null when no English vtt exists", () => {
    expect(pickEnglishVtt("abc", ["abc.mp4", "abc.es.vtt"])).toBeNull();
  });
  test("ignores other videos' files", () => {
    expect(pickEnglishVtt("abc", ["xyz.en.vtt"])).toBeNull();
  });
});
