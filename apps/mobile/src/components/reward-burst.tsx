import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Confetti } from '@/components/confetti';
import { Icon } from '@/components/icon';
import { Sharik } from '@/components/mascot';
import { COLORS, GRADIENTS } from '@/constants/gav';

export type Burst = { id: number; correct: true; xp: number; combo: number } | { id: number; correct: false };

type Props = { data: Burst };

/** Full-screen, non-blocking celebration overlay shown after a quiz answer. */
export function RewardBurst({ data }: Props) {
  if (!data.correct) {
    return (
      <View pointerEvents="none" className="absolute inset-0 z-[45] items-center justify-center gap-3">
        <Sharik mood="sad" size={92} />
        <Pop>
          <View
            className="rounded-full"
            style={{
              paddingVertical: 9,
              paddingHorizontal: 18,
              backgroundColor: 'rgba(255,107,129,0.18)',
              borderWidth: 1,
              borderColor: 'rgba(255,107,129,0.5)',
            }}
          >
            <Text className="font-nunito-black" style={{ color: COLORS.rose }}>
              Почти! +0 XP
            </Text>
          </View>
        </Pop>
      </View>
    );
  }

  return (
    <View pointerEvents="none" className="absolute inset-0 z-[45] items-center justify-center gap-3">
      <Confetti count={24} />
      <Pop>
        <View className="flex-row items-center gap-1.5">
          <Icon name="bolt" size={44} color={COLORS.gold} />
          <Text className="font-nunito-black" style={{ fontSize: 66, color: COLORS.gold }}>
            +{data.xp}
          </Text>
        </View>
      </Pop>
      {data.combo >= 2 && (
        <Pop delay={120}>
          <LinearGradient
            colors={GRADIENTS.brand}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: 999, paddingVertical: 8, paddingHorizontal: 18 }}
          >
            <Text className="font-nunito-black" style={{ color: '#08130a', fontSize: 17 }}>
              КОМБО ×{data.combo} 🔥
            </Text>
          </LinearGradient>
        </Pop>
      )}
    </View>
  );
}

/** rewardPop-style entrance: pop up, settle, then drift away. */
function Pop({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withTiming(1, { duration: 1450, easing: Easing.out(Easing.cubic) });
  }, [t]);

  const style = useAnimatedStyle(() => {
    const p = Math.max(0, t.value - delay / 1450);
    return {
      opacity: interpolate(p, [0, 0.22, 0.68, 1], [0, 1, 1, 0]),
      transform: [
        { translateY: interpolate(p, [0, 0.22, 0.68, 1], [24, 0, -6, -46]) },
        { scale: interpolate(p, [0, 0.22, 0.68, 1], [0.5, 1.18, 1, 0.92]) },
      ],
    };
  });

  return <Animated.View style={style}>{children}</Animated.View>;
}
