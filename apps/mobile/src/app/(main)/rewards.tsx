import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useQuery } from '@rocicorp/zero/react';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip } from '@/components/chip';
import { Confetti } from '@/components/confetti';
import { Icon } from '@/components/icon';
import { Sharik } from '@/components/mascot';
import { PrimaryButton } from '@/components/primary-button';
import { SectionHead } from '@/components/section-head';
import { COLORS } from '@/constants/gav';
import { useAuth } from '@/lib/auth/auth-context';
import { COSMETICS, type Cosmetic } from '@/lib/feed/app-data';
import { useGame } from '@/lib/feed/game-context';
import { ZERO_ENABLED, useZeroApp } from '@/lib/zero/provider';
import { useCosmeticsQuery, useDailyChestClaimQuery } from '@/lib/zero/queries';
import { rollDailyLoot, type ChestCosmetic } from '@barkly/zero';

/** The prize the daily chest rewards. Rolled by the shared `rollDailyLoot`. */
type Loot = { name: string; rarity: string; id: string; color: string; gems: number };

/** Fallback loot used only when the cosmetics catalog is somehow empty. */
const FALLBACK_LOOT: Loot = { name: 'Шарф «Неон»', rarity: 'Редкое', id: 'scarf', color: COLORS.cyan, gems: 120 };

/** djb2-style string hash → positive 32-bit int, used to seed the daily roll. */
function hashString(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (h * 33) ^ str.charCodeAt(i);
  }
  return h >>> 0;
}

/** null = closed, 'shaking' = opening animation, Loot = the reveal. */
type Reveal = null | 'shaking' | Loot;

/**
 * Rewards & mascot wardrobe (a main tab). Shows the gem balance, the daily
 * loot chest, and Шарик's wardrobe of equippable cosmetics. Faithful port of
 * the design's `RewardsScreen`.
 */
