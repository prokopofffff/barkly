import { useQuery } from '@rocicorp/zero/react';
import type { Video } from '@barkly/zero';

import { useAuth } from '@/lib/auth/auth-context';
import { SAMPLE_VIDEOS, type FeedVideoItem } from '@/lib/feed/sample-videos';
import { useCurrentUserQuery, useFeedQuery } from '@/lib/zero/queries';

// Keep in sync with apps/server/src/domain/lessons/elo.ts.
const DEFAULT_ELO = 500;
const PROVISIONAL_GAMES = 5;
const FEED_SIZE = 50;
const MIN_IN_WINDOW = 15;

/** Map a generated Zero `video` row to the screen's FeedVideoItem shape. */
function mapVideoRow(v: Video): FeedVideoItem {
  return {
    id: v.id,
    category: v.category,
    catEn: v.catEn,
    creator: {
      name: v.creatorName,
      handle: v.creatorHandle,
      gradient: v.creatorGradient,
      followers: v.creatorFollowers,
      verified: v.creatorVerified,
      mascot: v.creatorMascot ?? false,
    },
    bgGradient: [v.bgGradient[0], v.bgGradient[1]],
    caption: v.caption,
    likes: v.likes,
    comments: v.comments,
    shares: v.shares,
    tag: v.tag,
    subtitle: [...v.subtitle],
    quiz: v.quiz,
    hlsUrl: v.hlsUrl,
    youtubeId: v.youtubeId ?? undefined,
  };
}

/**
 * Adaptive ELO matchmaking: prefer clips within ±50 of the user's ELO; if too
 * few qualify, widen the window (wider while the rating is still provisional),
 * then return the nearest-by-difficulty clips. Pure for easy reasoning/testing.
 */
export function matchmake(rows: readonly Video[], elo: number, games: number): Video[] {
  const windows = games < PROVISIONAL_GAMES ? [250, 500, Infinity] : [50, 100, 200, Infinity];
  const dist = (v: Video) => Math.abs((v.difficulty ?? 0) - elo);
  let pool: readonly Video[] = rows;
  for (const w of windows) {
    const inWin = rows.filter((r) => dist(r) <= w);
    if (inWin.length >= MIN_IN_WINDOW || w === Infinity) {
      pool = inWin;
      break;
    }
  }
  return [...pool].sort((a, b) => dist(a) - dist(b)).slice(0, FEED_SIZE);
}

/**
 * The feed, sourced from Zero and matched to the user's ELO. Reads sync
 * reactively from the local replica; until a backend is configured the replica
 * is empty, so we fall back to the bundled SAMPLE_VIDEOS.
 */
export function useFeedVideos(): FeedVideoItem[] {
  const { user } = useAuth();
  const [rows] = useQuery(useFeedQuery('en'));
  const [me] = useQuery(useCurrentUserQuery(user?.userID ?? ''));
  if (rows.length === 0) return SAMPLE_VIDEOS;
  const elo = me?.elo ?? DEFAULT_ELO;
  const games = me?.eloGames ?? 0;
  return matchmake(rows, elo, games).map(mapVideoRow);
}
