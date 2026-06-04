import { Pressable, Text } from 'react-native';

import { Icon, type IconName } from '@/components/icon';

type Props = {
  icon: IconName;
  label: string;
  color: string;
  /** Fill the icon (active like/bookmark state). */
  filled?: boolean;
  onPress: () => void;
};

/** A single icon + caption action in the feed's right-hand rail. */
export function RailButton({ icon, label, color, filled, onPress }: Props) {
  return (
    <Pressable onPress={onPress} className="items-center gap-1">
      <Icon name={icon} size={32} color={color} filled={filled} />
      <Text className="font-nunito-x text-white" style={{ fontSize: 11 }}>
        {label}
      </Text>
    </Pressable>
  );
}
