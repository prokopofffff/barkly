import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icon';
import { COLORS, GRADIENTS } from '@/constants/gav';

export type NavTab = 'feed' | 'leaderboard' | 'studio' | 'rewards' | 'profile';

type Props = {
  active: NavTab;
  onNav: (tab: NavTab) => void;
};

const TABS: { id: NavTab; icon: IconName; label: string }[] = [
  { id: 'feed', icon: 'home', label: 'Лента' },
  { id: 'leaderboard', icon: 'trophy', label: 'Лиги' },
  { id: 'rewards', icon: 'gift', label: 'Призы' },
  { id: 'profile', icon: 'user', label: 'Профиль' },
];

/** Floating bottom tab bar with the raised center "studio" action. */
export function BottomNav({ active, onNav }: Props) {
  const insets = useSafeAreaInsets();
  // Left two tabs, center button, right two tabs — matches the design order.
  const left = TABS.slice(0, 2);
  const right = TABS.slice(2);

  return (
    <LinearGradient
      pointerEvents="box-none"
      colors={['rgba(8,8,12,0)', 'rgba(8,8,12,0.92)', 'rgba(8,8,12,0.92)']}
      locations={[0, 0.36, 1]}
      className="absolute inset-x-0 bottom-0 z-30 flex-row items-end justify-around"
      style={{ paddingTop: 18, paddingBottom: Math.max(insets.bottom, 12) }}
    >
      {left.map((t) => (
        <TabButton key={t.id} icon={t.icon} label={t.label} active={active === t.id} onPress={() => onNav(t.id)} />
      ))}

      <Pressable onPress={() => onNav('studio')} className="-translate-y-0.5">
        <LinearGradient
          colors={GRADIENTS.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: 50, height: 36, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="plus" size={26} color="#08130a" />
        </LinearGradient>
      </Pressable>

      {right.map((t) => (
        <TabButton key={t.id} icon={t.icon} label={t.label} active={active === t.id} onPress={() => onNav(t.id)} />
      ))}
    </LinearGradient>
  );
}

function TabButton({
  icon,
  label,
  active,
  onPress,
}: {
  icon: IconName;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const color = active ? COLORS.lime : 'rgba(246,246,251,0.5)';
  return (
    <Pressable onPress={onPress} className="w-[58px] items-center gap-0.5">
      <Icon name={icon} size={25} color={color} filled={active} />
      <Text className="font-nunito-x" style={{ fontSize: 10, color }}>
        {label}
      </Text>
    </Pressable>
  );
}
