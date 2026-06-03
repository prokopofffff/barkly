import { FlashList, type ViewToken } from '@shopify/flash-list';
import { useCallback, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';

import { FeedVideo } from '@/components/feed-video';
import { SAMPLE_VIDEOS, type FeedVideoItem } from '@/lib/feed/sample-videos';

// Treat an item as "active" once it covers ≥80% of the viewport. Static, so
// it lives at module scope (FlashList requires a stable reference).
const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 80 };

/**
 * The core screen: a vertical, full-screen, paged video feed.
 *
 * Data is SAMPLE_VIDEOS for now. To go live, replace it with a Zero query:
 *   const [data] = useQuery(useFeedQuery(user.learningLang));
 * (see src/lib/zero/queries.ts) — the rest of this screen stays the same.
 */
export default function FeedScreen() {
  const { height } = useWindowDimensions();
  const [activeId, setActiveId] = useState<string | null>(SAMPLE_VIDEOS[0]?.id ?? null);

  // Stable across renders (setActiveId is stable) — FlashList rejects a
  // changing onViewableItemsChanged.
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<FeedVideoItem>[] }) => {
      const first = viewableItems[0]?.item;
      if (first) setActiveId(first.id);
    },
    [],
  );

  const renderItem = useCallback(
    ({ item }: { item: FeedVideoItem }) => (
      <FeedVideo item={item} isActive={item.id === activeId} height={height} />
    ),
    [activeId, height],
  );

  return (
    <View className="flex-1 bg-ink">
      <FlashList
        data={SAMPLE_VIDEOS}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        viewabilityConfig={VIEWABILITY_CONFIG}
        onViewableItemsChanged={onViewableItemsChanged}
      />
    </View>
  );
}