export default function RewardsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { state, cosmetic, setCosmetic } = useGame();
  const z = useZeroApp();
  const [reveal, setReveal] = useState<Reveal>(null);
  const [localClaimed, setLocalClaimed] = useState(false);

  // Cosmetics catalog + ownership from Zero; falls back to the bundled
  // COSMETICS constant while the local replica is empty (no backend yet).
  const [cosmeticRows] = useQuery(useCosmeticsQuery(user?.userID ?? ''));
  const cosmetics = useMemo<Cosmetic[]>(
    () =>
      cosmeticRows.length === 0
        ? COSMETICS
        : cosmeticRows.map((c) => ({
            id: c.id as Cosmetic['id'],
            name: c.name,
            rarity: c.rarity,
            cost: c.cost ?? 0,
            owned: c.owned ?? false,
            color: c.color,
          })),
    [cosmeticRows],
  );

  // Stable calendar day captured ONCE per mount so render stays pure (no
  // non-deterministic Date read during render/useMemo bodies). This YYYY-MM-DD
  // is both the seed input and the claim row's `day` key.
  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Deterministic per-(user, day) seed: same user + same day → same loot.
  const seed = useMemo(
    () => hashString(`${user?.userID ?? 'anon'}:${todayKey}`),
    [user?.userID, todayKey],
  );

  // Daily roll (bk-cj6.27): delegate to the shared, deterministic
  // `rollDailyLoot` so the client and the authoritative server agree on the
  // loot for a given (user, day) seed. Map the screen's cosmetics into the
  // `ChestCosmetic` shape it expects, and map its `DailyLoot | null` result
  // back into the UI's `Loot` shape (id ← cosmeticId), falling back when empty.
  const dailyLoot = useMemo<Loot>(() => {
    const mapped: ChestCosmetic[] = cosmetics.map((c) => ({
      id: c.id,
      name: c.name,
      rarity: c.rarity,
      color: c.color,
      owned: c.owned,
    }));
    const loot = rollDailyLoot(mapped, seed);
    if (!loot) return FALLBACK_LOOT;
    return {
      name: loot.name,
      rarity: loot.rarity,
      id: loot.cosmeticId,
      color: loot.color,
      gems: loot.gems,
    };
  }, [cosmetics, seed]);

  // Server-authoritative one-claim-per-day gate: the chest is ready only when no
  // claim row exists for today. `localClaimed` covers the just-claimed animation
  // window before the claim row syncs back.
  const [claims] = useQuery(useDailyChestClaimQuery(user?.userID ?? ''));
  const claimedToday =
    localClaimed ||
    claims.some((c) => c.id === `${user?.userID ?? ''}:${todayKey}` || c.day === todayKey);
  const chestReady = !claimedToday;

  const openChest = () => {
    if (!chestReady) return;
    setReveal('shaking');
    setTimeout(() => setReveal(dailyLoot), 900);
  };

  const claim = () => {
    const loot = dailyLoot;
    setReveal(null);
    setLocalClaimed(true);
    setCosmetic(loot.id as Cosmetic['id']);

    // Record the claim server-side (idempotent on `${userID}:${day}`), granting
    // the cosmetic and crediting gems. Optimistic local UI updates already ran.
    if (ZERO_ENABLED && user?.userID) {
      const r = z.mutate.claimDailyChest({
        id: `${user.userID}:${todayKey}`,
        userID: user.userID,
        day: todayKey,
        cosmeticId: loot.id,
        rarity: loot.rarity,
        gems: loot.gems,
        createdAt: Date.now(),
        userGems: state.gems + loot.gems,
      });
      r.client.catch(() => {});
      r.server.catch(() => {});
    }
  };

  return (
    <View className="flex-1 bg-bg">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* balance header */}
        <View
          className="flex-row items-center justify-between"
          style={{ paddingTop: insets.top + 14, paddingHorizontal: 22, paddingBottom: 8 }}
        >
          <Text className="font-nunito-black text-content" style={{ fontSize: 27 }}>
            Призы
          </Text>
          <View
            className="flex-row items-center gap-1.5 rounded-full"
            style={{
              paddingVertical: 8,
              paddingHorizontal: 14,
              backgroundColor: 'rgba(255,216,61,0.12)',
              borderWidth: 1,
              borderColor: 'rgba(255,216,61,0.4)',
            }}
          >
            <Text style={{ fontSize: 16 }}>💎</Text>
            <Text className="font-nunito-black" style={{ color: COLORS.gold, fontSize: 16 }}>
              {state.gems.toLocaleString('ru')}
            </Text>
          </View>
        </View>

        {/* daily chest */}
        <View style={{ paddingHorizontal: 22, paddingTop: 14 }}>
          <LinearGradient
            colors={['rgba(255,216,61,0.14)', 'rgba(255,138,61,0.06)']}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={{
              borderRadius: 28,
              padding: 24,
              overflow: 'hidden',
              alignItems: 'center',
              borderWidth: 1,
              borderColor: 'rgba(255,216,61,0.3)',
            }}
          >
            <Text
              className="font-nunito-bold uppercase"
              style={{ color: COLORS.gold, fontSize: 11, letterSpacing: 0.9 }}
            >
              Ежедневный сундук
            </Text>
            <Pressable onPress={openChest} disabled={!chestReady} style={{ marginVertical: 14 }}>
              <ChestEmoji ready={chestReady} />
            </Pressable>
            <Text className="font-nunito-bold text-content" style={{ fontSize: 15 }}>
              {chestReady ? 'Тапни, чтобы открыть!' : 'Открыто! Возвращайся завтра'}
            </Text>
            <Text className="font-nunito-bold" style={{ color: COLORS.textDim, fontSize: 13, marginTop: 4 }}>
              Стрик {state.streak} дней · бонус ×2
            </Text>
          </LinearGradient>
        </View>

        {/* wardrobe preview */}
        <View style={{ paddingHorizontal: 22, paddingTop: 20 }}>
          <SectionHead title="Гардероб Шарика" />
          <View className="items-center" style={{ paddingVertical: 10, paddingBottom: 16 }}>
            <View className="items-center justify-center">
              <View
                className="absolute rounded-full"
                style={{ width: 150, height: 150, backgroundColor: 'rgba(182,242,61,0.12)' }}
              />
              <Sharik mood="happy" size={130} cosmetic={cosmetic} />
            </View>
          </View>

          <View className="flex-row flex-wrap" style={{ gap: 12 }}>
            <CosmeticCard
              active={!cosmetic}
              owned
              name="Без аксессуара"
              rarity="—"
              preview={<Sharik mood="idle" size={64} />}
              onPress={() => setCosmetic(null)}
            />
            {cosmetics.map((c) => (
              <CosmeticCard
                key={c.id}
                active={cosmetic === c.id}
                owned={c.owned}
                name={c.name}
                rarity={c.rarity}
                cost={c.cost}
                color={c.color}
                preview={<Sharik mood="idle" size={64} cosmetic={c.id} />}
                onPress={() => {
                  if (c.owned) setCosmetic(c.id);
                }}
              />
            ))}
          </View>
        </View>
      </ScrollView>

      {/* loot-box reveal overlay */}
      {reveal && <RevealOverlay reveal={reveal} onClaim={claim} />}
    </View>
  );
}

/* ----------------------------- daily chest emoji ----------------------------- */
function ChestEmoji({ ready }: { ready: boolean }) {
  const t = useSharedValue(0);

  useEffect(() => {
    if (ready) {
      t.value = withRepeat(withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }), -1, true);
    } else {
      t.value = withTiming(0, { duration: 200 });
    }
  }, [ready, t]);

  const style = useAnimatedStyle(() => ({
    opacity: ready ? 1 : 0.5,
    transform: [
      { scale: ready ? 1 + t.value * 0.08 : 0.9 },
      { rotate: ready ? `${-2 + t.value * 4}deg` : '0deg' },
    ],
  }));

  return (
    <Animated.View style={style}>
      <Text style={{ fontSize: 84, textShadowColor: 'rgba(255,216,61,0.5)', textShadowRadius: 24, textShadowOffset: { width: 0, height: 8 } }}>
        🎁
      </Text>
    </Animated.View>
  );
}

