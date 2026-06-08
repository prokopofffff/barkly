import { eq } from "drizzle-orm";
import type { CaptionSource } from "@/db/ingest-schema";
import { fetchVideoMeta, type VideoMeta } from "@/ingest/ytdlp";

// Cheap pre-filter (bk-z5t.5): drop candidates BEFORE any video download or LLM
// spend. The allowlist already removed unsafe sources, so this is a crude,
// HIGH-PRECISION backstop — nuanced topic/safety judgement is the LLM's job
// (bk-z5t.9). We deliberately keep the keyword denylist small to avoid false
// drops (e.g. a movie clip mentioning a sensitive word).
//
// Filters: keyword denylist, Shorts duration range, English-caption presence,
// obvious non-Latin titles. Reasons are recorded on the rejected row.

export const MIN_SHORT_S = 3;
export const MAX_SHORT_S = 180;

// High-precision real-world terms that rarely appear in safe lifestyle content.
// Matched as whole words, case-insensitive. NOT a profanity/hate list (that is
// the LLM's call) — just unambiguous excluded-topic / explicit signals.
export const DENYLIST: readonly string[] = [
  "election",
  "ceasefire",
  "airstrike",
  "genocide",
  "terrorist",
  "terrorism",
  "jihad",
  "onlyfans",
  "porn",
  "nsfw",
  "xxx",
];

const DENY_RE = new RegExp(`\\b(${DENYLIST.join("|")})\\b`, "i");

/** First denylisted term found in the text, or null. */
export function matchesDenylist(text: string): string | null {
  const m = DENY_RE.exec(text);
  return m ? m[1]!.toLowerCase() : null;
}

const isEnglishLang = (l: string) => l.toLowerCase().startsWith("en");

/** English caption availability, preferring creator-uploaded over ASR. */
export function englishCaptionSource(
  manual: readonly string[],
  auto: readonly string[],
): CaptionSource {
  if (manual.some(isEnglishLang)) return "manual";
  if (auto.some(isEnglishLang)) return "auto";
  return "none";
}

/** Reject titles that are overwhelmingly non-Latin script (e.g. Cyrillic/CJK).
 * Titles with no letters at all (emoji-only) are treated as fine. */
export function looksLatin(title: string): boolean {
  const letters = title.match(/\p{L}/gu) ?? [];
  if (letters.length === 0) return true;
  const latin = title.match(/\p{Script=Latin}/gu) ?? [];
  return latin.length / letters.length >= 0.5;
}

export type PrefilterInput = {
  readonly title: string;
  readonly description: string;
  readonly durationS: number | null;
  readonly manualCaptionLangs: readonly string[];
  readonly autoCaptionLangs: readonly string[];
};

export type PrefilterVerdict = {
  readonly ok: boolean;
  readonly reason?: string;
  readonly captionSource: CaptionSource;
  readonly langCode: string | null;
};

/** Pure decision: keep or drop, with the reason and enriched fields. */
export function evaluatePrefilter(input: PrefilterInput): PrefilterVerdict {
  const captionSource = englishCaptionSource(
    input.manualCaptionLangs,
    input.autoCaptionLangs,
  );
  const langCode = captionSource !== "none" ? "en" : null;
  const text = `${input.title}\n${input.description}`;

  const banned = matchesDenylist(text);
  if (banned) {
    return { ok: false, reason: `denylist:${banned}`, captionSource, langCode };
  }
  if (
    input.durationS != null &&
    (input.durationS < MIN_SHORT_S || input.durationS > MAX_SHORT_S)
  ) {
    return {
      ok: false,
      reason: `duration:${input.durationS}s`,
      captionSource,
      langCode,
    };
  }
  if (captionSource === "none") {
    return { ok: false, reason: "no_english_captions", captionSource, langCode };
  }
  if (!looksLatin(input.title)) {
    return { ok: false, reason: "not_english", captionSource, langCode };
  }
  return { ok: true, captionSource, langCode };
}

// --- stage runner ------------------------------------------------------------

export type PrefilterResult = {
  videoId: string;
  ok: boolean;
  reason?: string;
  error?: string;
};

export type PrefilterOptions = {
  limit: number;
  delayMs: number;
  persist: boolean;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function statsOf(meta: VideoMeta) {
  const s: { views?: number; likes?: number; comments?: number } = {};
  if (meta.views != null) s.views = meta.views;
  if (meta.likes != null) s.likes = meta.likes;
  if (meta.comments != null) s.comments = meta.comments;
  return s;
}

export async function runPrefilter(
  opts: PrefilterOptions,
): Promise<PrefilterResult[]> {
  const { db } = await import("@/db");
  const { ingestVideo } = await import("@/db/ingest-schema");

  const rows = await db
    .select()
    .from(ingestVideo)
    .where(eq(ingestVideo.status, "discovered"))
    .limit(opts.limit);

  const results: PrefilterResult[] = [];
  for (const row of rows) {
    let meta: VideoMeta;
    try {
      meta = await fetchVideoMeta(row.id);
    } catch (err) {
      const message = (err as Error).message;
      if (opts.persist) {
        await db
          .update(ingestVideo)
          .set({ status: "failed", error: message, updatedAt: new Date() })
          .where(eq(ingestVideo.id, row.id));
      }
      results.push({ videoId: row.id, ok: false, error: message });
      if (opts.delayMs > 0) await sleep(opts.delayMs);
      continue;
    }

    const verdict = evaluatePrefilter({
      title: meta.title || row.title,
      description: meta.description,
      durationS: meta.durationS ?? row.durationS,
      manualCaptionLangs: meta.manualCaptionLangs,
      autoCaptionLangs: meta.autoCaptionLangs,
    });

    if (opts.persist) {
      await db
        .update(ingestVideo)
        .set({
          title: meta.title || row.title,
          description: meta.description,
          tags: meta.tags,
          durationS: meta.durationS ?? row.durationS,
          stats: statsOf(meta),
          langCode: verdict.langCode,
          captionSource: verdict.captionSource,
          status: verdict.ok ? "prefiltered" : "prefiltered_out",
          rejectReason: verdict.ok ? null : verdict.reason,
          updatedAt: new Date(),
        })
        .where(eq(ingestVideo.id, row.id));
    }

    results.push({ videoId: row.id, ok: verdict.ok, reason: verdict.reason });
    if (opts.delayMs > 0) await sleep(opts.delayMs);
  }

  return results;
}
