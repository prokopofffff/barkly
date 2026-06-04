import { useEffect } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { Sharik } from '@/components/mascot';
import { COLORS } from '@/constants/gav';
import { NOTIFICATION_ICON, NOTIFICATIONS } from '@/lib/feed/app-data';
import type { AppNotification } from '@/lib/feed/app-data';

/**
 * Notifications — a full-screen pushed route (no nav bar). Duolingo-style
 * mascot nudges from Шарик, plus a daily-reminder settings hint.
 */
export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-bg">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 40 }}
      >
        {/* header */}
        <View className="flex-row items-center gap-3" style={{ paddingHorizontal: 22, paddingBottom: 14 }}>
          <IconButton icon="chevL" onPress={() => router.back()} />
          <Text className="font-nunito-black text-content" style={{ fontSize: 27, letterSpacing: -0.5 }}>
            Уведомления
          </Text>
        </View>

        {/* hero push-style card from Шарик */}
        <View style={{ paddingHorizontal: 22, paddingBottom: 8 }}>
          <View
            className="flex-row items-center gap-3.5 overflow-hidden rounded-[28px]"
            style={{ padding: 18, borderWidth: 1, borderColor: 'rgba(255,138,61,0.3)' }}
          >
            <LinearGradient
              colors={['rgba(255,138,61,0.16)', 'rgba(255,107,129,0.06)']}
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={{ position: 'absolute', inset: 0 }}
            />
            <Wiggle>
              <Sharik mood="sad" size={84} />
            </Wiggle>
            <View className="flex-1">
              <Text className="font-nunito-x text-content" style={{ fontSize: 17, lineHeight: 21 }}>
                Шарик скучает по тебе 🥺
              </Text>
              <Text className="font-nunito-bold" style={{ color: COLORS.textDim, fontSize: 13, marginTop: 4, lineHeight: 17 }}>
                Один урок — и стрик в безопасности. Не подведём его!
              </Text>
            </View>
          </View>
        </View>

        {/* list */}
        <View style={{ paddingHorizontal: 22, paddingTop: 14 }}>
          <Text
            className="font-nunito-bold uppercase"
            style={{ color: COLORS.textDim, fontSize: 11, letterSpacing: 0.88, marginBottom: 10 }}
          >
            Сегодня
          </Text>
          <View className="gap-2.5">
            {NOTIFICATIONS.map((n, i) => (
              <NotificationRow key={i} item={n} />
            ))}
          </View>

          {/* settings hint */}
          <View
            className="mt-[18px] flex-row items-center gap-3 rounded-[20px] bg-surface"
            style={{ padding: 16, borderWidth: 1, borderColor: COLORS.line }}
          >
            <Icon name="bell" size={22} color={COLORS.textDim} />
            <Text className="flex-1 font-nunito-bold text-content" style={{ fontSize: 13 }}>
              Напоминать в 20:00 каждый день
            </Text>
            <View className="rounded-full" style={{ width: 46, height: 28, backgroundColor: COLORS.lime }}>
              <View
                className="absolute rounded-full"
                style={{ top: 3, right: 3, width: 22, height: 22, backgroundColor: '#fff' }}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/** A single notification row: tinted square glyph, title + time, body text. */
function NotificationRow({ item }: { item: AppNotification }) {
  return (
    <View
      className="flex-row items-start gap-3.5 rounded-[20px] bg-surface"
      style={{ padding: 14, borderWidth: 1, borderColor: COLORS.line }}
    >
      <View
        className="items-center justify-center rounded-[13px]"
        style={{
          width: 42,
          height: 42,
          backgroundColor: item.accent + '22',
          borderWidth: 1,
          borderColor: item.accent + '55',
        }}
      >
        <Icon name={NOTIFICATION_ICON[item.kind]} size={22} color={item.accent} />
      </View>
      <View className="flex-1">
        <View className="flex-row justify-between gap-2">
          <Text className="flex-1 font-nunito-x text-content" style={{ fontSize: 17, lineHeight: 21 }}>
            {item.title}
          </Text>
          <Text className="font-nunito-bold" style={{ color: COLORS.textFaint, fontSize: 11 }}>
            {item.time}
          </Text>
        </View>
        <Text className="font-nunito-bold" style={{ color: COLORS.textDim, fontSize: 13, marginTop: 3, lineHeight: 17 }}>
          {item.text}
        </Text>
      </View>
    </View>
  );
}

/** Looping ±4° wiggle, matching the design's `wiggle 2.6s` keyframe. */
function Wiggle({ children }: { children: React.ReactNode }) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [t]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-4 + t.value * 8}deg` }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}
