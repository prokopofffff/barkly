import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Confetti } from '@/components/confetti';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { Sharik } from '@/components/mascot';
import { PrimaryButton } from '@/components/primary-button';
import { XPBar } from '@/components/xp-bar';
import { COLORS } from '@/constants/gav';
import type { VocabWord } from '@/lib/feed/app-data';
import { useGame } from '@/lib/feed/game-context';

type FilterKey = 'all' | 'word' | 'phrase' | 'review';

const FILTERS: [FilterKey, string][] = [
  ['all', 'Все'],
  ['word', 'Слова'],
  ['phrase', 'Фразы'],
  ['review', 'На повторении'],
];

/**
 * Словарь — saved words & phrases, with stats, a filterable list of expandable
 * cards, and a full-screen flashcard review overlay. Pushed route (no nav bar).
 */
export default function VocabularyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { savedWords, earn, masterWord } = useGame();

  const [filter, setFilter] = useState<FilterKey>('all');
  const [review, setReview] = useState(false);

  const reviewSet = savedWords.filter((w) => w.mastery < 3);
  const learned = savedWords.filter((w) => w.mastery >= 3).length;
  const filtered =
    filter === 'all'
      ? savedWords
      : filter === 'review'
        ? reviewSet
        : savedWords.filter((w) => w.type === filter);

  return (
    <View className="flex-1 bg-bg">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* header */}
        <View className="flex-row items-center gap-3 px-[22px] pb-3" style={{ paddingTop: insets.top + 16 }}>
          <IconButton icon="chevL" onPress={() => router.back()} />
          <View className="flex-1">
            <Text className="font-nunito-bold uppercase text-content-dim" style={{ fontSize: 11, letterSpacing: 1 }}>
              Словарь
            </Text>
            <Text className="font-nunito-x text-content" style={{ fontSize: 27 }}>
              Мои слова
            </Text>
          </View>
        </View>

        {/* stats */}
        <View className="flex-row gap-2.5 px-[22px]" style={{ marginBottom: 16 }}>
          <VStat value={savedWords.length} label="всего" color={COLORS.text} />
          <VStat value={reviewSet.length} label="на повторении" color={COLORS.flame} />
          <VStat value={learned} label="выучено" color={COLORS.green} />
        </View>

        {/* review hero */}
        {reviewSet.length > 0 && (
          <View className="px-[22px]" style={{ marginBottom: 18 }}>
            <View
              className="flex-row items-center gap-3.5 overflow-hidden rounded-[28px]"
              style={{
                padding: 18,
                backgroundColor: 'rgba(182,242,61,0.1)',
                borderWidth: 1,
                borderColor: 'rgba(182,242,61,0.3)',
              }}
            >
              <Sharik mood="happy" size={78} cosmetic="glasses" />
              <View className="flex-1">
                <Text className="font-nunito-x text-content" style={{ fontSize: 17 }}>
                  Повтори {reviewSet.length} слов
                </Text>
                <Text className="font-nunito-bold text-content-dim" style={{ fontSize: 13, marginTop: 3, marginBottom: 10 }}>
                  5 минут — и они в долгой памяти 🧠
                </Text>
                <Pressable
                  onPress={() => setReview(true)}
                  className="flex-row items-center gap-1.5 self-start rounded-[20px]"
                  style={{ backgroundColor: COLORS.lime, paddingVertical: 10, paddingHorizontal: 18 }}
                >
                  <Icon name="cards" size={18} color="#08130a" />
                  <Text className="font-nunito-black" style={{ color: '#08130a', fontSize: 14 }}>
                    Карточки
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 22, paddingBottom: 14 }}
        >
          {FILTERS.map(([k, t]) => {
            const active = filter === k;
            return (
              <Pressable
                key={k}
                onPress={() => setFilter(k)}
                className="rounded-full"
                style={{
                  paddingVertical: 9,
                  paddingHorizontal: 15,
                  backgroundColor: active ? COLORS.lime : COLORS.surface2,
                  borderWidth: 1,
                  borderColor: active ? COLORS.lime : COLORS.line,
                }}
              >
                <Text className="font-nunito-x" style={{ fontSize: 13, color: active ? '#08130a' : COLORS.textDim }}>
                  {t}
                  {k === 'review' && reviewSet.length ? ` · ${reviewSet.length}` : ''}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* list */}
        <View className="gap-2.5 px-[22px]">
          {filtered.map((w) => (
            <WordCard key={w.en} w={w} />
          ))}
          {filtered.length === 0 && (
            <View className="items-center" style={{ paddingVertical: 30 }}>
              <Sharik mood="sleep" size={90} />
              <Text className="font-nunito-semibold text-content-dim" style={{ fontSize: 15, marginTop: 8 }}>
                Здесь пока пусто
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {review && (
        <FlashcardReview
          cards={reviewSet}
          onClose={() => setReview(false)}
          onEarn={earn}
          onMaster={masterWord}
        />
      )}
    </View>
  );
}

/* ----------------------- mastery dots ----------------------- */
function MasteryDots({ level }: { level: number }) {
  return (
    <View className="flex-row gap-[3px]">
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: i < level ? COLORS.lime : 'rgba(255,255,255,0.16)',
          }}
        />
      ))}
    </View>
  );
}

