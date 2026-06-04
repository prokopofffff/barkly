import { useZero } from '@rocicorp/zero/react';

/**
 * Reusable Zero query builders — one per screen's read. Use them from
 * components via `useQuery`, e.g.:
 *
 *   import { useQuery } from '@rocicorp/zero/react';
 *   import { useFeedQuery } from '@/lib/zero/queries';
 *   const [videos] = useQuery(useFeedQuery('en'));
 *
 * Reads are reactive and run against the local SQLite replica first, so they
 * resolve instantly and update live as zero-cache syncs. While there is no
 * backend configured the replica is empty — screens fall back to placeholder
 * data via `useFallbackQuery` (see src/lib/zero/hooks.ts).
 */

/** Feed: clips for the user's learning language, newest first. */
export function useFeedQuery(learningLang: string) {
  const z = useZero();
  return z.query.video.where('langCode', '=', learningLang).orderBy('createdAt', 'desc').limit(50);
}

/** The signed-in user's row (gamification counters, equipped cosmetic, …). */
export function useCurrentUserQuery(userID: string) {
  const z = useZero();
  return z.query.user.where('id', '=', userID).one();
}

/** All saved vocabulary for a user, newest first. */
export function useVocabularyQuery(userID: string) {
  const z = useZero();
  return z.query.vocabulary.where('userID', '=', userID).orderBy('createdAt', 'desc');
}

/** League standings, highest XP first. */
export function useLeaderboardQuery(leagueId: string) {
  const z = useZero();
  return z.query.leagueMember.where('leagueId', '=', leagueId).orderBy('xp', 'desc');
}

/** A user's achievements in display order. */
export function useAchievementsQuery(userID: string) {
  const z = useZero();
  return z.query.achievement.where('userID', '=', userID).orderBy('sort', 'asc');
}

/** A user's cosmetics catalog + ownership. */
export function useCosmeticsQuery(userID: string) {
  const z = useZero();
  return z.query.cosmetic.where('userID', '=', userID).orderBy('sort', 'asc');
}

/** A user's notifications, newest first. */
export function useNotificationsQuery(userID: string) {
  const z = useZero();
  return z.query.notification.where('userID', '=', userID).orderBy('createdAt', 'desc');
}

/** A user's per-video progress (watch + quiz results). */
export function useProgressForUser(userID: string) {
  const z = useZero();
  return z.query.progress.where('userID', '=', userID);
}
