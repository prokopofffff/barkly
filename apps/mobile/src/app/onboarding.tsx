import type { ReactNode } from 'react';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { Chip } from '@/components/chip';
import { Confetti } from '@/components/confetti';
import { Icon } from '@/components/icon';
import { Sharik } from '@/components/mascot';
import { PrimaryButton } from '@/components/primary-button';
import { COLORS } from '@/constants/gav';
import { useAuth } from '@/lib/auth/auth-context';
import { useGame } from '@/lib/feed/game-context';
import { useLocalProfile } from '@/lib/profile/local-profile';
import { ZERO_ENABLED, useZeroApp } from '@/lib/zero/provider';

const STEPS = 5;

// Friendly self-assessment — maps to a starting ELO server-side (no CEFR shown).
// Keys must match ELO_SEED in apps/server/src/domain/lessons/elo.ts.
const LEVELS = [
  { k: 'only_starting', t: 'Только начинаю', d: 'Знаю пару слов', e: '🌱' },
  { k: 'knows_basics', t: 'Знаю основы', d: 'Понимаю простые фразы', e: '🌿' },
  { k: 'intermediate', t: 'Средний уровень', d: 'Смотрю с субтитрами', e: '🌳' },
  { k: 'confident', t: 'Уверенно понимаю', d: 'Свободно общаюсь', e: '🚀' },
  { k: 'fluent', t: 'Свободно', d: 'Почти как родной', e: '🦅' },
] as const;

const GOALS = [
  { k: 'travel', t: 'Путешествия', e: '✈️' },
  { k: 'work', t: 'Работа и карьера', e: '💼' },
  { k: 'media', t: 'Сериалы без субтитров', e: '🍿' },
  { k: 'friends', t: 'Общение с друзьями', e: '💬' },
  { k: 'school', t: 'Учёба / экзамены', e: '🎓' },
] as const;

const TARGETS = [
  { v: 5, t: 'Чилл', d: '5 мин — 1 видео-урок' },
  { v: 10, t: 'Норм', d: '10 мин в день' },
  { v: 20, t: 'Серьёзно', d: '20 мин — рекомендуем' },
  { v: 30, t: 'Хардкор', d: '30 мин — стрик-машина' },
] as const;

const INTRO_CHIPS = ['🎬 Сцены', '😂 Мемы', '🎤 Интервью', '📚 Мини-уроки'];

const CTA_LABEL = ['Поехали 🐾', 'Продолжить', 'Продолжить', 'Продолжить', 'Забрать и начать'];