/* ----------------------- stat tile ----------------------- */
function VStat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <View
      className="flex-1 items-center rounded-[14px] bg-surface"
      style={{ paddingVertical: 12, paddingHorizontal: 10, borderWidth: 1, borderColor: COLORS.line }}
    >
      <Text className="font-nunito-x" style={{ fontSize: 24, color }}>
        {value}
      </Text>
      <Text className="font-nunito-bold text-content-faint" style={{ fontSize: 11, marginTop: 2 }}>
        {label}
      </Text>
    </View>
  );
}

/* ----------------------- word card ----------------------- */
function WordCard({ w }: { w: VocabWord }) {
  const [open, setOpen] = useState(false);
  const isPhrase = w.type === 'phrase';

  return (
    <Pressable
      onPress={() => setOpen((o) => !o)}
      className="rounded-[20px] bg-surface"
      style={{ padding: 16, borderWidth: 1, borderColor: COLORS.line }}
    >
      <View className="flex-row items-center gap-2.5">
        <Pressable
          onPress={() => {}}
          className="items-center justify-center rounded-[10px] bg-surface-2"
          style={{ width: 34, height: 34, flexShrink: 0 }}
        >
          <Icon name="sound" size={18} color={COLORS.lime} />
        </Pressable>
        <View className="flex-1" style={{ minWidth: 0 }}>
          <View className="flex-row items-center gap-2">
            <Text className="font-nunito-x text-content" style={{ fontSize: 17 }}>
              {w.en}
            </Text>
            <View
              className="rounded-full"
              style={{
                paddingVertical: 2,
                paddingHorizontal: 8,
                backgroundColor: isPhrase ? 'rgba(192,132,252,0.18)' : 'rgba(52,227,255,0.16)',
              }}
            >
              <Text className="font-nunito-x" style={{ fontSize: 11, color: isPhrase ? COLORS.violet : COLORS.cyan }}>
                {isPhrase ? 'фраза' : 'слово'}
              </Text>
            </View>
          </View>
          <Text className="font-nunito-bold text-content-dim" style={{ fontSize: 13, marginTop: 2 }}>
            {w.ru}
          </Text>
        </View>
        <MasteryDots level={w.mastery} />
      </View>

      {open && (
        <Animated.View
          entering={FadeIn.duration(300)}
          style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderColor: COLORS.line }}
        >
          <View className="rounded-[10px] bg-surface-2" style={{ paddingVertical: 10, paddingHorizontal: 12 }}>
            <Text className="font-mono text-content" style={{ fontSize: 13, lineHeight: 18 }}>
              “{w.example}”
            </Text>
          </View>
          <View className="flex-row items-center gap-1.5" style={{ marginTop: 10 }}>
            <Icon name="play" size={12} color={COLORS.textFaint} />
            <Text className="font-nunito-bold text-content-faint" style={{ fontSize: 11 }}>
              из: {w.source}
            </Text>
          </View>
        </Animated.View>
      )}
    </Pressable>
  );
}

