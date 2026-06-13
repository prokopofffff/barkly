import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@rocicorp/zero/react';

import { Avatar } from '@/components/avatar';
import { Icon, type IconName } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { LinkAccountCard } from '@/components/link-account-banner';
import { Sharik } from '@/components/mascot';
import { ProgressRing } from '@/components/progress-ring';
import { SectionHead } from '@/components/section-head';
import { XPBar } from '@/components/xp-bar';
import { COLORS, GRADIENTS } from '@/constants/gav';
import { useAuth } from '@/lib/auth/auth-context';
import { ACHIEVEMENTS, USER } from '@/lib/feed/app-data';
import { useGame } from '@/lib/feed/game-context';
import { useLocalProfile } from '@/lib/profile/local-profile';
import { SAMPLE_VIDEOS } from '@/lib/feed/sample-videos';
import { useCurrentUserQuery } from '@/lib/zero/queries';

const WEEK = [40, 70, 30, 90, 55, 100, 65];
const DAYS = ['П', 'В', 'С', 'Ч', 'П', 'С', 'В'];

/**
 * Profile tab: level/XP header, a 2×2 stats grid, the mascot showcase, the
 * saved-vocabulary entry, achievements, a weekly-activity bar chart, and the
 * learner's favourite creators. Reads from USER + useGame() shared state.
 */
