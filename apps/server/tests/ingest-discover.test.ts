import { describe, expect, test } from "bun:test";
import { channelShortsUrl, parseChannelShorts } from "@/ingest/ytdlp";

describe("parseChannelShorts", () => {
  test("extracts channel + entries, skips entries without an id", () => {
    const json = JSON.stringify({
      _type: "playlist",
      channel_id: "UC123",
      channel: "Test Channel",
      entries: [
        { id: "aaa", title: "A", duration: 30, view_count: 100 },
        { id: "bbb", title: "B" }, // missing duration/views -> null
        { title: "no id" }, // dropped
        null, // dropped (yt-dlp --ignore-errors)
      ],
    });

    const r = parseChannelShorts(json);

    expect(r.channelId).toBe("UC123");
    expect(r.channelTitle).toBe("Test Channel");
    expect(r.entries).toEqual([
      { id: "aaa", title: "A", durationS: 30, views: 100 },
      { id: "bbb", title: "B", durationS: null, views: null },
    ]);
  });

  test("falls back to uploader for channel name; null id when absent", () => {
    const r = parseChannelShorts(JSON.stringify({ uploader: "Up", entries: [] }));
    expect(r.channelTitle).toBe("Up");
    expect(r.channelId).toBeNull();
    expect(r.entries).toEqual([]);
  });
});

describe("channelShortsUrl", () => {
  test("keeps an @handle", () => {
    expect(channelShortsUrl("@TED")).toBe("https://www.youtube.com/@TED/shorts");
  });
  test("adds @ to a bare handle", () => {
    expect(channelShortsUrl("TED")).toBe("https://www.youtube.com/@TED/shorts");
  });
  test("routes a UC… id through /channel", () => {
    expect(channelShortsUrl("UCabcdefghijklmnopqrstuv")).toBe(
      "https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv/shorts",
    );
  });
});
