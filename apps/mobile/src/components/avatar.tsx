import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from 'react-native';

import { GRADIENTS, type GradientName } from '@/constants/gav';

type Props = {
  name: string;
  size?: number;
  gradient?: GradientName;
  /** Draw the gradient ring around the avatar (default true). */
  ring?: boolean;
};

/** Gradient-ring avatar with initials, matching the design's `Avatar`. */
export function Avatar({ name, size = 44, gradient = 'fun', ring = true }: Props) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const inner = (
    <View
      className="flex-1 items-center justify-center rounded-full bg-surface-2"
      style={{ borderRadius: size / 2 }}
    >
      <Text className="font-nunito-black text-content" style={{ fontSize: size * 0.38 }}>
        {initials}
      </Text>
    </View>
  );

  if (!ring) {
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2 }}>{inner}</View>
    );
  }

  return (
    <LinearGradient
      colors={GRADIENTS[gradient]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: size / 2, padding: 2.5 }}
    >
      {inner}
    </LinearGradient>
  );
}
