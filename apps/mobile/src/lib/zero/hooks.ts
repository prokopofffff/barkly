import { useMemo } from 'react';
import { useQuery } from '@rocicorp/zero/react';
import { DEFAULT_ELO, matchmake, type Video } from '@barkly/zero';

import { useAuth } from '@/lib/auth/auth-context';
import { SAMPLE_VIDEOS, type FeedVideoItem } from '@/lib/feed/sample-videos';
import { useCurrentUserQuery, useFeedQuery } from '@/lib/zero/queries';

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
 * The feed, sourced from Zero and matched to the user's ELO. Reads sync
 * reactively from the local replica; until a backend is configured the replica
 * is empty, so we fall back to the bundled SAMPLE_VIDEOS.
 */
export function useFeedVideos(): FeedVideoItem[] {
  const { user } = useAuth();
  const [rows] = useQuery(useFeedQuery('en'));
  const [me] = useQuery(useCurrentUserQuery(user?.userID ?? ''));
  const elo = me?.elo ?? DEFAULT_ELO;
  const games = me?.eloGames ?? 0;
  // Recompute only when the inputs change — FeedScreen re-renders frequently.
  return useMemo(
    () => (rows.length === 0 ? SAMPLE_VIDEOS : matchmake(rows, elo, games).map(mapVideoRow)),
    [rows, elo, games],
  );
}
