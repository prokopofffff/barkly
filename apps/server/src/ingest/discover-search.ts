import { sleep } from "@/ingest/util";
import { ingestChannel, ingestVideo } from "@/db/ingest-schema";
import { MAX_SHORT_S } from "@/ingest/prefilter";
import { searchSeed, type SearchQuery } from "@/ingest/search.seed";
import { searchShorts, type SearchEntry } from "@/ingest/ytdlp";

// Keyless search discovery (bk-44m): run curated ytsearch queries and upsert the
// hits as `ingest_video` candidates, attributing each to its real channel. No
// YouTube Data API key, no quota — yt-dlp does the search. Unlike channel
// discovery the source channels are NOT hand-vetted, so they get low trust and
// lean on the downstream denylist + Haiku classify gate for safety.
//
// Idempotent: existing videos/channels are left untouched (onConflictDoNothing /
// DoUpdate) so a re-run never resets in-flight pipeline state.

// Search-discovered channels are unvetted; mark them low-trust so any later
// curation can tell them apart from the hand-picked allowlist.
const SEARCH_TRUST = 1;

export type SearchDiscoverResult = {
  query: string;
  found: number; // hits returned by yt-dlp
  kept: number; // hits with a channel id and short-enough duration
  inserted: number; // new candidate rows actually written
  error?: string;
};

export type SearchDiscoverOptions = {
  limitPerQuery: number;
  persist: boolean;
  delayMs: number;
  queries?: readonly SearchQuery[];
};

/** Drop hits we already know are unusable: no channel id (can't satisfy the
 * NOT NULL FK) or a duration clearly past the Shorts ceiling (prefilter would
 * drop them anyway — skip the wasted metadata fetch). */
function keepHit(e: SearchEntry): boolean {
  if (!e.channelId) return false;
  if (e.durationS != null && e.durationS > MAX_SHORT_S) return false;
  return true;
}

export async function discoverQuery(
  sq: SearchQuery,
  limit: number,
  persist: boolean,
): Promise<SearchDiscoverResult> {
  let hits: SearchEntry[];
  try {
    hits = await searchShorts(sq.query, limit);
  } catch (err) {
    return { query: sq.query, found: 0, kept: 0, inserted: 0, error: (err as Error).message };
  }

  const kept = hits.filter(keepHit);
  if (!persist) {
    return { query: sq.query, found: hits.length, kept: kept.length, inserted: 0 };
  }

  // Lazy import so dry runs never open a DB connection.
  const { db } = await import("@/db");

  // Upsert each distinct channel behind the hits (topic from the query).
  const channels = new Map<string, SearchEntry>();
  for (const e of kept) if (e.channelId && !channels.has(e.channelId)) channels.set(e.channelId, e);
  for (const [channelId, e] of channels) {
    await db
      .insert(ingestChannel)
      .values({
        id: channelId,
        title: e.channelTitle ?? e.channelHandle ?? channelId,
        handle: e.channelHandle ?? channelId,
        topic: sq.topic,
        trust: SEARCH_TRUST,
        notes: `via search: ${sq.query}`,
      })
      // Don't clobber a hand-curated channel's topic/trust if it already exists.
      .onConflictDoNothing({ target: ingestChannel.id });
  }

  let inserted = 0;
  if (kept.length > 0) {
    const rows = kept.map((e) => ({
      id: e.id,
      channelId: e.channelId as string,
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

  return { query: sq.query, found: hits.length, kept: kept.length, inserted };
}

export async function discoverBySearch(
  opts: SearchDiscoverOptions,
): Promise<SearchDiscoverResult[]> {
  const queries = opts.queries ?? searchSeed;
  const results: SearchDiscoverResult[] = [];
  for (const sq of queries) {
    results.push(await discoverQuery(sq, opts.limitPerQuery, opts.persist));
    if (opts.delayMs > 0) await sleep(opts.delayMs);
  }
  return results;
}
