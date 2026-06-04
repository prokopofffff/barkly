import { Pressable, Text, View } from 'react-native';

import { COLORS } from '@/constants/gav';

type Props = {
  title: string;
  /** Optional trailing action label (e.g. "Все"). */
  action?: string;
  onAction?: () => void;
};

/** Row with a section title and an optional accent action — design's `SectionHead`. */
export function SectionHead({ title, action, onAction }: Props) {
  return (
    <View className="mb-3 flex-row items-center justify-between">
      <Text className="font-nunito-x text-content" style={{ fontSize: 21 }}>
        {title}
      </Text>
      {action && (
        <Pressable onPress={onAction}>
          <Text className="font-nunito-x" style={{ color: COLORS.lime, fontSize: 13 }}>
            {action}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
