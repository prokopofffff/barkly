import { useEffect } from 'react';
import { Text } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { COLORS } from '@/constants/gav';

export type FloatItem = { id: number; x: number; y: number; amt: number };

type Props = { items: FloatItem[] };

/** Transient "+N" particles that rise and fade where a reward was earned. */
export function FloatXp({ items }: Props) {
  return (
    <>
      {items.map((it) => (
        <Particle key={it.id} item={it} />
      ))}
    </>
  );
}

function Particle({ item }: { item: FloatItem }) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withTiming(1, { duration: 1100, easing: Easing.out(Easing.ease) });
  }, [t]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 0.18, 1], [0, 1, 0]),
    transform: [
      { translateY: interpolate(t.value, [0, 0.18, 1], [8, -2, -70]) },
      { scale: interpolate(t.value, [0, 0.18, 1], [0.8, 1.1, 1]) },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: item.x, top: item.y, zIndex: 40 }, style]}
    >
      <Text className="font-nunito-black" style={{ fontSize: 22, color: COLORS.gold }}>
        +{item.amt}
      </Text>
    </Animated.View>
  );
}