/* ----------------------- flashcard review ----------------------- */
function FlashcardReview({
  cards,
  onClose,
  onEarn,
  onMaster,
}: {
  cards: VocabWord[];
  onClose: () => void;
  onEarn: (amount: number, combo: number) => void;
  onMaster: (en: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(false);
  const [knownCount, setKnownCount] = useState(0);

  const card = cards[i];

  const answer = (known: boolean) => {
    if (known) {
      onEarn(10, 1);
      onMaster(card.en);
      setKnownCount((c) => c + 1);
    }
    if (i + 1 >= cards.length) {
      setDone(true);
    } else {
      setI(i + 1);
      setFlipped(false);
    }
  };

  return (
    <Animated.View entering={FadeIn.duration(250)} className="absolute inset-0 z-[60] bg-bg">
      <LinearGradient
        colors={['rgba(182,242,61,0.14)', COLORS.bg]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.6 }}
        style={{ position: 'absolute', inset: 0 }}
      />

      {/* top bar */}
      <View className="flex-row items-center gap-3 px-[18px] pb-2" style={{ paddingTop: insets.top + 16 }}>
        <Pressable
          onPress={onClose}
          className="h-9 w-9 items-center justify-center rounded-full bg-surface-2"
        >
          <Icon name="x" size={18} color={COLORS.textDim} />
        </Pressable>
        <View className="flex-1">
          <XPBar value={done ? cards.length : i} max={cards.length} height={8} gradient="brand" />
        </View>
        <Text className="font-nunito-bold text-content-dim" style={{ fontSize: 13, minWidth: 40, textAlign: 'right' }}>
          {done ? cards.length : i + 1}/{cards.length}
        </Text>
      </View>

      {done ? (
        <View className="flex-1 items-center justify-center" style={{ padding: 24 }}>
          <Confetti count={36} />
          <Sharik mood="celebrate" size={150} cosmetic="crown" />
          <Text className="font-nunito-black" style={{ fontSize: 34, marginTop: 8, color: COLORS.lime }}>
            Повторено!
          </Text>
          <Text className="font-nunito-semibold text-content-dim" style={{ fontSize: 15, marginTop: 8, textAlign: 'center' }}>
            Ты вспомнил <Text className="text-content">{knownCount}</Text> из {cards.length} слов
          </Text>
          <PrimaryButton label="Готово" onPress={onClose} className="mt-[26px] max-w-[260px]" />
        </View>
      ) : (
        <>
          {/* flip card */}
          <View className="flex-1 items-center justify-center" style={{ paddingVertical: 8, paddingHorizontal: 28 }}>
            <Pressable
              onPress={() => setFlipped((f) => !f)}
              className="w-full items-center justify-center gap-3.5 rounded-[36px]"
              style={{
                minHeight: 300,
                padding: 28,
                backgroundColor: flipped ? COLORS.surface2 : COLORS.surface,
                borderWidth: 1.5,
                borderColor: flipped ? COLORS.lime : COLORS.line2,
                shadowColor: '#000',
                shadowOpacity: 0.4,
                shadowRadius: 50,
                shadowOffset: { width: 0, height: 20 },
              }}
            >
              <Text className="font-nunito-bold uppercase text-content-faint" style={{ fontSize: 11, letterSpacing: 1 }}>
                {flipped ? 'перевод' : 'нажми, чтобы перевернуть'}
              </Text>
              {!flipped ? (
                <>
                  <Text className="font-nunito-black text-content" style={{ fontSize: 34, textAlign: 'center', lineHeight: 36 }}>
                    {card.en}
                  </Text>
                  <View className="flex-row items-center gap-1.5">
                    <Icon name="sound" size={18} color={COLORS.textFaint} />
                    <Text className="font-nunito-bold text-content-faint" style={{ fontSize: 13 }}>
                      прослушать
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <Text className="font-nunito-x" style={{ fontSize: 27, textAlign: 'center', color: COLORS.lime }}>
                    {card.ru}
                  </Text>
                  <Text className="font-mono text-content-dim" style={{ fontSize: 13, textAlign: 'center', lineHeight: 18 }}>
                    “{card.example}”
                  </Text>
                </>
              )}
            </Pressable>
          </View>

          {/* actions */}
          <View
            className="flex-row gap-2.5 px-[22px]"
            style={{ paddingTop: 8, paddingBottom: insets.bottom + 28 }}
          >
            <Pressable
              onPress={() => answer(false)}
              className="flex-1 items-center justify-center rounded-[20px] bg-surface-2"
              style={{ paddingVertical: 16, borderWidth: 1, borderColor: COLORS.line2 }}
            >
              <Text className="font-nunito-black text-content" style={{ fontSize: 16 }}>
                Ещё учу
              </Text>
            </Pressable>
            <View className="flex-1">
              <PrimaryButton label="Знаю! +10" onPress={() => answer(true)} />
            </View>
          </View>
        </>
      )}
    </Animated.View>
  );
}
