import { eq } from "drizzle-orm";
import * as s from "@/db/schema";
import { ingestChannel, ingestVideo } from "@/db/ingest-schema";
import { fetchVideoMeta } from "@/ingest/ytdlp";
import { parseYouTubeId } from "@/ingest/url";
import { MAX_SHORT_S, MIN_SHORT_S } from "@/ingest/prefilter";

// Curator submission entry point (bk-jaz.9.2). A vetted curator/admin pastes a
// YouTube Shorts URL; we validate it's an embeddable Short, dedupe, and inject a
// candidate into the EXISTING ingest pipeline (discover stage is skipped — this
// IS the discovery). The pipeline then runs the full gauntlet
// (prefilter → transcribe → features → classify → difficulty → lesson → promote)
// and the promote stage writes the embed-only `video` row (youtubeId, hlsUrl="").
//
// MVP embeds YouTube; we never download/host the media (see BACKEND_PLAN §7).

/** Synthetic channel all single-URL curator submissions hang off (ingest_video
 * requires a channel FK; real discovery uses one row per YouTube channel). */
export const CURATOR_CHANNEL_ID = "curator_submissions";

export class SubmitError extends Error {
  constructor(
    readonly code: "invalid_url" | "fetch_failed" | "not_embeddable" | "not_a_short",
    message: string,
  ) {
    super(message);
    this.name = "SubmitError";
  }
}

export type SubmitResult = {
  id: string; // the resolved YouTube video id
  status: "queued" | "duplicate";
  /** For a duplicate: where it already lives. "video" = already in the feed. */
  existing?: "video" | "ingest";
};

export async function submitYouTubeShort(args: { url: string }): Promise<SubmitResult> {
  const id = parseYouTubeId(args.url);
  if (!id) throw new SubmitError("invalid_url", "not a YouTube video URL or id");

  let meta;
  try {
    meta = await fetchVideoMeta(id);
  } catch (err) {
    throw new SubmitError("fetch_failed", (err as Error).message);
  }

  // The embed feed can't play a clip the creator blocked from embedding.
  if (!meta.embeddable) throw new SubmitError("not_embeddable", "creator disabled embedding");
  // Guard the obvious "this is a full video, not a Short" case up front; the
  // prefilter re-checks against the same bounds.
  if (meta.durationS != null && (meta.durationS < MIN_SHORT_S || meta.durationS > MAX_SHORT_S)) {
    throw new SubmitError("not_a_short", `duration ${meta.durationS}s is outside the Shorts range`);
  }

  // Lazy import so the pure validation above (and parseYouTubeId) stays usable
  // without a DB connection, matching the rest of the ingest stages.
  const { db } = await import("@/db");

  // Dedupe: already promoted into the feed, or already somewhere in the pipeline.
  const [live] = await db.select({ id: s.video.id }).from(s.video).where(eq(s.video.id, id));
  if (live) return { id, status: "duplicate", existing: "video" };
  const [pending] = await db
    .select({ id: ingestVideo.id })
    .from(ingestVideo)
    .where(eq(ingestVideo.id, id));
  if (pending) return { id, status: "duplicate", existing: "ingest" };

  // Ensure the synthetic channel exists (FK target), then queue the candidate.
  await db
    .insert(ingestChannel)
    .values({
      id: CURATOR_CHANNEL_ID,
      title: "Curator submissions",
      topic: "curated",
      trust: 3,
      notes: "Synthetic channel for curator/admin single-URL submissions (bk-jaz.9.2).",
    })
    .onConflictDoNothing({ target: ingestChannel.id });

  const stats: { views?: number; likes?: number; comments?: number } = {};
  if (meta.views != null) stats.views = meta.views;
  if (meta.likes != null) stats.likes = meta.likes;
  if (meta.comments != null) stats.comments = meta.comments;

  await db
    .insert(ingestVideo)
    .values({
      id,
      channelId: CURATOR_CHANNEL_ID,
      title: meta.title,
      description: meta.description,
      durationS: meta.durationS,
      isShort: true,
      stats,
      status: "discovered",
    })
    .onConflictDoNothing({ target: ingestVideo.id });

  return { id, status: "queued" };
}
