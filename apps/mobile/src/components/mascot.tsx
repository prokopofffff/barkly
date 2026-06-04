import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { COLORS } from '@/constants/gav';

export type MascotMood = 'idle' | 'happy' | 'celebrate' | 'sad' | 'wow' | 'sleep';

type Props = {
  mood?: MascotMood;
  size?: number;
  /** Equipped cosmetic id (cap/glasses/scarf/crown), shown on the placeholder. */
  cosmetic?: string | null;
};

const MOOD_LABEL: Record<MascotMood, string> = {
  idle: 'IDLE',
  happy: 'HAPPY',
  celebrate: 'CELEBRATE',
  sad: 'SAD',
  wow: 'WOW',
  sleep: 'SLEEP',
};

const COSMETIC_LABEL: Record<string, string> = {
  cap: 'КЕПКА',
  glasses: 'ОЧКИ',
  scarf: 'ШАРФ',
  crown: 'КОРОНА',
};

/**
 * Шарик — the ГАВ mascot. Real character art (Lottie/animated image) drops in
 * later; until then this renders the design's clean branded placeholder so
 * nothing looks broken, with subtle per-mood idle motion.
 */
export function Sharik({ mood = 'idle', size = 140, cosmetic = null }: Props) {
  const t = useSharedValue(0);
  const compact = size < 86;

  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [t]);

  const motion = useAnimatedStyle(() => {
    // Each mood gets a distinct gentle motion, matching the design's keyframes.
    switch (mood) {
      case 'happy':
        return { transform: [{ translateY: -size * 0.08 * t.value }, { rotate: `${-2 + t.value * 4}deg` }] };
      case 'celebrate':
      case 'wow':
        return { transform: [{ scale: 1 + t.value * 0.09 }, { rotate: `${-2 + t.value * 3}deg` }] };
      case 'sad':
        return { transform: [{ translateY: size * 0.03 * t.value }, { rotate: `${-1.5 * t.value}deg` }] };
      case 'sleep':
        return { transform: [{ scale: 1 + t.value * 0.04 }] };
      default:
        return { transform: [{ translateY: -size * 0.06 * t.value }] };
    }
  });

  return (
    <Animated.View style={[{ width: size, height: size }, motion]}>
      <View
        className="items-center justify-center overflow-hidden rounded-full bg-surface-2"
        style={{
          width: size,
          height: size,
          borderWidth: 1.5,
          borderColor: COLORS.line2,
          borderStyle: 'dashed',
          gap: size * 0.04,
        }}
      >
        <Text className="font-mono" style={{ color: COLORS.lime, fontSize: size * (compact ? 0.46 : 0.34), lineHeight: size * (compact ? 0.5 : 0.38) }}>
          Ш
        </Text>
        {!compact && (
          <Text
            className="font-mono text-center"
            style={{ color: COLORS.textFaint, fontSize: Math.max(8, size * 0.072), letterSpacing: 1 }}
          >
            ШАРИК · {MOOD_LABEL[mood]}
            {cosmetic ? ` · ${COSMETIC_LABEL[cosmetic] ?? cosmetic.toUpperCase()}` : ''}
          </Text>
        )}
      </View>
    </Animated.View>
  );
}
