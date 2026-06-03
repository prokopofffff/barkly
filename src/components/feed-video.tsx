import { VideoView, useVideoPlayer } from 'expo-video';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { FeedVideoItem } from '@/lib/feed/sample-videos';

type Props = {
  item: FeedVideoItem;
  isActive: boolean;
  height: number;
};

/**
 * One full-screen clip in the vertical feed. Plays only while it's the active
 * (on-screen) item; everything else is paused and rewound to save battery and
 * bandwidth — the same pattern TikTok uses.
 */
export function FeedVideo({ item, isActive, height }: Props) {
  const player = useVideoPlayer(item.hlsUrl, (p) => {
    p.loop = true;
    p.muted = false;
  });

  useEffect(() => {
    if (isActive) {
      player.play();
    } else {
      player.pause();
      // expo-video's player is an intentionally mutable native handle, not React state.
      // eslint-disable-next-line react-hooks/immutability
      player.currentTime = 0;
    }
  }, [isActive, player]);

  return (
    <View style={{ height }} className="bg-ink">
      <VideoView
        style={StyleSheet.absoluteFill}
        player={player}
        contentFit="cover"
        nativeControls={false}
      />

      {/* Learning overlay: the phrase being taught + its translation. */}
      <View className="absolute inset-x-0 bottom-0 p-5 pb-28">
        <Text className="text-white/70 text-xs font-semibold uppercase tracking-wide">
          {item.langCode} · {item.level}
        </Text>
        <Text className="text-white text-3xl font-extrabold mt-1">{item.phrase}</Text>
        <Text className="text-white/80 text-base mt-1">{item.translation}</Text>
      </View>
    </View>
  );
}
