import { useQuery } from '@rocicorp/zero/react';
import type { Video } from '@barkly/zero';

import { SAMPLE_VIDEOS, type FeedVideoItem } from '@/lib/feed/sample-videos';
import { useFeedQuery } from '@/lib/zero/queries';

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
  };
}

/**
 * The feed, sourced from Zero. Reads sync reactively from the local replica;
 * until a backend is configured the replica is empty, so we fall back to the
 * bundled SAMPLE_VIDEOS. When zero-cache starts serving rows, this lights up
 * automatically with no screen changes.
 */
export function useFeedVideos(): FeedVideoItem[] {
  // ГАВ teaches English; once profiles carry a real preference use it here.
  const [rows] = useQuery(useFeedQuery('en'));
  return rows.length > 0 ? rows.map(mapVideoRow) : SAMPLE_VIDEOS;
}
