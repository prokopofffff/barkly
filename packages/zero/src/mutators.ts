import type { CustomMutatorDefs, Transaction } from '@rocicorp/zero';

import type { Schema } from './schema';
import type { GradientName } from './types';

/**
 * Zero custom mutators — the ONLY write path (reads via queries, writes via
 * mutators). Each function runs twice from this one shared definition:
 *
 *  1. Optimistically on the mobile client, against the local replica.
 *  2. Authoritatively on the server (apps/server/src/zero/push.ts re-runs them
 *     inside a Postgres transaction via Zero's PushProcessor).
 *
 * The bodies use only `tx.mutate`, so the identical code is valid on both the
 * client and server transaction types. The client passes already-computed
 * values (new XP totals, mastery, …); the authoritative server SHOULD override
 * the economy mutators to recompute those from its own state (anti-cheat) —
 * see apps/server/docs/BACKEND_PLAN.md §5.
 */

type Tx = Transaction<Schema>;

/**
 * Starter XP granted once for finishing onboarding. Shared so the client awards
 * it, and the server EXCLUDES it when merging accounts on identity link
 * (BACKEND_PLAN §6) — otherwise farming onboarding bonuses across throwaway
 * anonymous devices would inflate the merged total.
 */
export const ONBOARDING_BONUS_XP = 50;

/** New gamification totals after an action (client-optimistic; server recomputes). */
type EarnArgs = { userID: string; xp: number; xpToday: number; gems: number; streak: number };

export type AppMutators = ReturnType<typeof createMutators>;

export function createMutators() {
  return {
    /**
     * Award XP/gems (e.g. liking, saving a word). The client writes its
     * optimistic totals (xp/xpToday/gems); the authoritative server ignores
     * them and recomputes from `amount` + current DB state (anti-cheat, §5).
     */
    async earnXp(tx: Tx, a: EarnArgs & { amount: number }) {
      await tx.mutate.user.update({ id: a.userID, xp: a.xp, xpToday: a.xpToday, gems: a.gems, streak: a.streak });
    },

    /**
     * Record a quiz result and award its XP. The client sends its optimistic
     * `correct`/`score`; the server re-grades `selected` against the stored
     * `video.quiz.answer` and awards XP from that (core anti-cheat path, §5).
     */
    async completeQuiz(
      tx: Tx,
      a: EarnArgs & {
        progressID: string;
        videoID: string;
        correct: boolean;
        score: number;
        /** The learner's chosen answer (index, or word order for reorder). */
        selected: number | readonly string[];
      },
    ) {
      await tx.mutate.progress.upsert({
        id: a.progressID,
        userID: a.userID,
        videoID: a.videoID,
        watchedMs: 0,
        completed: true,
        score: a.score,
        updatedAt: Date.now(),
      });
      await tx.mutate.user.update({ id: a.userID, xp: a.xp, xpToday: a.xpToday, gems: a.gems, streak: a.streak });
    },

    /** Like / unlike a clip. */
    async toggleLike(tx: Tx, a: { userID: string; videoID: string; liked: boolean }) {
      const id = `${a.userID}:${a.videoID}`;
      if (a.liked) {
        await tx.mutate.like.upsert({ id, userID: a.userID, videoID: a.videoID, createdAt: Date.now() });
      } else {
        await tx.mutate.like.delete({ id });
      }
    },

    /**
     * Post an in-app comment on a clip. App-native (NOT from YouTube). The id is
     * a composite key so the same body is idempotent across client + server, and
     * `likes` starts at 0. `name`/`gradient` are denormalised from the author so
     * the sheet renders an avatar without a join.
     */
    async postComment(
      tx: Tx,
      a: { id: string; videoID: string; userID: string; name: string; gradient: GradientName; text: string },
    ) {
      await tx.mutate.comment.insert({
        id: a.id,
        videoID: a.videoID,
        userID: a.userID,
        name: a.name,
        gradient: a.gradient,
        text: a.text,
        likes: 0,
        createdAt: Date.now(),
      });
    },

    /** Follow a creator. */
    async followCreator(tx: Tx, a: { userID: string; creatorHandle: string }) {
      const id = `${a.userID}:${a.creatorHandle}`;
      await tx.mutate.follow.upsert({ id, userID: a.userID, creatorHandle: a.creatorHandle, createdAt: Date.now() });
    },

    /** Save a tapped subtitle word to the vocabulary. */
    async saveWord(
      tx: Tx,
      a: { userID: string; en: string; ru: string; type: 'word' | 'phrase'; source: string; example: string },
    ) {
      await tx.mutate.vocabulary.upsert({
        id: `${a.userID}:${a.en}`,
        userID: a.userID,
        en: a.en,
        ru: a.ru,
        type: a.type,
        source: a.source,
        example: a.example,
        mastery: 0,
        createdAt: Date.now(),
      });
    },

    /** Bump a word's mastery after a flashcard review (XP comes via earnXp). */
    async reviewWord(tx: Tx, a: { userID: string; en: string; mastery: number }) {
      await tx.mutate.vocabulary.update({ id: `${a.userID}:${a.en}`, mastery: a.mastery });
    },

    /** Equip a mascot cosmetic (or '' for none). */
    async equipCosmetic(tx: Tx, a: { userID: string; cosmeticId: string }) {
      await tx.mutate.user.update({ id: a.userID, mascotCosmetic: a.cosmeticId });
    },

    /** Claim a reward from the daily chest: grant the cosmetic + gems. */
    async claimReward(tx: Tx, a: { userID: string; cosmeticId: string; gems: number }) {
      await tx.mutate.cosmetic.update({ id: `${a.userID}:${a.cosmeticId}`, owned: true });
      await tx.mutate.user.update({ id: a.userID, gems: a.gems, mascotCosmetic: a.cosmeticId });
    },

    /**
     * Persist onboarding answers and flip `onboarded`. The starter XP bonus is
     * awarded separately via `earnXp` (so the merge logic can exclude it), so
     * this mutator intentionally does NOT touch xp/gems.
     */
    async completeOnboarding(
      tx: Tx,
      a: {
        userID: string;
        learningLang: string;
        learningLevel: string;
        goals: readonly string[];
        dailyTarget: number;
      },
    ) {
      await tx.mutate.user.update({
        id: a.userID,
        learningLang: a.learningLang,
        learningLevel: a.learningLevel,
        goals: a.goals,
        dailyTarget: a.dailyTarget,
        onboarded: true,
      });
    },
  } satisfies CustomMutatorDefs;
}

/** Stable mutator set handed to ZeroProvider (server identity comes from the JWT). */
export const mutators = createMutators();
