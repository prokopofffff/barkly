import { Pressable, Text } from 'react-native';

import { COLORS } from '@/constants/gav';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Extra layout classes (e.g. margins) from the call site. */
  className?: string;
};

/** The brand CTA — design's `.btn-primary` (lime fill, dark-ink label). */
export function PrimaryButton({ label, onPress, disabled, className }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`w-full items-center justify-center rounded-[20px] ${className ?? ''}`}
      style={{ backgroundColor: COLORS.lime, paddingVertical: 16, opacity: disabled ? 0.4 : 1 }}
    >
      <Text className="font-nunito-black" style={{ color: '#0a0e02', fontSize: 16 }}>
        {label}
      </Text>
    </Pressable>
  );
}
