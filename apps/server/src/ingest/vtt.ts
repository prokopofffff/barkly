import type { SubtitleSegment } from "@/db/ingest-schema";

// WebVTT parsing for transcript normalization (bk-z5t.7). Handles both
// creator-uploaded captions and YouTube's messy auto-captions (inline <c>/<00:..>
// tags, positioning cues, and "rolling" duplicate lines).

export type ParsedTranscript = {
  readonly segments: readonly SubtitleSegment[];
  readonly text: string; // de-duplicated plain transcript
  readonly quality: number; // 0-1 heuristic (punctuation/capitalization)
};

function parseTimestamp(s: string): number | null {
  const m = /(\d{2}):(\d{2}):(\d{2})[.,](\d{3})/.exec(s);
  if (!m) return null;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4]) / 1000;
}

function stripTags(line: string): string {
  return line
    .replace(/<[^>]*>/g, "") // <c>, <00:00:01.000>, <i> …
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function qualityOf(text: string, wordCount: number): number {
  if (wordCount === 0) return 0;
  const sentencePunct = (text.match(/[.?!]/g) ?? []).length;
  const innerPunct = (text.match(/[,;:]/g) ?? []).length;
  // Proper-noun / sentence-start capitalization mid-stream (auto-captions are
  // usually all-lowercase with no punctuation).
  const capitalized = /[a-z][ ][A-Z]/.test(text) || /[.?!]\s+[A-Z]/.test(text);

  let q = 0;
  if (sentencePunct > 0) q += 0.4;
  if (sentencePunct / wordCount > 0.03) q += 0.2;
  if (innerPunct > 0) q += 0.2;
  if (capitalized) q += 0.2;
  return Math.min(1, q);
}

export function parseVtt(content: string): ParsedTranscript {
  const blocks = content.replace(/\r/g, "").split("\n\n");
  const segments: SubtitleSegment[] = [];

  for (const block of blocks) {
    const lines = block.split("\n").filter((l) => l.trim() !== "");
    const timingIdx = lines.findIndex((l) => l.includes("-->"));
    if (timingIdx === -1) continue; // header / NOTE / STYLE block

    const timing = lines[timingIdx]!.split("-->");
    const start = parseTimestamp(timing[0] ?? "");
    const end = parseTimestamp(timing[1] ?? "");
    if (start == null || end == null) continue;

    const text = lines
      .slice(timingIdx + 1)
      .map(stripTags)
      .filter(Boolean)
      .join(" ")
      .trim();
    if (text) segments.push({ start, end, text });
  }

  // De-duplicate the rolling repeats auto-captions emit. They typically grow a
  // line word by word across overlapping cues ("so", "so today", "so today we"),
  // so collapse a run where each cue extends the previous one, and drop cues
  // that are a shorter prefix of what we already kept.
  const kept: string[] = [];
  for (const seg of segments) {
    const t = seg.text;
    const last = kept.at(-1);
    if (last === undefined) {
      kept.push(t);
    } else if (t === last || `${last} `.startsWith(`${t} `)) {
      // exact repeat, or t is a prefix of last -> redundant
      continue;
    } else if (`${t} `.startsWith(`${last} `)) {
      kept[kept.length - 1] = t; // t extends last -> keep the longer
    } else {
      kept.push(t);
    }
  }
  const text = kept.join(" ").replace(/\s+/g, " ").trim();

  const wordCount = text ? text.split(/\s+/).length : 0;
  return { segments, text, quality: qualityOf(text, wordCount) };
}
