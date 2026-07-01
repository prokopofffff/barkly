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

/** Candidate pool for the feed: clips in the user's learning language. The
 * screen matches them to the user's ELO client-side (see hooks.ts matchmake),
 * so we fetch a broad pool rather than a fixed 50. */
export function useFeedQuery(learningLang: string) {
  const z = useZero();
  return z.query.video.where('langCode', '=', learningLang).orderBy('createdAt', 'desc').limit(300);
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

/** A league's display name + season countdown (public — everyone sees it). */
export function useLeagueQuery(leagueId: string) {
  const z = useZero();
  return z.query.league.where('id', '=', leagueId).one();
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

/** A clip's in-app comments, newest first (public — everyone sees them). */
export function useVideoCommentsQuery(videoID: string) {
  const z = useZero();
  return z.query.comment.where('videoID', '=', videoID).orderBy('createdAt', 'desc');
}

/** A user's per-video progress (watch + quiz results). */
export function useProgressForUser(userID: string) {
  const z = useZero();
  return z.query.progress.where('userID', '=', userID);
}

/** The clips a creator has published (their Studio "Опубликовано" list), newest first. */
export function useCreatorVideosQuery(userID: string) {
  const z = useZero();
  return z.query.video.where('creatorId', '=', userID).orderBy('createdAt', 'desc');
}

/** A single clip's row — the editor reads its `subtitle` jsonb from here. */
export function useVideoSubtitlesQuery(videoID: string) {
  const z = useZero();
  return z.query.video.where('id', '=', videoID).one();
}

/** The user's per-day XP rollup (daily-activity heatmap / streak). */
export function useDailyActivityQuery(userID: string) {
  const z = useZero();
  return z.query.dailyActivity.where('userID', '=', userID);
}

/** Materialized retention + engagement for one clip (creator analytics). */
export function useVideoAnalyticsQuery(videoID: string) {
  const z = useZero();
  return z.query.videoAnalytics.where('videoID', '=', videoID).one();
}

/** The editor's quiz-marker timeline for a clip, in playback order. */
export function useQuizMarkersQuery(videoID: string) {
  const z = useZero();
  return z.query.quizMarker.where('videoID', '=', videoID).orderBy('pos', 'asc');
}

/** The user's chest-claim records — gates the one-per-day daily chest. */
export function useDailyChestClaimQuery(userID: string) {
  const z = useZero();
  return z.query.dailyChestClaim.where('userID', '=', userID);
}
