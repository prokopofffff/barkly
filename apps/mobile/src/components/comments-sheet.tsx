import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icon';
import { COLORS } from '@/constants/gav';
import { FEED_COMMENTS } from '@/lib/feed/app-data';

type Props = {
  /** Comment count label to show in the header. */
  count: string;
  onClose: () => void;
};

/** Slide-up comments sheet (66% tall) — design's `CommentsSheet`. */
export function CommentsSheet({ count, onClose }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View className="absolute inset-0 z-50 justify-end">
      <Animated.View entering={FadeIn.duration(250)} style={{ position: 'absolute', inset: 0 }}>
        <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} />
      </Animated.View>

      <Animated.View
        entering={SlideInDown.duration(380)}
        className="bg-surface"
        style={{ height: '66%', borderTopLeftRadius: 28, borderTopRightRadius: 28 }}
      >
        <View className="px-[18px] pb-2 pt-3.5">
          <View className="mb-3.5 h-[5px] w-10 self-center rounded-full" style={{ backgroundColor: COLORS.line2 }} />
          <Text className="font-nunito-x text-content text-center" style={{ fontSize: 17 }}>
            {count} комментариев
          </Text>
        </View>

        <ScrollView className="flex-1 px-[18px]">
          {FEED_COMMENTS.map((c, i) => (
            <View key={i} className="flex-row gap-3 py-3">
              <Avatar name={c.name} size={40} gradient={c.gradient} ring={false} />
              <View className="flex-1">
                <Text className="font-nunito-bold" style={{ color: COLORS.textDim, fontSize: 13 }}>
                  {c.name}
                </Text>
                <Text className="font-nunito-semibold text-content" style={{ fontSize: 15, marginTop: 2 }}>
                  {c.text}
                </Text>
              </View>
              <View className="items-center gap-0.5">
                <Icon name="heart" size={18} color={COLORS.textFaint} />
                <Text className="font-nunito-bold" style={{ color: COLORS.textFaint, fontSize: 11 }}>
                  {c.likes}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>

        <View
          className="flex-row items-center gap-2.5 px-[18px] pt-2.5"
          style={{ borderTopWidth: 1, borderColor: COLORS.line, paddingBottom: Math.max(insets.bottom, 16) }}
        >
          <Avatar name="Аня" size={36} gradient="brand" ring={false} />
          <View className="flex-1 rounded-full bg-surface-2" style={{ paddingVertical: 11, paddingHorizontal: 14 }}>
            <Text className="font-nunito-bold" style={{ color: COLORS.textDim, fontSize: 13 }}>
              Добавь комментарий…
            </Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}
