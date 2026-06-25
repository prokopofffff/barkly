import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type { Quiz, SubtitleToken as ZeroSubtitleToken } from "@barkly/zero";

// Ingestion ("content factory") schema — the YouTube Shorts scraping pipeline.
//
// These tables are SERVER-ONLY and deliberately kept OUT of the Zero sync: they
// are NOT imported by `zero:generate` (which reads only schema.ts), so raw
// candidates, transcripts and classification never leak to mobile clients. They
// ARE registered in drizzle.config.ts so they get migrated.
//
// Unlike the app schema (bigint epoch `created_at` set by the app to match Zero
// field names), these internal tables use native `timestamptz` with DB defaults
// — cleaner for a backend pipeline that never round-trips through Zero.
//
// The end product of the pipeline is a row in the app `video` table (see
// schema.ts), produced by the "promote" stage from an approved candidate.

// --- candidate lifecycle ------------------------------------------------------
// Drives a resumable state machine; the orchestrator advances rows stage by
// stage and can re-run idempotently from wherever a row stalled.
export type IngestStatus =
  | "discovered" // metadata harvested from YouTube (flat list only)
  | "prefiltered" // passed the cheap no-LLM filter; full metadata enriched
  | "prefiltered_out" // dropped by the cheap no-LLM filter
  | "downloaded" // video + subs pulled, transcoded, uploaded to Object Storage
  | "transcribed" // captions normalized into the transcript table
  | "featured" // deterministic language features computed
  | "classified" // LLM safety/topic/level pass done
  | "approved" // passed all gates — eligible for lesson generation
  | "quizzed" // lesson (subtitle tokens + quiz) generated — ready to promote
  | "rejected" // failed a safety/quality gate
  | "promoted" // copied into the app `video` table
  | "failed"; // a stage errored; see `error`

export type CaptionSource = "manual" | "auto" | "none";

// One normalized caption cue.
export type SubtitleSegment = {
  readonly start: number; // seconds
  readonly end: number; // seconds
  readonly text: string;
};

