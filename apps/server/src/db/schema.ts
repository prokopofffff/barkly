import { relations } from "drizzle-orm";
import { bigint, boolean, integer, jsonb, pgTable, text } from "drizzle-orm/pg-core";
import type { GradientName, Quiz, SubtitleToken } from "@barkly/zero";

// Postgres schema — the SINGLE source of truth. The Zero schema
// (packages/zero/src/schema.gen.ts) is generated from this via drizzle-zero
// (`bun run zero:generate`); never edit the generated file by hand.
//
// Drizzle property names are camelCase to match the Zero field names the mobile
// app expects; the SQL column/table names are snake_case.

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  handle: text("handle").notNull(),
  name: text("name").notNull(),
  isAnonymous: boolean("is_anonymous").notNull().default(true),
  email: text("email"), // set when an email identity is linked; null otherwise
  // Content-submission role (bk-jaz.9.1). "basic" = learner (default), "curator"
  // = vetted user who may submit YouTube Shorts, "admin" = team. Synced so the
  // mobile UI can show the curator submission UI vs the "be our curator" button
  // live (no re-login after a grant). Authoritative grants go through /admin/role.
  role: text("role").$type<"admin" | "curator" | "basic">().notNull().default("basic"),
  nativeLang: text("native_lang").notNull().default("ru"),
  learningLang: text("learning_lang").notNull().default("en"),
  // Onboarding answers (collected before the feed; synced so they carry across
  // devices once linked). `goals` is jsonb — Zero models arrays as json.
  learningLevel: text("learning_level").notNull().default(""), // onboarding self-assessment key -> seeds elo
  goals: jsonb("goals").$type<readonly string[]>().notNull().default([]),
  dailyTarget: integer("daily_target").notNull().default(0), // minutes/day goal
  // Adaptive difficulty (bk-z5t.18): internal ELO on the same 0-1000+ scale as
  // video.difficulty. Seeded from onboarding; moves with quiz performance.
  elo: integer("elo").notNull().default(500),
  eloGames: integer("elo_games").notNull().default(0), // answers counted (provisional ramp)
  level: integer("level").notNull().default(1),
  levelName: text("level_name").notNull().default(""),
  xp: integer("xp").notNull().default(0),
  xpToday: integer("xp_today").notNull().default(0),
  xpToNext: integer("xp_to_next").notNull().default(1000),
  gems: integer("gems").notNull().default(0),
  streak: integer("streak").notNull().default(0),
  league: text("league").notNull().default(""),
  leagueRank: integer("league_rank").notNull().default(0),
  mascotCosmetic: text("mascot_cosmetic").notNull().default(""),
  onboarded: boolean("onboarded").notNull().default(false),
  // Set when this row was folded into another on identity link (account merge,
  // BACKEND_PLAN §6). A tombstone: the row is kept for idempotent re-links.
  mergedInto: text("merged_into"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const video = pgTable("video", {
  id: text("id").primaryKey(),
  category: text("category").notNull(),
  catEn: text("cat_en").notNull(),
  creatorName: text("creator_name").notNull(),
  creatorHandle: text("creator_handle").notNull(),
  creatorGradient: text("creator_gradient").$type<GradientName>().notNull(),
  creatorFollowers: text("creator_followers").notNull(),
  creatorVerified: boolean("creator_verified").notNull(),
  creatorMascot: boolean("creator_mascot").notNull().default(false),
  bgGradient: jsonb("bg_gradient").$type<readonly [string, string]>().notNull(),
  caption: text("caption").notNull(),
  likes: text("likes").notNull(),
  comments: text("comments").notNull(),
  shares: text("shares").notNull(),
  tag: text("tag").notNull(),
  subtitle: jsonb("subtitle").$type<readonly SubtitleToken[]>().notNull(),
  quiz: jsonb("quiz").$type<Quiz>().notNull(),
  hlsUrl: text("hls_url").notNull(),
  // Set for clips played via the YouTube IFrame embed (the ingestion pipeline's
  // output); null for self-hosted/HLS clips. The mobile feed embeds by this id.
  youtubeId: text("youtube_id"),
  langCode: text("lang_code").notNull(),
  level: text("level").notNull(),
  // Difficulty on the ELO scale (0-1000), synced from the ingestion prior.
  // Feeds adaptive matchmaking (user.elo ± window). bk-z5t.18.
  difficulty: integer("difficulty").notNull().default(0),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const vocabulary = pgTable("vocabulary", {
  id: text("id").primaryKey(), // `${userID}:${en}`
  userID: text("user_id").notNull(),
  en: text("en").notNull(),
  ru: text("ru").notNull(),
  type: text("type").$type<"word" | "phrase">().notNull(),
  source: text("source").notNull(),
  example: text("example").notNull(),
  mastery: integer("mastery").notNull().default(0),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const leagueMember = pgTable("league_member", {
  id: text("id").primaryKey(),
  leagueId: text("league_id").notNull(),
  userID: text("user_id").notNull(),
  name: text("name").notNull(),
  gradient: text("gradient").$type<GradientName>().notNull(),
  xp: integer("xp").notNull().default(0),
  streak: integer("streak").notNull().default(0),
});

export const achievement = pgTable("achievement", {
  id: text("id").primaryKey(),
  userID: text("user_id").notNull(),
  icon: text("icon").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  done: boolean("done").notNull().default(false),
  color: text("color").notNull(),
  pct: integer("pct").notNull().default(0),
  sort: integer("sort").notNull().default(0),
});

export const cosmetic = pgTable("cosmetic", {
  id: text("id").primaryKey(), // `${userID}:${cosmeticId}`
  userID: text("user_id").notNull(),
  name: text("name").notNull(),
  rarity: text("rarity").notNull(),
  cost: integer("cost").notNull().default(0),
  color: text("color").notNull(),
  owned: boolean("owned").notNull().default(false),
  sort: integer("sort").notNull().default(0),
});

export const notification = pgTable("notification", {
  id: text("id").primaryKey(),
  userID: text("user_id").notNull(),
  kind: text("kind").$type<"streak" | "friend" | "xp" | "reward">().notNull(),
  title: text("title").notNull(),
  text: text("text").notNull(),
  time: text("time").notNull(),
  accent: text("accent").notNull(),
  read: boolean("read").notNull().default(false),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const like = pgTable("like", {
  id: text("id").primaryKey(), // `${userID}:${videoID}`
  userID: text("user_id").notNull(),
  videoID: text("video_id").notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const follow = pgTable("follow", {
  id: text("id").primaryKey(), // `${userID}:${creatorHandle}`
  userID: text("user_id").notNull(),
  creatorHandle: text("creator_handle").notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const progress = pgTable("progress", {
  id: text("id").primaryKey(),
  userID: text("user_id").notNull(),
  videoID: text("video_id").notNull(),
  watchedMs: integer("watched_ms").notNull().default(0),
  completed: boolean("completed").notNull().default(false),
  score: integer("score").notNull().default(0),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

// --- relations (drizzle-zero turns these into Zero relationships) ------------
export const userRelations = relations(user, ({ many }) => ({
  vocabulary: many(vocabulary),
  achievements: many(achievement),
  cosmetics: many(cosmetic),
  notifications: many(notification),
  progress: many(progress),
}));

export const videoRelations = relations(video, ({ many }) => ({
  progress: many(progress),
  // "likes" the column is the count; the rows relation is named distinctly.
  likeRows: many(like),
}));

export const vocabularyRelations = relations(vocabulary, ({ one }) => ({
  user: one(user, { fields: [vocabulary.userID], references: [user.id] }),
}));

export const progressRelations = relations(progress, ({ one }) => ({
  user: one(user, { fields: [progress.userID], references: [user.id] }),
  video: one(video, { fields: [progress.videoID], references: [video.id] }),
}));

export const likeRelations = relations(like, ({ one }) => ({
  video: one(video, { fields: [like.videoID], references: [video.id] }),
}));

export const achievementRelations = relations(achievement, ({ one }) => ({
  user: one(user, { fields: [achievement.userID], references: [user.id] }),
}));

export const cosmeticRelations = relations(cosmetic, ({ one }) => ({
  user: one(user, { fields: [cosmetic.userID], references: [user.id] }),
}));

export const notificationRelations = relations(notification, ({ one }) => ({
  user: one(user, { fields: [notification.userID], references: [user.id] }),
}));

export type User = typeof user.$inferSelect;
