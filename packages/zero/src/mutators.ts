import type { CustomMutatorDefs, Transaction } from '@rocicorp/zero';

import type { Schema } from './schema';

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

/** New gamification totals after an action (client-optimistic; server recomputes). */
type EarnArgs = { userID: string; xp: number; xpToday: number; gems: number; streak: number };

export type AppMutators = ReturnType<typeof createMutators>;

export function createMutators() {
  return {
    /** Award XP/gems (e.g. liking, saving a word). */
    async earnXp(tx: Tx, a: EarnArgs) {
      await tx.mutate.user.update({ id: a.userID, xp: a.xp, xpToday: a.xpToday, gems: a.gems, streak: a.streak });
    },

    /** Record a quiz result and award its XP. */
    async completeQuiz(
      tx: Tx,
      a: EarnArgs & { progressID: string; videoID: string; correct: boolean; score: number },
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

    /** Persist onboarding choices and the starter XP bonus. */
    async completeOnboarding(
      tx: Tx,
      a: { userID: string; learningLang: string; xp: number; xpToday: number; gems: number },
    ) {
      await tx.mutate.user.update({
        id: a.userID,
        learningLang: a.learningLang,
        onboarded: true,
        xp: a.xp,
        xpToday: a.xpToday,
        gems: a.gems,
      });
    },
  } satisfies CustomMutatorDefs;
}

/** Stable mutator set handed to ZeroProvider (server identity comes from the JWT). */
export const mutators = createMutators();
