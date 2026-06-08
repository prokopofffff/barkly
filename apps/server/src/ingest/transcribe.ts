import { mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import type { CaptionSource } from "@/db/ingest-schema";
import { parseVtt } from "@/ingest/vtt";
import { fetchSubtitles } from "@/ingest/ytdlp";

// Transcript stage (bk-z5t.7, embed path): fetch ONLY the English subtitle (no
// video), normalize the VTT, and persist it. Advances prefiltered -> transcribed
// (or 'failed'). Idempotent: only 'prefiltered' rows are picked.

export type TranscribeResult = {
  videoId: string;
  ok: boolean;
  words?: number;
  quality?: number;
  error?: string;
};

export type TranscribeOptions = {
  limit: number;
  delayMs: number;
  persist: boolean;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function processOne(
  row: { id: string; captionSource: CaptionSource | null },
  persist: boolean,
): Promise<TranscribeResult> {
  const dir = join(tmpdir(), `barkly-sub-${row.id}`);
  const source = row.captionSource ?? "auto";
  try {
    await mkdir(dir, { recursive: true });
    const subPath = await fetchSubtitles(row.id, source, dir);
    if (!subPath) {
      throw new Error("no English subtitle produced");
    }
    const parsed = parseVtt(await readFile(subPath, "utf8"));
    const words = parsed.text ? parsed.text.split(/\s+/).length : 0;
    if (words === 0) {
      throw new Error("empty transcript after parse");
    }

    if (persist) {
      const { db } = await import("@/db");
      const { ingestVideo, transcript } = await import("@/db/ingest-schema");
      await db
        .insert(transcript)
        .values({
          videoId: row.id,
          lang: "en",
          source,
          text: parsed.text,
          segments: parsed.segments,
          quality: parsed.quality,
        })
        .onConflictDoUpdate({
          target: transcript.videoId,
          set: {
            source,
            text: parsed.text,
            segments: parsed.segments,
            quality: parsed.quality,
          },
        });
      await db
        .update(ingestVideo)
        .set({ status: "transcribed", error: null, updatedAt: new Date() })
        .where(eq(ingestVideo.id, row.id));
    }

    return { videoId: row.id, ok: true, words, quality: parsed.quality };
  } catch (err) {
    const message = (err as Error).message;
    if (persist) {
      const { db } = await import("@/db");
      const { ingestVideo } = await import("@/db/ingest-schema");
      await db
        .update(ingestVideo)
        .set({ status: "failed", error: message, updatedAt: new Date() })
        .where(eq(ingestVideo.id, row.id));
    }
    return { videoId: row.id, ok: false, error: message };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function runTranscribe(
  opts: TranscribeOptions,
): Promise<TranscribeResult[]> {
  const { db } = await import("@/db");
  const { ingestVideo } = await import("@/db/ingest-schema");
  const rows = await db
    .select({ id: ingestVideo.id, captionSource: ingestVideo.captionSource })
    .from(ingestVideo)
    .where(eq(ingestVideo.status, "prefiltered"))
    .limit(opts.limit);

  const results: TranscribeResult[] = [];
  for (const row of rows) {
    results.push(await processOne(row, opts.persist));
    if (opts.delayMs > 0) await sleep(opts.delayMs);
  }
  return results;
}
