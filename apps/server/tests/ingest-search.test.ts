import { describe, expect, test } from "bun:test";
import { parseSearchResults } from "@/ingest/ytdlp";

describe("parseSearchResults", () => {
  test("extracts per-entry channel attribution, skips entries without an id", () => {
    const json = JSON.stringify({
      _type: "playlist",
      entries: [
        {
          id: "aaa",
          title: "A",
          duration: 30,
          view_count: 100,
          channel: "Chan One",
          channel_id: "UC111",
          uploader_id: "@chanone",
        },
        { id: "bbb", title: "B" }, // missing channel + metadata -> nulls
        { title: "no id" }, // dropped
        null, // dropped (yt-dlp --ignore-errors)
      ],
    });

    const r = parseSearchResults(json);

    expect(r).toEqual([
      {
        id: "aaa",
        title: "A",
        durationS: 30,
        views: 100,
        channelId: "UC111",
        channelTitle: "Chan One",
        channelHandle: "@chanone",
      },
      {
        id: "bbb",
        title: "B",
        durationS: null,
        views: null,
        channelId: null,
        channelTitle: null,
        channelHandle: null,
      },
    ]);
  });

  test("falls back to uploader_id for channelId and uploader for title", () => {
    const r = parseSearchResults(
      JSON.stringify({
        entries: [{ id: "x", uploader: "Up", uploader_id: "@up" }],
      }),
    );
    expect(r).toHaveLength(1);
    expect(r[0]!.channelId).toBe("@up");
    expect(r[0]!.channelTitle).toBe("Up");
    expect(r[0]!.channelHandle).toBe("@up");
  });

  test("tolerates empty / malformed roots", () => {
    expect(parseSearchResults(JSON.stringify({}))).toEqual([]);
    expect(parseSearchResults(JSON.stringify({ entries: "nope" }))).toEqual([]);
  });
});
