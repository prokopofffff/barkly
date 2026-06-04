import type { ReactNode } from 'react';
import { View } from 'react-native';

type Props = {
  children: ReactNode;
  /** Border tint — chips are otherwise translucent dark pills. */
  borderColor?: string;
  className?: string;
};

/** Translucent rounded pill — design's `.chip` primitive. */
export function Chip({ children, borderColor = 'rgba(255,255,255,0.15)', className }: Props) {
  return (
    <View
      className={`flex-row items-center gap-1.5 rounded-full ${className ?? ''}`}
      style={{ paddingVertical: 6, paddingHorizontal: 12, backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 1, borderColor }}
    >
      {children}
    </View>
  );
}
