import { ingestChannel, ingestVideo } from "@/db/ingest-schema";
import { channelSeed, type ChannelSeed } from "@/ingest/channels.seed";
import { fetchChannelShorts, type ChannelShorts } from "@/ingest/ytdlp";

// Discovery (bk-z5t.4): resolve each seed channel via yt-dlp, enumerate its
// /shorts tab, and upsert candidates as `ingest_video` rows in 'discovered'.
// Idempotent: existing videos are left untouched (onConflictDoNothing) so a
// re-run never resets the pipeline state of rows already in flight.

export type DiscoverResult = {
  handle: string;
  channelId: string | null;
  found: number; // entries returned by yt-dlp
  inserted: number; // new rows actually written
  error?: string;
};

export type DiscoverOptions = {
  limit: number; // max Shorts per channel
  persist: boolean; // false = dry run (no DB writes, no DB connection)
  delayMs: number; // pause between channels to stay rate-limit friendly
  seeds?: readonly ChannelSeed[];
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function discoverChannel(
  seed: ChannelSeed,
  limit: number,
  persist: boolean,
): Promise<DiscoverResult> {
  let data: ChannelShorts;
  try {
    data = await fetchChannelShorts(seed.handle, limit);
  } catch (err) {
    return {
      handle: seed.handle,
      channelId: null,
      found: 0,
      inserted: 0,
      error: (err as Error).message,
    };
  }

  const channelId = data.channelId;
  if (!channelId) {
    return {
      handle: seed.handle,
      channelId: null,
      found: data.entries.length,
      inserted: 0,
      error: "could not resolve channel id",
    };
  }

  if (!persist) {
    return {
      handle: seed.handle,
      channelId,
      found: data.entries.length,
      inserted: 0,
    };
  }

  // Lazy import so dry runs never open a DB connection (config requires
  // DATABASE_URL only when we actually persist).
  const { db } = await import("@/db");

  await db
    .insert(ingestChannel)
    .values({
      id: channelId,
      title: data.channelTitle ?? seed.handle,
      handle: seed.handle,
      topic: seed.topic,
      trust: seed.trust,
      notes: seed.notes,
    })
    .onConflictDoUpdate({
      target: ingestChannel.id,
      set: {
        title: data.channelTitle ?? seed.handle,
        handle: seed.handle,
        topic: seed.topic,
        trust: seed.trust,
      },
    });

  let inserted = 0;
  if (data.entries.length > 0) {
    const rows = data.entries.map((e) => ({
      id: e.id,
      channelId,
      title: e.title,
      durationS: e.durationS,
      isShort: true,
      stats: e.views != null ? { views: e.views } : {},
      status: "discovered" as const,
    }));
    const ins = await db
      .insert(ingestVideo)
      .values(rows)
      .onConflictDoNothing({ target: ingestVideo.id })
      .returning({ id: ingestVideo.id });
    inserted = ins.length;
  }

  return { handle: seed.handle, channelId, found: data.entries.length, inserted };
}

export async function discoverAll(
  opts: DiscoverOptions,
): Promise<DiscoverResult[]> {
  const seeds = opts.seeds ?? channelSeed;
  const results: DiscoverResult[] = [];
  for (const seed of seeds) {
    results.push(await discoverChannel(seed, opts.limit, opts.persist));
    if (opts.delayMs > 0) await sleep(opts.delayMs);
  }
  return results;
}
