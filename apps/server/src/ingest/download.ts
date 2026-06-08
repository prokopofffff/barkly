import { mkdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import type { CaptionSource } from "@/db/ingest-schema";
import { poster, transcode } from "@/ingest/ffmpeg";
import { downloadVideo } from "@/ingest/ytdlp";
import { mediaKeys, putObject } from "@/lib/storage";

// Download + transcode + upload (bk-z5t.6). For each 'prefiltered' candidate:
// yt-dlp pulls the video + English subs into a temp dir, ffmpeg makes the 720p
// mobile rendition (+faststart) and a poster frame, and the renditions are
// uploaded to Object Storage. Advances the row to 'downloaded' (or 'failed').
// Idempotent: only 'prefiltered' rows are picked, and a success flips the
// status so a re-run skips them.

export type DownloadResult = {
  videoId: string;
  ok: boolean;
  error?: string;
  mp4Bytes?: number;
  posterBytes?: number;
  hasSub?: boolean;
};

export type DownloadOptions = {
  limit: number;
  delayMs: number;
  persist: boolean; // false = download+transcode locally, no upload, no DB write
  keepRaw: boolean; // also upload the original as source-of-truth
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fileSize(path: string): Promise<number> {
  return (await stat(path)).size;
}

async function processOne(
  row: { id: string; captionSource: CaptionSource | null },
  opts: DownloadOptions,
): Promise<DownloadResult> {
  const dir = join(tmpdir(), `barkly-ingest-${row.id}`);
  try {
    await mkdir(dir, { recursive: true });
    const { videoPath, subPath } = await downloadVideo(
      row.id,
      row.captionSource ?? "auto",
      dir,
    );

    const mp4Path = join(dir, `${row.id}.720p.mp4`);
    const posterPath = join(dir, `${row.id}.jpg`);
    await transcode(videoPath, mp4Path);
    await poster(videoPath, posterPath);

    const result: DownloadResult = {
      videoId: row.id,
      ok: true,
      mp4Bytes: await fileSize(mp4Path),
      posterBytes: await fileSize(posterPath),
      hasSub: subPath != null,
    };

    if (opts.persist) {
      if (opts.keepRaw) {
        await putObject(mediaKeys.raw(row.id), await readFile(videoPath), "video/mp4");
      }
      await putObject(mediaKeys.mp4(row.id), await readFile(mp4Path), "video/mp4");
      await putObject(mediaKeys.poster(row.id), await readFile(posterPath), "image/jpeg");
      if (subPath) {
        await putObject(mediaKeys.sub(row.id, "en"), await readFile(subPath), "text/vtt");
      }

      const { db } = await import("@/db");
      const { ingestVideo } = await import("@/db/ingest-schema");
      await db
        .update(ingestVideo)
        .set({
          rawKey: opts.keepRaw ? mediaKeys.raw(row.id) : null,
          mp4Key: mediaKeys.mp4(row.id),
          posterKey: mediaKeys.poster(row.id),
          status: "downloaded",
          error: null,
          updatedAt: new Date(),
        })
        .where(eq(ingestVideo.id, row.id));
    }

    return result;
  } catch (err) {
    const message = (err as Error).message;
    if (opts.persist) {
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

export async function runDownload(
  opts: DownloadOptions,
): Promise<DownloadResult[]> {
  const { db } = await import("@/db");
  const { ingestVideo } = await import("@/db/ingest-schema");
  const rows = await db
    .select({ id: ingestVideo.id, captionSource: ingestVideo.captionSource })
    .from(ingestVideo)
    .where(eq(ingestVideo.status, "prefiltered"))
    .limit(opts.limit);

  const results: DownloadResult[] = [];
  for (const row of rows) {
    results.push(await processOne(row, opts));
    if (opts.delayMs > 0) await sleep(opts.delayMs);
  }
  return results;
}
