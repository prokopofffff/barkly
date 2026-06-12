import { describe, expect, it } from "bun:test";
import { parseYouTubeId } from "@/ingest/url";

// Pure tests — no DB, no yt-dlp, no network. parseYouTubeId is the gate that
// turns a pasted string into a video id (or a 400), and submitYouTubeShort
// rejects an unparseable URL before it ever touches the DB or the network.
describe("parseYouTubeId", () => {
  it("extracts the id from every share form a curator might paste", () => {
    const id = "dQw4w9WgXcQ";
    expect(parseYouTubeId(id)).toBe(id);
    expect(parseYouTubeId(`https://www.youtube.com/shorts/${id}`)).toBe(id);
    expect(parseYouTubeId(`https://youtube.com/shorts/${id}?feature=share`)).toBe(id);
    expect(parseYouTubeId(`https://youtu.be/${id}`)).toBe(id);
    expect(parseYouTubeId(`https://youtu.be/${id}?t=3`)).toBe(id);
    expect(parseYouTubeId(`https://www.youtube.com/watch?v=${id}`)).toBe(id);
    expect(parseYouTubeId(`https://m.youtube.com/watch?v=${id}&list=xyz`)).toBe(id);
    expect(parseYouTubeId(`https://www.youtube.com/embed/${id}`)).toBe(id);
    expect(parseYouTubeId(`  ${id}  `)).toBe(id);
  });

  it("rejects non-YouTube and malformed input", () => {
    expect(parseYouTubeId("")).toBeNull();
    expect(parseYouTubeId("not a url")).toBeNull();
    expect(parseYouTubeId("https://vimeo.com/123456")).toBeNull();
    expect(parseYouTubeId("https://www.youtube.com/shorts/tooshort")).toBeNull();
    expect(parseYouTubeId("dQw4w9WgXc")).toBeNull(); // 10 chars
  });
});

describe("submitYouTubeShort", () => {
  it("throws invalid_url before any DB/network when the URL has no id", async () => {
    const { submitYouTubeShort, SubmitError } = await import("@/domain/curator/submit");
    const err = await submitYouTubeShort({ url: "https://example.com/nope" }).catch((e) => e);
    expect(err).toBeInstanceOf(SubmitError);
    expect(err.code).toBe("invalid_url");
  });
});