export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state, savedWords, cosmetic } = useGame();
  const { user } = useAuth();
  const { linkPromptDismissed } = useLocalProfile();
  const [me] = useQuery(useCurrentUserQuery(user?.userID ?? ''));
  const isCurator = me?.role === 'curator' || me?.role === 'admin';

  // Profile is the account hub: nudge an anonymous learner to secure progress.
  const showLinkCard = !!user?.isAnonymous && !linkPromptDismissed;

  return (
    <ScrollView
      className="flex-1 bg-bg"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 120 }}
    >
      {/* header */}
      <LinearGradient
        colors={['rgba(192,132,252,0.18)', 'transparent']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.6 }}
        style={{ paddingTop: insets.top + 18, paddingHorizontal: 22, paddingBottom: 18 }}
      >
        <View className="mb-3 flex-row justify-end gap-2.5">
          <IconButton icon="bell" onPress={() => router.push('/notifications')} color={COLORS.textDim} />
          <IconButton icon="settings" onPress={() => {}} color={COLORS.textDim} />
        </View>

        <View className="flex-row items-center gap-4">
          <ProgressRing pct={(state.xp / USER.xpToNext) * 100} size={92} stroke={7} color={COLORS.violet}>
            <Avatar name={USER.name} size={70} gradient="fun" ring={false} />
          </ProgressRing>
          <View className="flex-1">
            <Text className="font-nunito-black text-content" style={{ fontSize: 27 }}>
              {USER.name}
            </Text>
            <Text className="font-nunito-bold" style={{ color: COLORS.textDim, fontSize: 13 }}>
              {USER.handle}
            </Text>
            <View className="mt-2 flex-row gap-2">
              <LinearGradient
                colors={GRADIENTS.fun}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                className="rounded-full"
                style={{ paddingVertical: 6, paddingHorizontal: 12 }}
              >
                <Text className="font-nunito-x text-white" style={{ fontSize: 12 }}>
                  Ур. {USER.level} · {USER.levelName}
                </Text>
              </LinearGradient>
            </View>
          </View>
        </View>

        {/* level progress */}
        <View className="mt-4">
          <View className="mb-1.5 flex-row justify-between">
            <Text className="font-nunito-bold" style={{ color: COLORS.textDim, fontSize: 13 }}>
              До уровня {USER.level + 1}
            </Text>
            <Text className="font-nunito-bold" style={{ color: COLORS.gold, fontSize: 13 }}>
              {state.xp} / {USER.xpToNext} XP
            </Text>
          </View>
          <XPBar value={state.xp} max={USER.xpToNext} height={10} />
        </View>
      </LinearGradient>

      {/* link-account nudge (anonymous only) */}
      {showLinkCard && (
        <View style={{ paddingHorizontal: 22, paddingTop: 4, paddingBottom: 8 }}>
          <LinkAccountCard />
        </View>
      )}

      {/* stats grid */}
      <View className="flex-row flex-wrap gap-3" style={{ paddingHorizontal: 22, paddingVertical: 4 }}>
        <Stat icon="fire" color={COLORS.flame} value={String(state.streak)} label="дней стрик" />
        <Stat icon="bolt" color={COLORS.gold} value={USER.totalXp.toLocaleString('ru-RU')} label="всего XP" />
        <Stat icon="sparkle" color={COLORS.violet} value={String(USER.wordsLearned)} label="слов выучено" />
        <Stat icon="trophy" color={COLORS.cyan} value={'#' + USER.leagueRank} label={USER.league + ' лига'} />
      </View>

      {/* mascot showcase */}
      <View style={{ paddingHorizontal: 22, paddingTop: 18 }}>
        <View
          className="flex-row items-center gap-3 overflow-hidden rounded-[28px]"
          style={{ padding: 20, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line }}
        >
          <LinearGradient
            colors={['rgba(182,242,61,0.16)', 'transparent']}
            start={{ x: 0.5, y: 0.5 }}
            end={{ x: 1, y: 0 }}
            style={{ position: 'absolute', right: -30, top: -30, width: 140, height: 140, borderRadius: 70 }}
          />
          <Sharik mood="happy" size={104} cosmetic={cosmetic} />
          <View className="flex-1">
            <Text className="font-nunito-x uppercase" style={{ color: COLORS.lime, fontSize: 11, letterSpacing: 1 }}>
              Твой Шарик
            </Text>
            <Text className="font-nunito-x text-content" style={{ fontSize: 21, marginVertical: 2, marginBottom: 10 }}>
              Уровень дружбы {USER.friendshipLevel}
            </Text>
            <Pressable
              onPress={() => router.push('/rewards')}
              className="items-center justify-center self-start rounded-[20px]"
              style={{
                paddingVertical: 10,
                paddingHorizontal: 16,
                backgroundColor: COLORS.surface2,
                borderWidth: 1,
                borderColor: COLORS.line2,
              }}
            >
              <Text className="font-nunito-x text-content" style={{ fontSize: 14 }}>
                Нарядить →
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* my vocabulary */}
      <View style={{ paddingHorizontal: 22, paddingTop: 18 }}>
        <Pressable
          onPress={() => router.push('/vocabulary')}
          className="w-full flex-row items-center gap-3.5 rounded-[20px]"
          style={{ padding: 16, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line }}
        >
          <View
            className="items-center justify-center rounded-[14px]"
            style={{
              width: 46,
              height: 46,
              backgroundColor: 'rgba(52,227,255,0.16)',
              borderWidth: 1,
              borderColor: 'rgba(52,227,255,0.4)',
            }}
          >
            <Icon name="book" size={24} color={COLORS.cyan} />
          </View>
          <View className="flex-1">
            <Text className="font-nunito-x text-content" style={{ fontSize: 17 }}>
              Мой словарь
            </Text>
            <Text className="font-nunito-bold" style={{ color: COLORS.textDim, fontSize: 13, marginTop: 2 }}>
              {savedWords.length} слов и фраз сохранено
            </Text>
          </View>
          <View
            className="rounded-full"
            style={{
              paddingVertical: 6,
              paddingHorizontal: 12,
              backgroundColor: 'rgba(255,138,61,0.16)',
              borderWidth: 1,
              borderColor: 'rgba(255,138,61,0.4)',
            }}
          >
            <Text className="font-nunito-x" style={{ color: '#ffb37a', fontSize: 12 }}>
              Повторить
            </Text>
          </View>
          <Icon name="chevR" size={18} color={COLORS.textFaint} />
        </Pressable>
      </View>

      {/* curator: submit Shorts (curator/admin) or apply (basic) — bk-jaz.9.3 */}
      <View style={{ paddingHorizontal: 22, paddingTop: 12 }}>
        <Pressable
          onPress={() => router.push('/curator-submit')}
          className="w-full flex-row items-center gap-3.5 rounded-[20px]"
          style={{ padding: 16, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line }}
        >
          <View
            className="items-center justify-center rounded-[14px]"
            style={{
              width: 46,
              height: 46,
              backgroundColor: 'rgba(182,242,61,0.16)',
              borderWidth: 1,
              borderColor: 'rgba(182,242,61,0.4)',
            }}
          >
            <Icon name={isCurator ? 'upload' : 'crown'} size={24} color={COLORS.lime} />
          </View>
          <View className="flex-1">
            <Text className="font-nunito-x text-content" style={{ fontSize: 17 }}>
              {isCurator ? 'Загрузить Shorts' : 'Стать куратором'}
            </Text>
            <Text className="font-nunito-bold" style={{ color: COLORS.textDim, fontSize: 13, marginTop: 2 }}>
              {isCurator ? 'Добавить ролик в ленту по ссылке' : 'Добавляй видео и помогай другим учиться'}
            </Text>
          </View>
          <Icon name="chevR" size={18} color={COLORS.textFaint} />
        </Pressable>
      </View>

      {/* achievements */}
      <View style={{ paddingTop: 22 }}>
        <View style={{ paddingHorizontal: 22 }}>
          <SectionHead title="Достижения" action="Все" />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 4, gap: 12 }}
        >
          {ACHIEVEMENTS.map((a) => (
            <View
              key={a.name}
              className="items-center rounded-[20px]"
              style={{
                width: 110,
                padding: 14,
                backgroundColor: COLORS.surface,
                borderWidth: 1,
                borderColor: COLORS.line,
                opacity: a.done ? 1 : 0.86,
              }}
            >
              <View style={{ width: 52, height: 52, marginBottom: 8 }}>
                <ProgressRing pct={a.done ? 100 : (a.pct ?? 0)} size={52} stroke={5} color={a.color}>
                  <Icon name={a.icon} size={24} color={a.color} />
                </ProgressRing>
                {!a.done && (
                  <View
                    className="absolute items-center justify-center rounded-full"
                    style={{
                      right: -2,
                      bottom: -2,
                      width: 18,
                      height: 18,
                      backgroundColor: COLORS.surface2,
                      borderWidth: 1,
                      borderColor: COLORS.line,
                    }}
                  >
                    <Icon name="lock" size={11} color={COLORS.textFaint} />
                  </View>
                )}
              </View>
              <Text className="font-nunito-bold text-content text-center" style={{ fontSize: 13 }}>
                {a.name}
              </Text>
              <Text className="font-nunito-bold text-center" style={{ color: COLORS.textFaint, fontSize: 11, marginTop: 2 }}>
                {a.desc}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* weekly activity */}
      <View style={{ paddingHorizontal: 22, paddingTop: 22 }}>
        <SectionHead title="Активность за неделю" />
        <View
          className="rounded-[20px]"
          style={{ padding: 18, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line }}
        >
          <View className="flex-row items-end justify-between" style={{ height: 110, gap: 8 }}>
            {WEEK.map((h, i) => (
              <View key={DAYS[i] + i} className="flex-1 items-center justify-end" style={{ height: '100%', gap: 8 }}>
                {i === 5 ? (
                  <LinearGradient
                    colors={GRADIENTS.brand}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ width: '100%', height: `${h}%`, minHeight: 6, borderRadius: 8 }}
                  />
                ) : (
                  <View style={{ width: '100%', height: `${h}%`, minHeight: 6, borderRadius: 8, backgroundColor: 'rgba(182,242,61,0.25)' }} />
                )}
                <Text className="font-nunito-bold" style={{ color: COLORS.textFaint, fontSize: 11 }}>
                  {DAYS[i]}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* favorite creators */}
      <View style={{ paddingHorizontal: 22, paddingTop: 22 }}>
        <SectionHead title="Любимые авторы" action="Все" />
        <View className="gap-2.5">
          {SAMPLE_VIDEOS.slice(0, 3).map((v) => (
            <View
              key={v.id}
              className="flex-row items-center gap-3 rounded-[20px]"
              style={{ padding: 12, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line }}
            >
              <Avatar name={v.creator.name} size={44} gradient={v.creator.gradient} />
              <View className="flex-1">
                <Text className="font-nunito-x text-content" style={{ fontSize: 17 }}>
                  {v.creator.name}
                </Text>
                <Text className="font-nunito-bold" style={{ color: COLORS.textDim, fontSize: 11 }}>
                  {v.creator.followers} подписчиков
                </Text>
              </View>
              <View
                className="rounded-full"
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  backgroundColor: COLORS.surface2,
                  borderWidth: 1,
                  borderColor: COLORS.line2,
                }}
              >
                <Text className="font-nunito-x text-content" style={{ fontSize: 12 }}>
                  Открыто
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

/** A single tile in the 2×2 stats grid. */
function Stat({ icon, color, value, label }: { icon: IconName; color: string; value: string; label: string }) {
  return (
    <View
      className="rounded-[20px]"
      style={{
        flexGrow: 1,
        flexBasis: '47%',
        padding: 16,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.line,
      }}
    >
      <View className="flex-row items-center gap-2">
        <Icon name={icon} size={22} color={color} />
        <Text className="font-nunito-black text-content" style={{ fontSize: 24 }}>
          {value}
        </Text>
      </View>
      <Text className="font-nunito-bold" style={{ color: COLORS.textDim, fontSize: 13, marginTop: 4 }}>
        {label}
      </Text>
    </View>
  );
}

