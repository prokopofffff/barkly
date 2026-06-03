import {
  createSchema,
  table,
  string,
  number,
  boolean,
  relationships,
} from '@rocicorp/zero';

/**
 * Zero schema for Barkly — a TikTok-style language-learning app.
 *
 * This must mirror the Postgres schema that `zero-cache` replicates from.
 * Reads sync automatically; writes go through custom mutators implemented
 * by the Go backend (see src/lib/zero/mutators.ts).
 */

const user = table('user')
  .columns({
    id: string(),
    handle: string(),
    isAnonymous: boolean(),
    nativeLang: string(), // e.g. "en"
    learningLang: string(), // e.g. "es"
    xp: number(),
    streak: number(),
    createdAt: number(), // epoch millis
  })
  .primaryKey('id');

const video = table('video')
  .columns({
    id: string(),
    langCode: string(), // language being taught in this clip
    level: string(), // "a1" | "a2" | "b1" ...
    title: string(),
    phrase: string(), // the phrase/sentence being taught
    translation: string(),
    hlsUrl: string(), // adaptive-stream URL (CDN/Mux/self-hosted) — NOT synced media, just the pointer
    thumbUrl: string(),
    durationMs: number(),
    createdAt: number(),
  })
  .primaryKey('id');

const progress = table('progress')
  .columns({
    id: string(),
    userID: string(),
    videoID: string(),
    watchedMs: number(),
    completed: boolean(),
    score: number(), // result of the inline exercise, 0..100
    updatedAt: number(),
  })
  .primaryKey('id');

const like = table('like')
  .columns({
    id: string(),
    userID: string(),
    videoID: string(),
    createdAt: number(),
  })
  .primaryKey('id');

const progressRelationships = relationships(progress, ({ one }) => ({
  user: one({ sourceField: ['userID'], destField: ['id'], destSchema: user }),
  video: one({ sourceField: ['videoID'], destField: ['id'], destSchema: video }),
}));

const videoRelationships = relationships(video, ({ many }) => ({
  progress: many({ sourceField: ['id'], destField: ['videoID'], destSchema: progress }),
  likes: many({ sourceField: ['id'], destField: ['videoID'], destSchema: like }),
}));

export const schema = createSchema({
  tables: [user, video, progress, like],
  relationships: [progressRelationships, videoRelationships],
  // Enables the `z.query.<table>` builder used in src/lib/zero/queries.ts.
  // (Zero 1.5+ also offers "synced queries" as the modern alternative.)
  enableLegacyQueries: true,
});

export type Schema = typeof schema;

declare module '@rocicorp/zero' {
  interface DefaultTypes {
    schema: Schema;
  }
}
