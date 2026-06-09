import { eq } from "drizzle-orm";

// Difficulty prior (bk-z5t.10): combine the deterministic features with the
// LLM's level/clarity judgement into a single CONTINUOUS score — NOT a CEFR
// label. The scale is ELO-like (0 = easiest … 1000 = hardest) so the post-MVP
// adaptive system (bk-z5t.13) can update it in the same space from real user
// signal (correct rate, rewatch counts). At ingestion we only have the prior.

// Normalization bounds per deterministic signal (typical range for Shorts).
export const BOUNDS = {
  wpm: { min: 100, max: 220 }, // slow vs fast speech
  rareWordRatio: { min: 0, max: 0.35 }, // share of words outside the top 5000
  avgSentenceLen: { min: 5, max: 25 }, // words per sentence
} as const;

// Weights sum to 1. The hybrid: ~40% computed features (fully reproducible),
// ~60% anchored 1-5 LLM rubric ratings (bk-z5t.16) — discrete + code-side
// weighting keeps the prior stable across runs.
export const WEIGHTS = {
  // deterministic
  wpm: 0.15,
  rareWordRatio: 0.15,
  avgSentenceLen: 0.1,
  // LLM rubric (1-5)
  idiomDensity: 0.2,
  syntaxComplexity: 0.15,
  abstractness: 0.15,
  clarity: 0.1, // inverse: clearer speech -> easier
} as const;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

function norm(value: number, min: number, max: number): number {
  return clamp01((value - min) / (max - min));
}

// 1-5 anchored rating -> [0,1].
const rating01 = (r: number) => clamp01((r - 1) / 4);

export type DifficultyInput = {
  readonly wpm: number;
  readonly rareWordRatio: number;
  readonly avgSentenceLen: number;
  readonly speechClarity: number; // 0-10 (higher = clearer)
  readonly idiomDensity: number; // 1-5
  readonly syntaxComplexity: number; // 1-5
  readonly abstractness: number; // 1-5
};

/** Continuous difficulty prior in [0, 1000]. Higher = harder for a learner. */
export function computeDifficultyPrior(input: DifficultyInput): number {
  const wpm = norm(input.wpm, BOUNDS.wpm.min, BOUNDS.wpm.max);
  const rare = norm(
    input.rareWordRatio,
    BOUNDS.rareWordRatio.min,
    BOUNDS.rareWordRatio.max,
  );
  const sentence = norm(
    input.avgSentenceLen,
    BOUNDS.avgSentenceLen.min,
    BOUNDS.avgSentenceLen.max,
  );
  // Clearer speech lowers difficulty.
  const clarity = clamp01((10 - input.speechClarity) / 10);

  const score =
    WEIGHTS.wpm * wpm +
    WEIGHTS.rareWordRatio * rare +
    WEIGHTS.avgSentenceLen * sentence +
    WEIGHTS.idiomDensity * rating01(input.idiomDensity) +
    WEIGHTS.syntaxComplexity * rating01(input.syntaxComplexity) +
    WEIGHTS.abstractness * rating01(input.abstractness) +
    WEIGHTS.clarity * clarity;

  return Math.round(clamp01(score) * 1000);
}

// --- stage runner ------------------------------------------------------------

export type DifficultyResult = {
  videoId: string;
  ok: boolean;
  prior?: number;
  error?: string;
};

export async function runDifficulty(opts: {
  limit: number;
  persist: boolean;
}): Promise<DifficultyResult[]> {
  const { db } = await import("@/db");
  const { ingestVideo, videoFeatures, videoClassification, videoDifficulty } =
    await import("@/db/ingest-schema");

  const rows = await db
    .select({
      id: ingestVideo.id,
      wpm: videoFeatures.wpm,
      rareWordRatio: videoFeatures.rareWordRatio,
      avgSentenceLen: videoFeatures.avgSentenceLen,
      speechClarity: videoClassification.speechClarity,
      idiomDensity: videoClassification.idiomDensity,
      syntaxComplexity: videoClassification.syntaxComplexity,
      abstractness: videoClassification.abstractness,
    })
    .from(ingestVideo)
    .innerJoin(videoFeatures, eq(videoFeatures.videoId, ingestVideo.id))
    .innerJoin(
      videoClassification,
      eq(videoClassification.videoId, ingestVideo.id),
    )
    .where(eq(ingestVideo.status, "classified"))
    .limit(opts.limit);

  const results: DifficultyResult[] = [];
  for (const row of rows) {
    try {
      const prior = computeDifficultyPrior({
        wpm: row.wpm,
        rareWordRatio: row.rareWordRatio,
        avgSentenceLen: row.avgSentenceLen,
        speechClarity: row.speechClarity,
        idiomDensity: row.idiomDensity,
        syntaxComplexity: row.syntaxComplexity,
        abstractness: row.abstractness,
      });

      if (opts.persist) {
        await db
          .insert(videoDifficulty)
          .values({ videoId: row.id, priorDifficulty: prior })
          .onConflictDoUpdate({
            target: videoDifficulty.videoId,
            set: { priorDifficulty: prior, updatedAt: new Date() },
          });
        // Passed all automated gates -> eligible for promotion.
        await db
          .update(ingestVideo)
          .set({ status: "approved", error: null, updatedAt: new Date() })
          .where(eq(ingestVideo.id, row.id));
      }

      results.push({ videoId: row.id, ok: true, prior });
    } catch (err) {
      results.push({ videoId: row.id, ok: false, error: (err as Error).message });
    }
  }

  return results;
}