// --- allowlisted source channels ----------------------------------------------
export const ingestChannel = pgTable("ingest_channel", {
  id: text("id").primaryKey(), // YouTube channel id (UC...)
  title: text("title").notNull(),
  handle: text("handle"), // @handle, when known
  topic: text("topic").notNull(), // our content bucket (daily_life, travel, ...)
  language: text("language").notNull().default("en"),
  trust: integer("trust").notNull().default(1), // curator trust 0-3
  allowlisted: boolean("allowlisted").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// --- scraped candidates -------------------------------------------------------
export const ingestVideo = pgTable("ingest_video", {
  id: text("id").primaryKey(), // YouTube video id
  channelId: text("channel_id")
    .notNull()
    .references(() => ingestChannel.id),
  title: text("title").notNull().default(""),
  description: text("description").notNull().default(""),
  tags: jsonb("tags").$type<readonly string[]>().notNull().default([]),
  durationS: integer("duration_s"),
  isShort: boolean("is_short").notNull().default(false),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  stats: jsonb("stats")
    .$type<{
      views?: number;
      likes?: number;
      comments?: number;
      // Channel attribution captured from full video metadata (yt-dlp), used to
      // populate the creator profile on the promoted `video` row. Absent when
      // YouTube doesn't surface the follower count.
      channelFollowers?: number;
      channelVerified?: boolean;
    }>()
    .notNull()
    .default({}),

  status: text("status").$type<IngestStatus>().notNull().default("discovered"),
  rejectReason: text("reject_reason"),
  error: text("error"),

  captionSource: text("caption_source").$type<CaptionSource>(),
  langCode: text("lang_code"),

  // Object Storage keys (see lib/storage.ts mediaKeys); null until uploaded.
  rawKey: text("raw_key"),
  mp4Key: text("mp4_key"),
  posterKey: text("poster_key"),

  // Set once promoted into the app `video` table.
  promotedVideoId: text("promoted_video_id"),

  discoveredAt: timestamp("discovered_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// --- normalized transcript ----------------------------------------------------
export const transcript = pgTable("transcript", {
  videoId: text("video_id")
    .primaryKey()
    .references(() => ingestVideo.id),
  lang: text("lang").notNull().default("en"),
  source: text("source").$type<CaptionSource>().notNull(),
  text: text("text").notNull(), // plain concatenated transcript
  segments: jsonb("segments")
    .$type<readonly SubtitleSegment[]>()
    .notNull()
    .default([]),
  quality: real("quality").notNull().default(0), // 0-1 heuristic (punctuation, etc.)
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// --- deterministic language features (no LLM) ---------------------------------
export const videoFeatures = pgTable("video_features", {
  videoId: text("video_id")
    .primaryKey()
    .references(() => ingestVideo.id),
  wpm: real("wpm").notNull().default(0), // words per minute
  wordCount: integer("word_count").notNull().default(0),
  uniqueWords: integer("unique_words").notNull().default(0),
  ttr: real("ttr").notNull().default(0), // type-token ratio
  rareWordRatio: real("rare_word_ratio").notNull().default(0), // vs frequency list
  freqDistribution: jsonb("freq_distribution")
    .$type<Record<string, number>>()
    .notNull()
    .default({}),
  avgSentenceLen: real("avg_sentence_len").notNull().default(0),
  hasDialogue: boolean("has_dialogue").notNull().default(false),
  numSpeakersEst: integer("num_speakers_est").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// --- LLM classification -------------------------------------------------------
export const videoClassification = pgTable("video_classification", {
  videoId: text("video_id")
    .primaryKey()
    .references(() => ingestVideo.id),
  safe: boolean("safe").notNull().default(false),
  topic: text("topic").notNull().default(""),
  containsPolitics: boolean("contains_politics").notNull().default(false),
  containsWar: boolean("contains_war").notNull().default(false),
  containsSexual: boolean("contains_sexual").notNull().default(false),
  containsHate: boolean("contains_hate").notNull().default(false),
  containsProfanity: boolean("contains_profanity").notNull().default(false),
  profanityCount: integer("profanity_count").notNull().default(0),
  speechClarity: integer("speech_clarity").notNull().default(0), // 1-10
  learningScore: integer("learning_score").notNull().default(0), // 0-100
  englishLevel: text("english_level"), // coarse LLM hint (A1..C2), advisory only
  // Anchored 1-5 difficulty sub-ratings (bk-z5t.16/.17); feed the difficulty prior.
  idiomDensity: integer("idiom_density").notNull().default(1),
  slangDensity: integer("slang_density").notNull().default(1),
  syntaxComplexity: integer("syntax_complexity").notNull().default(1),
  abstractness: integer("abstractness").notNull().default(1),
  model: text("model").notNull().default(""),
  modelVersion: text("model_version").notNull().default(""),
  raw: jsonb("raw").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// --- difficulty ---------------------------------------------------------------
// `priorDifficulty` is computed at ingestion from the feature vector + LLM
// signals (continuous, ELO-like 0-1000 — NOT a CEFR label). The live columns
// are reserved for the post-MVP adaptive update (IRT/Elo) once real user traffic
// exists; nothing populates them until then.
export const videoDifficulty = pgTable("video_difficulty", {
  videoId: text("video_id")
    .primaryKey()
    .references(() => ingestVideo.id),
  priorDifficulty: real("prior_difficulty").notNull().default(0),
  liveDifficulty: real("live_difficulty"),
  numAttempts: integer("num_attempts").notNull().default(0),
  correctRate: real("correct_rate"),
  avgRepeats: real("avg_repeats"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// --- generated lesson (subtitle tokens + quiz) --------------------------------
// The LLM-authored learning payload (bk-z5t.15) the app feed needs. Produced for
// approved clips; consumed by the promote stage to build the synced `video` row.
export const videoLesson = pgTable("video_lesson", {
  videoId: text("video_id")
    .primaryKey()
    .references(() => ingestVideo.id),
  captionRu: text("caption_ru").notNull().default(""), // Russian one-line caption
  subtitle: jsonb("subtitle")
    .$type<readonly ZeroSubtitleToken[]>()
    .notNull()
    .default([]),
  quiz: jsonb("quiz").$type<Quiz>(), // one comprehension quiz (mc)
  model: text("model").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// --- relations ----------------------------------------------------------------
export const ingestChannelRelations = relations(ingestChannel, ({ many }) => ({
  videos: many(ingestVideo),
}));

export const ingestVideoRelations = relations(ingestVideo, ({ one }) => ({
  channel: one(ingestChannel, {
    fields: [ingestVideo.channelId],
    references: [ingestChannel.id],
  }),
  transcript: one(transcript, {
    fields: [ingestVideo.id],
    references: [transcript.videoId],
  }),
  features: one(videoFeatures, {
    fields: [ingestVideo.id],
    references: [videoFeatures.videoId],
  }),
  classification: one(videoClassification, {
    fields: [ingestVideo.id],
    references: [videoClassification.videoId],
  }),
  difficulty: one(videoDifficulty, {
    fields: [ingestVideo.id],
    references: [videoDifficulty.videoId],
  }),
  lesson: one(videoLesson, {
    fields: [ingestVideo.id],
    references: [videoLesson.videoId],
  }),
}));

export type IngestChannel = typeof ingestChannel.$inferSelect;
export type IngestVideo = typeof ingestVideo.$inferSelect;
export type Transcript = typeof transcript.$inferSelect;
export type VideoFeatures = typeof videoFeatures.$inferSelect;
export type VideoClassification = typeof videoClassification.$inferSelect;
export type VideoDifficulty = typeof videoDifficulty.$inferSelect;
export type VideoLesson = typeof videoLesson.$inferSelect;