/* ----------------------------- cosmetic card ----------------------------- */
function CosmeticCard({
  active,
  owned,
  name,
  rarity,
  cost,
  color = COLORS.textFaint,
  preview,
  onPress,
}: {
  active: boolean;
  owned: boolean;
  name: string;
  rarity: string;
  cost?: number;
  color?: string;
  preview: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="overflow-hidden rounded-[20px]"
      style={{
        flexGrow: 1,
        flexBasis: '46%',
        padding: 14,
        alignItems: 'center',
        backgroundColor: active ? 'rgba(182,242,61,0.1)' : COLORS.surface,
        borderWidth: 2,
        borderColor: active ? COLORS.lime : COLORS.line,
        opacity: owned ? 1 : 0.94,
      }}
    >
      {rarity !== '—' && (
        <View
          className="absolute rounded-full"
          style={{ top: 8, right: 8, width: 8, height: 8, backgroundColor: color }}
        />
      )}
      <View className="items-center justify-center" style={{ height: 70, marginBottom: 4 }}>
        {preview}
      </View>
      <Text className="font-nunito-bold text-content" style={{ fontSize: 13 }}>
        {name}
      </Text>
      {owned ? (
        active ? (
          <Text className="font-nunito-black" style={{ color: COLORS.lime, fontSize: 11, marginTop: 4 }}>
            Надето ✓
          </Text>
        ) : (
          <Text className="font-nunito-bold" style={{ color: COLORS.textFaint, fontSize: 11, marginTop: 4 }}>
            {rarity}
          </Text>
        )
      ) : (
        <View
          className="flex-row items-center gap-1.5 rounded-full"
          style={{
            marginTop: 6,
            paddingVertical: 4,
            paddingHorizontal: 10,
            backgroundColor: COLORS.surface2,
            borderWidth: 1,
            borderColor: COLORS.line,
          }}
        >
          <Icon name="lock" size={12} color={COLORS.textFaint} />
          <Text className="font-nunito-black" style={{ color: COLORS.gold, fontSize: 12 }}>
            {cost} 💎
          </Text>
        </View>
      )}
    </Pressable>
  );
}

/* ----------------------------- loot reveal overlay ----------------------------- */
function RevealOverlay({ reveal, onClaim }: { reveal: 'shaking' | Loot; onClaim: () => void }) {
  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      className="absolute inset-0 z-[60] items-center justify-center"
      style={{ backgroundColor: 'rgba(8,8,12,0.92)', padding: 24 }}
    >
      {reveal === 'shaking' ? (
        <ShakingChest />
      ) : (
        <>
          <Confetti count={56} />
          <View className="items-center">
            <Text
              className="font-nunito-bold uppercase"
              style={{ color: reveal.color, fontSize: 11, letterSpacing: 0.9 }}
            >
              {reveal.rarity}
            </Text>
            <View
              className="items-center justify-center rounded-[36px]"
              style={{
                width: 150,
                height: 150,
                marginVertical: 14,
                backgroundColor: `${reveal.color}22`,
                borderWidth: 2,
                borderColor: reveal.color,
              }}
            >
              <Sharik mood="celebrate" size={120} cosmetic={reveal.id} />
            </View>
            <Text className="font-nunito-black text-content" style={{ fontSize: 27 }}>
              {reveal.name}
            </Text>
            <Chip className="mt-3" borderColor="rgba(255,216,61,0.4)">
              <Text style={{ fontSize: 13 }}>💎</Text>
              <Text className="font-nunito-black" style={{ color: COLORS.gold, fontSize: 12 }}>
                +{reveal.gems}
              </Text>
            </Chip>
          </View>
          <View className="w-full items-center" style={{ marginTop: 30 }}>
            <View style={{ maxWidth: 280, width: '100%' }}>
              <PrimaryButton label="Забрать и надеть" onPress={onClaim} />
            </View>
          </View>
        </>
      )}
    </Animated.View>
  );
}

function ShakingChest() {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withRepeat(
      withSequence(
        withTiming(-1, { duration: 80 }),
        withTiming(1, { duration: 80 }),
        withTiming(-0.6, { duration: 80 }),
        withTiming(0.5, { duration: 80 }),
        withTiming(0, { duration: 80 }),
      ),
      -1,
    );
  }, [t]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: t.value * 8 }] }));

  return (
    <Animated.View style={style}>
      <Text style={{ fontSize: 120 }}>🎁</Text>
    </Animated.View>
  );
}
