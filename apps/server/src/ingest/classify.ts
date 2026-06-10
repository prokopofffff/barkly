import { sleep } from "@/ingest/util";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { completeStructuredJson } from "@/ingest/llm";

// LLM classification (bk-z5t.9) — one Haiku call per clip over title + description
// + tags + transcript, with a forced JSON schema. This is the nuanced safety /
// topic / level judgement that the cheap pre-filter intentionally left to the
// model. Defense-in-depth: allowlist -> keyword denylist -> THIS -> sampled
// human review.
//
// Cost at scale: the system prompt is stable across all clips and is cached
// (cache_control), so only the per-clip transcript is billed at full input rate.

export const TOPICS = [
  "daily_life",
  "travel",
  "food",
  "shopping",
  "productivity",
  "technology",
  "study_tips",
  "street_interviews",
  "funny_conversations",
  "workplace_conversations",
  "relationship_conversations",
  "movies_tv",
  "english_learning",
  "other",
] as const;

export const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

// Validation schema for the model's response.
export const classificationSchema = z.object({
  safe: z.boolean(),
  topic: z.enum(TOPICS),
  contains_politics: z.boolean(),
  contains_war: z.boolean(),
  contains_sexual: z.boolean(),
  contains_hate: z.boolean(),
  contains_profanity: z.boolean(),
  profanity_count: z.number().int().min(0),
  english_level: z.enum(LEVELS),
  speech_clarity: z.number().int().min(0).max(10),
  learning_score: z.number().int().min(0).max(100),
  has_dialogue: z.boolean(),
  // Anchored 1-5 difficulty sub-ratings (bk-z5t.16/.17).
  idiom_density: z.number().int().min(1).max(5),
  slang_density: z.number().int().min(1).max(5),
  syntax_complexity: z.number().int().min(1).max(5),
  abstractness: z.number().int().min(1).max(5),
});

export type Classification = z.infer<typeof classificationSchema>;

// The JSON Schema handed to the API to constrain the output. Kept in lockstep
// with classificationSchema above (asserted in tests). Structured outputs
// require every property listed in `required` and `additionalProperties: false`.
export const CLASSIFICATION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    safe: { type: "boolean" },
    topic: { type: "string", enum: [...TOPICS] },
    contains_politics: { type: "boolean" },
    contains_war: { type: "boolean" },
    contains_sexual: { type: "boolean" },
    contains_hate: { type: "boolean" },
    contains_profanity: { type: "boolean" },
    profanity_count: { type: "integer" },
    english_level: { type: "string", enum: [...LEVELS] },
    speech_clarity: { type: "integer" },
    learning_score: { type: "integer" },
    has_dialogue: { type: "boolean" },
    idiom_density: { type: "integer" },
    slang_density: { type: "integer" },
    syntax_complexity: { type: "integer" },
    abstractness: { type: "integer" },
  },
  required: [
    "safe",
    "topic",
    "contains_politics",
    "contains_war",
    "contains_sexual",
    "contains_hate",
    "contains_profanity",
    "profanity_count",
    "english_level",
    "speech_clarity",
    "learning_score",
    "has_dialogue",
    "idiom_density",
    "slang_density",
    "syntax_complexity",
    "abstractness",
  ],
} as const;

export const SYSTEM_PROMPT = `You classify short English-language video clips for a language-learning app that teaches English to non-native speakers. You are given a clip's title, description, tags, and transcript. Return ONLY the structured JSON object.

SAFETY — set "safe": false (and the matching flag) if the clip contains any of:
- politics, elections, or socio-political debate -> contains_politics
- war, armed conflict, or military action -> contains_war
- explicit sexual content -> contains_sexual
- hate speech, slurs, extremism, or religious agitation -> contains_hate
Also count profane/obscene words in the transcript in "profanity_count" and set "contains_profanity" accordingly. When genuinely uncertain whether something is unsafe, prefer "safe": false. Educational or biological mentions (e.g. animal mating in a nature clip) are NOT sexual content.

CLASSIFICATION:
- "topic": the single best fit from the allowed list; use "other" if none fit.
- "english_level": CEFR difficulty of the English used (A1 easiest … C2 hardest) — judge vocabulary, idioms, and speed.
- "speech_clarity": 0–10, how clear and well-articulated the speech is for a learner (accent, pace, audio).
- "learning_score": 0–100, overall usefulness of this clip for an English learner (clear, natural, useful everyday language scores high; unsafe/noisy/incoherent scores low).
- "has_dialogue": true if two or more people converse (vs a single narrator/monologue).

DIFFICULTY — rate each 1–5 using these exact anchors (be strict and consistent; judge ONLY from the transcript):
- "idiom_density" (phrasal verbs and idioms only — NOT slang): 1 = fully literal, none; 2 = one common phrasal verb; 3 = several phrasal verbs or a common idiom; 4 = frequent idioms/phrasal verbs; 5 = dense idiomatic, hard to read literally.
- "slang_density" (informal/colloquial/slang words: "gonna", "kinda", "dude", "lit", "y'all", etc.): 1 = standard/neutral or formal English; 2 = one casual word; 3 = several casual/colloquial words; 4 = frequent slang; 5 = heavy slang / very informal, hard for a textbook learner.
- "syntax_complexity": 1 = short simple sentences; 2 = mostly simple, some compound; 3 = mix of compound and complex; 4 = long sentences with subordinate clauses; 5 = very long sentences with multiple embedded clauses.
- "abstractness": 1 = concrete everyday objects/actions; 2 = mostly concrete; 3 = mix of concrete and abstract; 4 = largely abstract/conceptual; 5 = highly abstract, technical, or philosophical.`;

