import { Pressable } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { COLORS } from '@/constants/gav';

type Props = {
  icon: IconName;
  onPress: () => void;
  size?: number;
  color?: string;
};

/** Round translucent header / back button — design's round `IconChip`. */
export function IconButton({ icon, onPress, size = 40, color = COLORS.text }: Props) {
  return (
    <Pressable
      onPress={onPress}
      className="items-center justify-center rounded-full bg-surface-2"
      style={{ width: size, height: size, borderWidth: 1, borderColor: COLORS.line }}
    >
      <Icon name={icon} size={Math.round(size * 0.5)} color={color} />
    </Pressable>
  );
}