/** The 5-step swipe onboarding — a full-screen pushed route (no nav bar). */
export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { earn } = useGame();
  const { user } = useAuth();
  const z = useZeroApp();
  const { completeOnboarding } = useLocalProfile();

  const [step, setStep] = useState(0);
  const [level, setLevel] = useState<string | null>(null);
  const [goals, setGoals] = useState<string[]>([]);
  const [target, setTarget] = useState(20);

  const toggleGoal = (g: string) =>
    setGoals((gs) => (gs.includes(g) ? gs.filter((x) => x !== g) : [...gs, g]));

  const canNext = step === 1 ? !!level : step === 2 ? goals.length > 0 : true;

  const next = () => {
    if (step < STEPS - 1) {
      setStep(step + 1);
    } else {
      // Persist the answers + flip `onboarded` (this is what the gate reads),
      // then award the starter bonus and drop into the feed.
      const prefs = { level: level ?? '', goals, target };
      completeOnboarding(prefs);
      earn(50, 1);
      // Sync the answers to the user row when a backend is wired (the +50 XP
      // bonus rides on earnXp above, so completeOnboarding stays XP-free).
      if (ZERO_ENABLED && user?.userID) {
        const r = z.mutate.completeOnboarding({
          userID: user.userID,
          learningLang: 'en',
          learningLevel: prefs.level,
          goals: prefs.goals,
          dailyTarget: prefs.target,
        });
        r.client.catch(() => {});
        r.server.catch(() => {});
      }
      router.replace('/');
    }
  };

  return (
    <View
      className="flex-1 bg-bg"
      style={{
        // radial brand wash up top — approximated as a flat dark base.
        backgroundColor: COLORS.bg,
      }}
    >
      {/* progress */}
      <View className="flex-row gap-1.5 px-[22px] pb-2" style={{ paddingTop: insets.top + 18 }}>
        {Array.from({ length: STEPS }).map((_, i) => (
          <View
            key={i}
            className="h-[5px] flex-1 rounded-full"
            style={{ backgroundColor: i <= step ? COLORS.lime : 'rgba(255,255,255,0.12)' }}
          />
        ))}
      </View>

      <ScrollView
        key={step}
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInUp.duration(420)}>
          {step === 0 && (
            <View className="items-center" style={{ paddingTop: 24 }}>
              <Sharik mood="happy" size={180} cosmetic="cap" />
              <Text className="font-nunito-black text-content" style={{ fontSize: 34, lineHeight: 35, marginTop: 12, textAlign: 'center' }}>
                Привет, я Шарик!
              </Text>
              <Text
                className="font-nunito-semibold text-content-dim"
                style={{ fontSize: 15, lineHeight: 21, marginTop: 12, maxWidth: 300, textAlign: 'center' }}
              >
                Смотри короткие видео на английском и учись, сам того не замечая. Это как лента, только ты становишься
                умнее 🐶
              </Text>
              <View className="flex-row flex-wrap justify-center gap-2" style={{ marginTop: 22 }}>
                {INTRO_CHIPS.map((t) => (
                  <Chip key={t}>
                    <Text className="font-nunito-x text-content" style={{ fontSize: 12 }}>
                      {t}
                    </Text>
                  </Chip>
                ))}
              </View>
            </View>
          )}

          {step === 1 && (
            <OnbStep title="Какой у тебя уровень?" sub="Подберём видео под тебя — не слишком легко, не слишком сложно.">
              {LEVELS.map((o) => (
                <PickRow
                  key={o.k}
                  on={level === o.k}
                  onPress={() => setLevel(o.k)}
                  emoji={o.e}
                  title={o.t}
                  desc={o.d}
                />
              ))}
            </OnbStep>
          )}

          {step === 2 && (
            <OnbStep title="Зачем учишь английский?" sub="Можно выбрать несколько.">
              {GOALS.map((o) => (
                <PickRow key={o.k} on={goals.includes(o.k)} onPress={() => toggleGoal(o.k)} emoji={o.e} title={o.t} check />
              ))}
            </OnbStep>
          )}

          {step === 3 && (
            <OnbStep title="Сколько минут в день?" sub="Маленькие шаги формируют большой стрик 🔥">
              <View className="items-center" style={{ marginTop: 10, marginBottom: 22 }}>
                <Text style={{ textAlign: 'center' }}>
                  <Text className="font-nunito-black" style={{ fontSize: 64, color: COLORS.lime }}>
                    {target}
                  </Text>
                  <Text className="font-nunito-x text-content-dim" style={{ fontSize: 21 }}>
                    {' '}
                    мин
                  </Text>
                </Text>
              </View>
              {TARGETS.map((o) => (
                <PickRow
                  key={o.v}
                  on={target === o.v}
                  onPress={() => setTarget(o.v)}
                  title={o.t}
                  desc={o.d}
                  badge={`${o.v}м`}
                />
              ))}
            </OnbStep>
          )}

          {step === 4 && (
            <View className="items-center" style={{ paddingTop: 16 }}>
              <Confetti count={36} />
              <Sharik mood="celebrate" size={170} cosmetic="crown" />
              <Text className="font-nunito-black text-content" style={{ fontSize: 34, lineHeight: 35, marginTop: 10, textAlign: 'center' }}>
                Всё готово!
              </Text>
              <Text
                className="font-nunito-semibold text-content-dim"
                style={{ fontSize: 15, lineHeight: 21, marginTop: 10, maxWidth: 290, textAlign: 'center' }}
              >
                Твой план: <Text className="text-content">{target} мин в день</Text>. Заработай первые XP прямо сейчас.
              </Text>
              <View
                className="flex-row items-center gap-2 rounded-full"
                style={{
                  marginTop: 20,
                  paddingVertical: 12,
                  paddingHorizontal: 18,
                  backgroundColor: 'rgba(255,216,61,0.12)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,216,61,0.4)',
                }}
              >
                <Icon name="bolt" size={22} color={COLORS.gold} />
                <Text className="font-nunito-x" style={{ fontSize: 17, color: COLORS.gold }}>
                  +50 XP стартовый бонус
                </Text>
              </View>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      <View
        className="px-[22px]"
        style={{ paddingTop: 12, paddingBottom: insets.bottom + 28 }}
      >
        {step > 0 && step < 4 && (
          <Pressable onPress={() => setStep(step - 1)} className="self-center" style={{ marginBottom: 10 }}>
            <Text className="font-nunito-x text-content-dim" style={{ fontSize: 13 }}>
              Назад
            </Text>
          </Pressable>
        )}
        <PrimaryButton label={CTA_LABEL[step]} onPress={next} disabled={!canNext} />
      </View>
    </View>
  );
}

function OnbStep({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <View>
      <Text className="font-nunito-black text-content" style={{ fontSize: 27, lineHeight: 30, marginTop: 8 }}>
        {title}
      </Text>
      <Text className="font-nunito-semibold text-content-dim" style={{ fontSize: 15, lineHeight: 21, marginTop: 8, marginBottom: 18 }}>
        {sub}
      </Text>
      <View className="gap-2.5">{children}</View>
    </View>
  );
}

function PickRow({
  on,
  onPress,
  emoji,
  title,
  desc,
  badge,
  check,
}: {
  on: boolean;
  onPress: () => void;
  emoji?: string;
  title: string;
  desc?: string;
  badge?: string;
  check?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="w-full flex-row items-center gap-3.5 rounded-[20px]"
      style={{
        padding: 16,
        backgroundColor: on ? 'rgba(182,242,61,0.1)' : COLORS.surface,
        borderWidth: 2,
        borderColor: on ? COLORS.lime : COLORS.line,
      }}
    >
      {emoji && <Text style={{ fontSize: 26 }}>{emoji}</Text>}
      <View className="flex-1">
        <Text className="font-nunito-x text-content" style={{ fontSize: 17 }}>
          {title}
        </Text>
        {desc && (
          <Text className="font-nunito-bold text-content-dim" style={{ fontSize: 13, marginTop: 2 }}>
            {desc}
          </Text>
        )}
      </View>
      {badge && (
        <View
          className="rounded-full"
          style={{
            paddingVertical: 6,
            paddingHorizontal: 12,
            backgroundColor: on ? COLORS.lime : COLORS.surface2,
          }}
        >
          <Text className="font-nunito-x" style={{ fontSize: 12, color: on ? '#08130a' : COLORS.textDim }}>
            {badge}
          </Text>
        </View>
      )}
      {check && (
        <View
          className="items-center justify-center rounded-[8px]"
          style={{
            width: 26,
            height: 26,
            borderWidth: 2,
            borderColor: on ? COLORS.lime : COLORS.line2,
            backgroundColor: on ? COLORS.lime : 'transparent',
          }}
        >
          {on && <Icon name="check" size={16} color="#08130a" />}
        </View>
      )}
    </Pressable>
  );
}
