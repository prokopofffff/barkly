import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';

import { GRADIENTS, type GradientName } from '@/constants/gav';

type Props = {
  value: number;
  max: number;
  height?: number;
  /** Gradient fill (default reward gold→orange). */
  gradient?: GradientName;
};

/** Rounded XP progress bar — design's `XPBar`. */
export function XPBar({ value, max, height = 12, gradient = 'reward' }: Props) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <View
      className="w-full overflow-hidden rounded-full"
      style={{ height, backgroundColor: 'rgba(255,255,255,0.09)' }}
    >
      <LinearGradient
        colors={GRADIENTS[gradient]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ height, width: `${pct}%`, borderRadius: 999 }}
      />
    </View>
  );
}
