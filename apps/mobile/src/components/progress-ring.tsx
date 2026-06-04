import type { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { COLORS } from '@/constants/gav';

type Props = {
  pct: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: ReactNode;
};

/** Circular progress ring with centered content — design's `ProgressRing`. */
export function ProgressRing({ pct, size = 56, stroke = 6, color = COLORS.lime, children }: Props) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (clamped / 100) * c}
        />
      </Svg>
      <View className="absolute inset-0 items-center justify-center">{children}</View>
    </View>
  );
}
