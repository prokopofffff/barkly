import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Quiz, SubtitleToken } from "@barkly/zero";
import { anthropicClient } from "@/ingest/anthropic";
import { config } from "@/lib/config";

// Lesson generation (bk-z5t.15, variant B): turn an approved clip's transcript
// into the app's learning payload — a Russian caption, a tokenized English
// subtitle line with key vocabulary translated to RU, and one comprehension
// quiz. One Haiku call per clip with a forced JSON schema; the stable system
// prompt is cached. The promote stage (bk-z5t.12) copies this into the synced
// `video` row.

// Raw model output: every property required (structured-output friendly).
const rawTokenSchema = z.object({
  w: z.string(),
  t: z.string(), // "" when not translated
  key: z.boolean(),
});

const rawQuizSchema = z.object({
  type: z.literal("mc"),
  prompt: z.string(),
  options: z.array(z.string()).min(2),
  answer: z.number().int().min(0),
  explain: z.string(),
  xp: z.number().int().min(0),
});

export const lessonSchema = z.object({
  caption_ru: z.string(),
  subtitle: z.array(rawTokenSchema).min(1),
  quiz: rawQuizSchema,
});

export type RawLesson = z.infer<typeof lessonSchema>;

export const LESSON_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    caption_ru: { type: "string" },
    subtitle: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          w: { type: "string" },
          t: { type: "string" },
          key: { type: "boolean" },
        },
        required: ["w", "t", "key"],
      },
    },
    quiz: {
      type: "object",
      additionalProperties: false,
      properties: {
        type: { type: "string", enum: ["mc"] },
        prompt: { type: "string" },
        options: { type: "array", items: { type: "string" } },
        answer: { type: "integer" },
        explain: { type: "string" },
        xp: { type: "integer" },
      },
      required: ["type", "prompt", "options", "answer", "explain", "xp"],
    },
  },
  required: ["caption_ru", "subtitle", "quiz"],
} as const;

export const LESSON_SYSTEM_PROMPT = `You build a micro-lesson for RUSSIAN speakers learning English from a short English clip's transcript. Return ONLY the JSON object. All natural-language output except the English subtitle words must be in Russian.

- caption_ru: one short Russian line (≤ 60 chars) describing what's useful to learn here; one emoji is fine.
- subtitle: pick ONE short, natural, self-contained English line from the transcript (about 4–12 words). Split it into word tokens IN ORDER, one token per word ("w"). For 2–4 genuinely useful vocabulary words (phrasal verbs, idioms, less-common words) set "key": true and "t" to a concise Russian translation. For every other token set "key": false and "t": "". Keep the original words and order exactly.
- quiz: ONE multiple-choice question in Russian testing comprehension or a key word from the clip. Provide exactly 4 plausible "options" (Russian), "answer" = the 0-based index of the correct one, a short Russian "explain", and "xp" between 20 and 40.`;

// --- normalization -----------------------------------------------------------

/** Raw tokens -> the app's SubtitleToken[] (drop empty translations, keep
 * `key` only when true and actually translated). */
export function toSubtitleTokens(raw: RawLesson["subtitle"]): SubtitleToken[] {
  return raw.map((r) => {
    const token: SubtitleToken = { w: r.w };
    if (r.t) token.t = r.t;
    if (r.key && r.t) token.key = true;
    return token;
  });
}

/** Raw quiz -> the app's Quiz (clamp the answer index into range). */
export function toQuiz(raw: RawLesson["quiz"]): Quiz {
  const answer = Math.min(Math.max(raw.answer, 0), raw.options.length - 1);
  return {
    type: "mc",
    prompt: raw.prompt,
    options: raw.options,
    answer,
    xp: raw.xp,
    explain: raw.explain,
  };
}

export type Lesson = {
  captionRu: string;
  subtitle: SubtitleToken[];
  quiz: Quiz;
  model: string;
};

export type LessonInput = {
  readonly title: string;
  readonly topic: string;
  readonly transcript: string;
};

export function buildLessonUserContent(input: LessonInput): string {
  return [
    `TITLE: ${input.title}`,
    `TOPIC: ${input.topic}`,
    `TRANSCRIPT:\n${input.transcript}`,
  ].join("\n\n");
}

export async function generateLesson(input: LessonInput): Promise<Lesson> {
  const message = await anthropicClient().messages.create({
    model: config.ANTHROPIC_MODEL,
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text: LESSON_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: buildLessonUserContent(input) }],
    output_config: {
      format: { type: "json_schema", schema: LESSON_JSON_SCHEMA },
    },
  });

  const text = message.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("lesson generator returned no text block");
  const raw = lessonSchema.parse(JSON.parse(text));
  return {
    captionRu: raw.caption_ru,
    subtitle: toSubtitleTokens(raw.subtitle),
    quiz: toQuiz(raw.quiz),
    model: message.model,
  };
}

// --- stage runner ------------------------------------------------------------

export type LessonResult = {
  videoId: string;
  ok: boolean;
  words?: number;
  error?: string;
};

export async function runLesson(opts: {
  limit: number;
  delayMs: number;
  persist: boolean;
}): Promise<LessonResult[]> {
  const { db } = await import("@/db");
  const { ingestVideo, transcript, videoClassification, videoLesson } =
    await import("@/db/ingest-schema");

  const rows = await db
    .select({
      id: ingestVideo.id,
      title: ingestVideo.title,
      topic: videoClassification.topic,
      text: transcript.text,
    })
    .from(ingestVideo)
    .innerJoin(transcript, eq(transcript.videoId, ingestVideo.id))
    .innerJoin(
      videoClassification,
      eq(videoClassification.videoId, ingestVideo.id),
    )
    .where(eq(ingestVideo.status, "approved"))
    .limit(opts.limit);

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const results: LessonResult[] = [];

  for (const row of rows) {
    try {
      const lesson = await generateLesson({
        title: row.title,
        topic: row.topic,
        transcript: row.text,
      });

      if (opts.persist) {
        await db
          .insert(videoLesson)
          .values({
            videoId: row.id,
            captionRu: lesson.captionRu,
            subtitle: lesson.subtitle,
            quiz: lesson.quiz,
            model: lesson.model,
          })
          .onConflictDoUpdate({
            target: videoLesson.videoId,
            set: {
              captionRu: lesson.captionRu,
              subtitle: lesson.subtitle,
              quiz: lesson.quiz,
              model: lesson.model,
            },
          });
        await db
          .update(ingestVideo)
          .set({ status: "quizzed", error: null, updatedAt: new Date() })
          .where(eq(ingestVideo.id, row.id));
      }

      results.push({ videoId: row.id, ok: true, words: lesson.subtitle.length });
    } catch (err) {
      results.push({ videoId: row.id, ok: false, error: (err as Error).message });
    }
    if (opts.delayMs > 0) await sleep(opts.delayMs);
  }

  return results;
}