export type ClassifyInput = {
  readonly title: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly transcript: string;
};

export function buildUserContent(input: ClassifyInput): string {
  const tags = input.tags.length > 0 ? input.tags.join(", ") : "(none)";
  return [
    `TITLE: ${input.title}`,
    `DESCRIPTION: ${input.description || "(none)"}`,
    `TAGS: ${tags}`,
    `TRANSCRIPT:\n${input.transcript}`,
  ].join("\n\n");
}

export type ClassifyOutput = {
  classification: Classification;
  model: string;
};

export async function classifyOne(
  input: ClassifyInput,
): Promise<ClassifyOutput> {
  const { text, model } = await completeStructuredJson({
    system: SYSTEM_PROMPT,
    user: buildUserContent(input),
    schema: CLASSIFICATION_JSON_SCHEMA,
    maxTokens: 512,
  });
  const classification = classificationSchema.parse(JSON.parse(text));
  return { classification, model };
}

// --- safety gate -------------------------------------------------------------

// Reject if profanity meets/exceeds this count (configurable threshold).
export const PROFANITY_THRESHOLD = 3;

/** Returns a reject reason if the clip fails any safety gate, else null. */
export function rejectReason(c: Classification): string | null {
  if (!c.safe) return "unsafe";
  if (c.contains_politics) return "politics";
  if (c.contains_war) return "war";
  if (c.contains_sexual) return "sexual";
  if (c.contains_hate) return "hate";
  if (c.contains_profanity && c.profanity_count >= PROFANITY_THRESHOLD) {
    return `profanity:${c.profanity_count}`;
  }
  return null;
}

// --- stage runner ------------------------------------------------------------

export type ClassifyResult = {
  videoId: string;
  ok: boolean;
  rejected?: string;
  topic?: string;
  level?: string;
  score?: number;
  error?: string;
};

export async function runClassify(opts: {
  limit: number;
  delayMs: number;
  persist: boolean;
}): Promise<ClassifyResult[]> {
  const { db } = await import("@/db");
  const { ingestVideo, transcript, videoClassification } = await import(
    "@/db/ingest-schema"
  );

  const rows = await db
    .select({
      id: ingestVideo.id,
      title: ingestVideo.title,
      description: ingestVideo.description,
      tags: ingestVideo.tags,
      text: transcript.text,
    })
    .from(ingestVideo)
    .innerJoin(transcript, eq(transcript.videoId, ingestVideo.id))
    .where(eq(ingestVideo.status, "featured"))
    .limit(opts.limit);

  const results: ClassifyResult[] = [];

  for (const row of rows) {
    try {
      const { classification: c, model } = await classifyOne({
        title: row.title,
        description: row.description,
        tags: row.tags,
        transcript: row.text,
      });
      const reject = rejectReason(c);

      if (opts.persist) {
        const values = {
          videoId: row.id,
          safe: c.safe,
          topic: c.topic,
          containsPolitics: c.contains_politics,
          containsWar: c.contains_war,
          containsSexual: c.contains_sexual,
          containsHate: c.contains_hate,
          containsProfanity: c.contains_profanity,
          profanityCount: c.profanity_count,
          speechClarity: c.speech_clarity,
          learningScore: c.learning_score,
          englishLevel: c.english_level,
          idiomDensity: c.idiom_density,
          slangDensity: c.slang_density,
          syntaxComplexity: c.syntax_complexity,
          abstractness: c.abstractness,
          model,
          modelVersion: model,
          raw: c,
        };
        await db
          .insert(videoClassification)
          .values(values)
          .onConflictDoUpdate({
            target: videoClassification.videoId,
            set: values,
          });
        await db
          .update(ingestVideo)
          .set({
            status: reject ? "rejected" : "classified",
            rejectReason: reject,
            error: null,
            updatedAt: new Date(),
          })
          .where(eq(ingestVideo.id, row.id));
      }

      results.push({
        videoId: row.id,
        ok: true,
        rejected: reject ?? undefined,
        topic: c.topic,
        level: c.english_level,
        score: c.learning_score,
      });
    } catch (err) {
      const message = (err as Error).message;
      if (opts.persist) {
        await db
          .update(ingestVideo)
          .set({ status: "failed", error: message, updatedAt: new Date() })
          .where(eq(ingestVideo.id, row.id));
      }
      results.push({ videoId: row.id, ok: false, error: message });
    }
    if (opts.delayMs > 0) await sleep(opts.delayMs);
  }

  return results;
}
