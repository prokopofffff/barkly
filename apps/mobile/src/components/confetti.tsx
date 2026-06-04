import { useEffect, useMemo } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { COLORS } from '@/constants/gav';
import { seeded } from '@/lib/feed/prng';

const CONFETTI_COLORS = [COLORS.lime, COLORS.gold, COLORS.green, COLORS.violet, COLORS.cyan, COLORS.flame];

/** Falling confetti burst, used on every celebratory moment in the app. */
export function Confetti({ count = 40 }: { count?: number }) {
  const { width } = useWindowDimensions();
  // Seeded (not Math.random) so it stays pure under the React Compiler.
  const bits = useMemo(() => {
    const rng = seeded(count * 131 + Math.floor(width));
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      left: width * (0.2 + rng() * 0.6),
      dx: rng() * 240 - 120,
      rot: rng() * 720 - 360,
      delay: rng() * 0.25,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      size: 7 + rng() * 8,
      round: rng() > 0.5,
    }));
  }, [count, width]);

  return (
    <View pointerEvents="none" className="absolute inset-0 overflow-hidden">
      {bits.map((b) => (
        <ConfettiBit key={b.id} {...b} />
      ))}
    </View>
  );
}

function ConfettiBit({
  left,
  dx,
  rot,
  delay,
  color,
  size,
  round,
}: {
  left: number;
  dx: number;
  rot: number;
  delay: number;
  color: string;
  size: number;
  round: boolean;
}) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withTiming(1, { duration: 1500, easing: Easing.in(Easing.ease) });
  }, [t]);

  const style = useAnimatedStyle(() => {
    const p = Math.max(0, t.value - delay / 1.5);
    return {
      opacity: interpolate(p, [0, 0.9, 1], [1, 1, 0]),
      transform: [{ translateX: dx * p }, { translateY: -10 + 360 * p }, { rotate: `${rot * p}deg` }],
    };
  });

  return (
    <Animated.View
      style={[
        { position: 'absolute', left, top: '30%', width: size, height: size, backgroundColor: color, borderRadius: round ? size / 2 : 2 },
        style,
      ]}
    />
  );
}
