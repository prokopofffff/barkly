import { eq } from "drizzle-orm";
import { COMMON_WORDS } from "@/ingest/data/common-words";

// Deterministic language features (bk-z5t.8) — no LLM. Computed from the
// transcript + duration; feeds the difficulty prior (bk-z5t.10). Speech rate,
// vocabulary diversity, and rarity vs a frequency list are far more stable
// computed here than asked of a model.

// word -> frequency rank (0 = most common). Built once.
const RANK: ReadonlyMap<string, number> = new Map(
  COMMON_WORDS.map((w, i) => [w, i] as const),
);

export type FreqDistribution = {
  top1000: number;
  top3000: number;
  top5000: number;
  beyond: number; // outside the 5000 most common (our "rare" bucket)
};

export type FeatureVector = {
  wordCount: number;
  uniqueWords: number;
  ttr: number; // type-token ratio
  wpm: number; // words per minute
  rareWordRatio: number; // share of tokens outside the top 5000
  freqDistribution: FreqDistribution;
  avgSentenceLen: number; // words per sentence
};

/** Lowercased word tokens, keeping intra-word apostrophes (don't, it's). */
export function tokenize(text: string): string[] {
  return text.toLowerCase().match(/\p{L}+(?:'\p{L}+)?/gu) ?? [];
}

export function computeFeatures(
  text: string,
  durationS: number | null,
): FeatureVector {
  const tokens = tokenize(text);
  const wordCount = tokens.length;
  const uniqueWords = new Set(tokens).size;
  const ttr = wordCount ? uniqueWords / wordCount : 0;

  const minutes = durationS && durationS > 0 ? durationS / 60 : 0;
  const wpm = minutes ? wordCount / minutes : 0;

  const dist: FreqDistribution = { top1000: 0, top3000: 0, top5000: 0, beyond: 0 };
  for (const t of tokens) {
    const rank = RANK.get(t);
    if (rank === undefined) dist.beyond++;
    else if (rank < 1000) dist.top1000++;
    else if (rank < 3000) dist.top3000++;
    else dist.top5000++;
  }
  const rareWordRatio = wordCount ? dist.beyond / wordCount : 0;

  const sentences = text
    .split(/[.?!]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  // No sentence punctuation (typical of raw auto-captions) -> treat as one run.
  const avgSentenceLen = sentences.length ? wordCount / sentences.length : wordCount;

  return {
    wordCount,
    uniqueWords,
    ttr,
    wpm,
    rareWordRatio,
    freqDistribution: dist,
    avgSentenceLen,
  };
}

// --- stage runner ------------------------------------------------------------

export type FeaturesResult = {
  videoId: string;
  ok: boolean;
  wpm?: number;
  rareWordRatio?: number;
  error?: string;
};

export async function runFeatures(opts: {
  limit: number;
  persist: boolean;
}): Promise<FeaturesResult[]> {
  const { db } = await import("@/db");
  const { ingestVideo, transcript, videoFeatures } = await import(
    "@/db/ingest-schema"
  );

  const rows = await db
    .select({
      id: ingestVideo.id,
      durationS: ingestVideo.durationS,
      text: transcript.text,
    })
    .from(ingestVideo)
    .innerJoin(transcript, eq(transcript.videoId, ingestVideo.id))
    .where(eq(ingestVideo.status, "transcribed"))
    .limit(opts.limit);

  const results: FeaturesResult[] = [];
  for (const row of rows) {
    try {
      const f = computeFeatures(row.text, row.durationS);
      if (opts.persist) {
        await db
          .insert(videoFeatures)
          .values({
            videoId: row.id,
            wpm: f.wpm,
            wordCount: f.wordCount,
            uniqueWords: f.uniqueWords,
            ttr: f.ttr,
            rareWordRatio: f.rareWordRatio,
            freqDistribution: f.freqDistribution,
            avgSentenceLen: f.avgSentenceLen,
          })
          .onConflictDoUpdate({
            target: videoFeatures.videoId,
            set: {
              wpm: f.wpm,
              wordCount: f.wordCount,
              uniqueWords: f.uniqueWords,
              ttr: f.ttr,
              rareWordRatio: f.rareWordRatio,
              freqDistribution: f.freqDistribution,
              avgSentenceLen: f.avgSentenceLen,
            },
          });
        await db
          .update(ingestVideo)
          .set({ status: "featured", error: null, updatedAt: new Date() })
          .where(eq(ingestVideo.id, row.id));
      }
      results.push({
        videoId: row.id,
        ok: true,
        wpm: f.wpm,
        rareWordRatio: f.rareWordRatio,
      });
    } catch (err) {
      results.push({ videoId: row.id, ok: false, error: (err as Error).message });
    }
  }
  return results;
}
