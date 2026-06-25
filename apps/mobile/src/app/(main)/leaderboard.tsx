import { Fragment, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@rocicorp/zero/react';

import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icon';
import { COLORS, GRADIENTS } from '@/constants/gav';
import { LEADERBOARD, type Player } from '@/lib/feed/app-data';
import { useAuth } from '@/lib/auth/auth-context';
import { useLeaderboardQuery, useLeagueQuery } from '@/lib/zero/queries';

// The leagueId the standings/league rows are keyed by. The user row carries a
// display name ("Изумрудная"), not a leagueId, so there's no clean mapping —
// we default to the seed's "emerald" league (see apps/server/src/db/seed.ts).
const DEFAULT_LEAGUE_ID = 'emerald';

const MEDALS = ['🥉', '🥈', '🥇', '💎', '👑'];
type Tab = 'league' | 'friends';

/**
 * League leaderboard tab: medal row, league title, league/friends toggle,
 * ranked rows with promotion/relegation zones, and the weekly-prize card.
 * The floating BottomNav is rendered by the (main) layout — not here.
 */
export default function LeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('league');
  const { user } = useAuth();
  const userID = user?.userID ?? '';

  // Standings (XP desc) + the league's name/countdown, both keyed by leagueId.
  const [members] = useQuery(useLeaderboardQuery(DEFAULT_LEAGUE_ID));
  const [league] = useQuery(useLeagueQuery(DEFAULT_LEAGUE_ID));

  // Map league members to the row shape the UI consumes; mark the signed-in
  // user's row as `me`. Already ordered by xp desc from the query. Fall back to
  // the bundled LEADERBOARD constant while the local replica is empty.
  const players = useMemo<Player[]>(
    () =>
      members.length === 0
        ? [...LEADERBOARD.players].sort((a, b) => b.xp - a.xp)
        : members.map((m) => ({
            name: m.name,
            xp: m.xp ?? 0,
            gradient: m.gradient,
            streak: m.streak ?? 0,
            me: m.userID === userID,
          })),
    [members, userID],
  );

  const leagueName = league?.name ?? LEADERBOARD.leagueName;
  const daysLeft = league?.daysLeft ?? LEADERBOARD.daysLeft;

  return (
    <ScrollView
      className="flex-1 bg-bg"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 120 }}
    >
      {/* league header */}
      <View style={{ paddingTop: insets.top + 24, paddingHorizontal: 22, paddingBottom: 16, alignItems: 'center' }}>
        <View className="mb-3.5 flex-row justify-center" style={{ gap: 10 }}>
          {MEDALS.map((m, i) => {
            const isHighlight = i === 3;
            const medal = (
              <Text style={{ fontSize: 18 }}>{m}</Text>
            );
            if (isHighlight) {
              return (
                <LinearGradient
                  key={i}
                  colors={GRADIENTS.brand}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', transform: [{ scale: 1.15 }] }}
                >
                  {medal}
                </LinearGradient>
              );
            }
            return (
              <View
                key={i}
                className="items-center justify-center rounded-full bg-surface-2"
                style={{ width: 38, height: 38, borderWidth: 1, borderColor: COLORS.line, opacity: i < 3 ? 0.5 : 1 }}
              >
                {medal}
              </View>
            );
          })}
        </View>
        <Text className="font-nunito-black text-content" style={{ fontSize: 27, letterSpacing: -0.5, textAlign: 'center' }}>
          {leagueName}
        </Text>
        <Text className="font-nunito-bold" style={{ color: COLORS.textDim, fontSize: 13, marginTop: 4, textAlign: 'center' }}>
          Топ-3 проходят выше · осталось {daysLeft} дня
        </Text>
      </View>

      {/* tabs */}
      <View className="flex-row" style={{ paddingHorizontal: 22, paddingTop: 4, paddingBottom: 14, gap: 8 }}>
        {([['league', 'Лига'], ['friends', 'Друзья']] as const).map(([k, label]) => {
          const active = tab === k;
          return (
            <Pressable
              key={k}
              onPress={() => setTab(k)}
              className="flex-1 items-center justify-center rounded-full"
              style={{
                paddingVertical: 11,
                backgroundColor: active ? COLORS.lime : COLORS.surface2,
                borderWidth: 1,
                borderColor: active ? COLORS.lime : COLORS.line,
              }}
            >
              <Text className="font-nunito-x" style={{ fontSize: 14, color: active ? '#08130a' : COLORS.textDim }}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* list */}
      <View style={{ paddingHorizontal: 16 }}>
        {players.map((p, i) => {
          const rank = i + 1;
          return (
            <Fragment key={p.name}>
              <PlayerRow player={p} rank={rank} />
              {rank === 3 && <ZoneDivider color={COLORS.green} label="ЗОНА ПОВЫШЕНИЯ" up />}
              {rank === players.length - 2 && <ZoneDivider color={COLORS.rose} label="ЗОНА ВЫЛЕТА" />}
            </Fragment>
          );
        })}
      </View>

      {/* weekly prize */}
      <View style={{ paddingHorizontal: 22, paddingTop: 14 }}>
        <View
          className="flex-row items-center rounded-[20px] bg-surface"
          style={{ padding: 16, gap: 14, borderWidth: 1, borderColor: COLORS.line }}
        >
          <LinearGradient
            colors={GRADIENTS.reward}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="gift" size={26} color="#3a1c02" />
          </LinearGradient>
          <View className="flex-1">
            <Text className="font-nunito-x text-content" style={{ fontSize: 17 }}>
              Приз недели
            </Text>
            <Text className="font-nunito-bold" style={{ color: COLORS.textDim, fontSize: 13, marginTop: 2 }}>
              Легендарный скин + 500 💎 за топ-3
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function PlayerRow({ player, rank }: { player: Player; rank: number }) {
  const top3 = rank <= 3;
  return (
    <View
      className="flex-row items-center rounded-[20px]"
      style={{
        gap: 12,
        padding: 12,
        marginBottom: 6,
        backgroundColor: player.me ? 'rgba(182,242,61,0.1)' : 'transparent',
        borderWidth: 1.5,
        borderColor: player.me ? COLORS.lime : 'transparent',
      }}
    >
      <Text
        className="font-nunito-black text-center"
        style={{ width: 28, fontSize: 16, color: top3 ? COLORS.gold : COLORS.textDim }}
      >
        {rank}
      </Text>
      <Avatar name={player.name} size={44} gradient={player.gradient} ring={top3} />
      <View className="flex-1">
        <View className="flex-row items-center" style={{ gap: 6 }}>
          <Text className="font-nunito-x text-content" style={{ fontSize: 17 }}>
            {player.name}
          </Text>
          {player.me && (
            <Text className="font-nunito-bold" style={{ fontSize: 11, color: COLORS.lime }}>
              · ты
            </Text>
          )}
        </View>
        <View className="flex-row items-center" style={{ gap: 4, marginTop: 2 }}>
          <Icon name="fire" size={13} color={COLORS.flame} />
          <Text className="font-nunito-bold" style={{ fontSize: 11, color: COLORS.textDim }}>
            {player.streak} дней
          </Text>
        </View>
      </View>
      <View className="flex-row items-center" style={{ gap: 5 }}>
        <Icon name="bolt" size={16} color={COLORS.gold} />
        <Text className="font-nunito-x" style={{ fontSize: 17, color: COLORS.gold }}>
          {player.xp.toLocaleString('ru')}
        </Text>
      </View>
    </View>
  );
}

function ZoneDivider({ color, label, up = false }: { color: string; label: string; up?: boolean }) {
  return (
    <View className="flex-row items-center" style={{ gap: 10, marginHorizontal: 4, marginTop: 8, marginBottom: 12 }}>
      <LinearGradient
        colors={['transparent', color]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ flex: 1, height: 2, borderRadius: 2 }}
      />
      <View className="flex-row items-center" style={{ gap: 4 }}>
        <View style={{ transform: [{ rotate: up ? '-90deg' : '90deg' }] }}>
          <Icon name="chevR" size={14} color={color} />
        </View>
        <Text
          className="font-nunito-black uppercase"
          style={{ fontSize: 11, color, letterSpacing: 0.08 * 11 }}
        >
          {label}
        </Text>
      </View>
      <LinearGradient
        colors={[color, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ flex: 1, height: 2, borderRadius: 2 }}
      />
    </View>
  );
}
