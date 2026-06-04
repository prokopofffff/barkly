import { and, eq } from "drizzle-orm";
import { ONBOARDING_BONUS_XP } from "@barkly/zero";
import { db } from "@/db";
import * as s from "@/db/schema";

// Account merge on identity link (BACKEND_PLAN §6). When a person links an
// identity that already belongs to account A while signed in anonymously as B,
// we fold B into the canonical A in ONE transaction and tombstone B.
//
// Server-authoritative: every value is recomputed here, never trusted from a
// client. Starter onboarding bonuses are excluded from the XP/gems sum so a
// learner can't farm them across throwaway anonymous devices.

/** A drizzle transaction handle (same query API as `db`). */
type Tx = Parameters<Parameters<(typeof db)["transaction"]>[0]>[0];

const STARTER_GEMS = Math.floor(ONBOARDING_BONUS_XP / 2); // gems = floor(xp/2)

/** XP/gems a user actually earned, i.e. excluding the one-time onboarding grant. */
function earned(u: { xp: number; gems: number; onboarded: boolean }) {
  return {
    xp: Math.max(0, u.xp - (u.onboarded ? ONBOARDING_BONUS_XP : 0)),
    gems: Math.max(0, u.gems - (u.onboarded ? STARTER_GEMS : 0)),
  };
}

/** Suffix after the `${userID}:` prefix of an id-namespaced child row. */
function suffix(id: string, userID: string): string {
  return id.startsWith(`${userID}:`) ? id.slice(userID.length + 1) : id;
}

/**
 * Fold anonymous user `fromID` into canonical `toID`. Runs inside the caller's
 * transaction so identity binding + merge commit atomically. Idempotent: a
 * second call is a no-op once `fromID` is tombstoned.
 */
export async function mergeAccounts(tx: Tx, fromID: string, toID: string): Promise<void> {
  if (fromID === toID) return;

  const [a] = await tx.select().from(s.user).where(eq(s.user.id, toID));
  const [b] = await tx.select().from(s.user).where(eq(s.user.id, fromID));
  if (!a || !b || b.mergedInto) return; // already merged / missing

  // --- vocabulary: union by word, keep higher mastery ----------------------
  const vocab = await tx.select().from(s.vocabulary).where(eq(s.vocabulary.userID, fromID));
  for (const v of vocab) {
    const id = `${toID}:${v.en}`;
    const [existing] = await tx.select().from(s.vocabulary).where(eq(s.vocabulary.id, id));
    if (existing) {
      if (v.mastery > existing.mastery) {
        await tx.update(s.vocabulary).set({ mastery: v.mastery }).where(eq(s.vocabulary.id, id));
      }
    } else {
      await tx.insert(s.vocabulary).values({ ...v, id, userID: toID });
    }
  }

  // --- cosmetics: union of owned (keep A's equipped) -----------------------
  const cosmetics = await tx.select().from(s.cosmetic).where(eq(s.cosmetic.userID, fromID));
  for (const c of cosmetics) {
    const id = `${toID}:${suffix(c.id, fromID)}`;
    const [existing] = await tx.select().from(s.cosmetic).where(eq(s.cosmetic.id, id));
    if (existing) {
      if (c.owned && !existing.owned) {
        await tx.update(s.cosmetic).set({ owned: true }).where(eq(s.cosmetic.id, id));
      }
    } else {
      await tx.insert(s.cosmetic).values({ ...c, id, userID: toID });
    }
  }

  // --- achievements: union; done wins, pct = max ---------------------------
  const achievements = await tx.select().from(s.achievement).where(eq(s.achievement.userID, fromID));
  for (const ac of achievements) {
    const id = `${toID}:${suffix(ac.id, fromID)}`;
    const [existing] = await tx.select().from(s.achievement).where(eq(s.achievement.id, id));
    if (existing) {
      await tx
        .update(s.achievement)
        .set({ done: existing.done || ac.done, pct: Math.max(existing.pct, ac.pct) })
        .where(eq(s.achievement.id, id));
    } else {
      await tx.insert(s.achievement).values({ ...ac, id, userID: toID });
    }
  }

  // --- follows / likes: union, dedup by target -----------------------------
  const follows = await tx.select().from(s.follow).where(eq(s.follow.userID, fromID));
  for (const f of follows) {
    const id = `${toID}:${f.creatorHandle}`;
    const [existing] = await tx.select().from(s.follow).where(eq(s.follow.id, id));
    if (!existing) await tx.insert(s.follow).values({ ...f, id, userID: toID });
  }

  const likes = await tx.select().from(s.like).where(eq(s.like.userID, fromID));
  for (const l of likes) {
    const id = `${toID}:${l.videoID}`;
    const [existing] = await tx.select().from(s.like).where(eq(s.like.id, id));
    if (!existing) await tx.insert(s.like).values({ ...l, id, userID: toID });
  }

  // --- progress: union by video, max watched/score, completed wins ---------
  const prog = await tx.select().from(s.progress).where(eq(s.progress.userID, fromID));
  for (const p of prog) {
    const [existing] = await tx
      .select()
      .from(s.progress)
      .where(and(eq(s.progress.userID, toID), eq(s.progress.videoID, p.videoID)));
    if (existing) {
      await tx
        .update(s.progress)
        .set({
          watchedMs: Math.max(existing.watchedMs, p.watchedMs),
          score: Math.max(existing.score, p.score),
          completed: existing.completed || p.completed,
        })
        .where(eq(s.progress.id, existing.id));
    } else {
      await tx.update(s.progress).set({ userID: toID }).where(eq(s.progress.id, p.id));
    }
  }

  // --- economy on the canonical row: sum earned (exclude starter bonus) ----
  // A keeps its own totals (incl. its one starter bonus); we add only B's
  // *earned* xp/gems so B's starter bonus is never double-counted.
  const eb = earned(b);
  await tx
    .update(s.user)
    .set({
      xp: a.xp + eb.xp,
      gems: a.gems + eb.gems,
      xpToday: Math.max(a.xpToday, b.xpToday),
      streak: Math.max(a.streak, b.streak),
      // level/levelName/xpToNext kept from A — recompute once a leveling
      // function exists (economy module, task bk-jaz.7).
    })
    .where(eq(s.user.id, toID));

  // --- drop B's moved child rows + tombstone B -----------------------------
  await tx.delete(s.vocabulary).where(eq(s.vocabulary.userID, fromID));
  await tx.delete(s.cosmetic).where(eq(s.cosmetic.userID, fromID));
  await tx.delete(s.achievement).where(eq(s.achievement.userID, fromID));
  await tx.delete(s.follow).where(eq(s.follow.userID, fromID));
  await tx.delete(s.like).where(eq(s.like.userID, fromID));
  await tx.delete(s.notification).where(eq(s.notification.userID, fromID));
  await tx.update(s.user).set({ mergedInto: toID }).where(eq(s.user.id, fromID));
}
