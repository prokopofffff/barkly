import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { COLORS } from '@/constants/gav';

type Props = {
  count: number;
  size?: 'sm' | 'md';
};

/** Flame + streak count chip with a gently flickering flame. */
export function StreakBadge({ count, size = 'md' }: Props) {
  const small = size === 'sm';
  const flicker = useSharedValue(0);

  useEffect(() => {
    flicker.value = withRepeat(withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [flicker]);

  const flameStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: 1 + flicker.value * 0.08 },
      { rotate: `${-2 + flicker.value * 4}deg` },
    ],
  }));

  return (
    <View
      className="flex-row items-center gap-1.5 rounded-full"
      style={{
        backgroundColor: 'rgba(255,138,61,0.16)',
        borderWidth: 1,
        borderColor: 'rgba(255,138,61,0.4)',
        paddingVertical: small ? 4 : 6,
        paddingHorizontal: small ? 9 : 12,
      }}
    >
      <Animated.View style={flameStyle}>
        <Icon name="fire" size={small ? 15 : 18} color={COLORS.flame} />
      </Animated.View>
      <Text className="font-nunito-black" style={{ color: '#ffb37a', fontSize: small ? 13 : 15 }}>
        {count}
      </Text>
    </View>
  );
}
