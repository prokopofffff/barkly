import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { Sharik } from '@/components/mascot';
import { PrimaryButton } from '@/components/primary-button';
import { COLORS, GRADIENTS } from '@/constants/gav';
import { seededShuffle } from '@/lib/feed/prng';
import type { Quiz } from '@/lib/feed/sample-videos';

type Props = {
  quiz: Quiz;
  onClose: () => void;
  /** Called when the learner taps through the feedback screen. */
  onResult: (correct: boolean, xp: number) => void;
};

const TYPE_LABEL: Record<Quiz['type'], string> = {
  mc: 'Выбери ответ',
  meaning: 'Что он имел в виду?',
  fill: 'Заполни пропуск',
  reorder: 'Собери фразу',
};

/** Bottom-sheet quiz: mc / meaning / fill / reorder, then a feedback panel. */
export function QuizSheet({ quiz, onClose, onResult }: Props) {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<'q' | 'feedback'>('q');
  const [correct, setCorrect] = useState(false);
  const [sel, setSel] = useState<number | null>(null); // mc / meaning / fill
  const [order, setOrder] = useState<string[]>([]); // reorder
  const initialBank = useMemo(
    () => (quiz.type === 'reorder' ? seededShuffle(quiz.words, quiz.prompt.length + quiz.xp) : []),
    [quiz],
  );
  const [bank, setBank] = useState<string[]>(initialBank);

  const canSubmit = quiz.type === 'reorder' ? order.length === quiz.words.length : sel !== null;

  const submit = () => {
    const ok =
      quiz.type === 'reorder' ? JSON.stringify(order) === JSON.stringify(quiz.answer) : sel === quiz.answer;
    setCorrect(ok);
    setPhase('feedback');
  };

  return (
    <View className="absolute inset-0 z-50 justify-end">
      <AnimatedBackdrop onPress={onClose} />

      <Animated.View
        entering={SlideInDown.duration(380)}
        className="bg-surface"
        style={{
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          borderTopWidth: 1,
          borderColor: COLORS.line2,
          paddingHorizontal: 18,
          paddingTop: 14,
          // Clear the floating BottomNav (absolute, ~59px + safe-area) so the
          // "Проверить" / reward button is never hidden behind it.
          paddingBottom: Math.max(insets.bottom, 12) + 76,
        }}
      >
        <View className="mb-4 h-[5px] w-10 self-center rounded-full" style={{ backgroundColor: COLORS.line2 }} />

        {/* header */}
        <View className="mb-4 flex-row items-center gap-2.5">
          <LinearGradient
            colors={GRADIENTS.brand}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="sparkle" size={20} color="#08130a" />
          </LinearGradient>
          <View className="flex-1">
            <Text className="font-nunito-x uppercase" style={{ color: COLORS.lime, fontSize: 11, letterSpacing: 0.5 }}>
              {TYPE_LABEL[quiz.type]}
            </Text>
            <Text className="font-nunito-x text-content" style={{ fontSize: 17 }}>
              {quiz.prompt}
            </Text>
          </View>
          <Pressable onPress={onClose} className="h-8 w-8 items-center justify-center rounded-full bg-surface-2">
            <Icon name="x" size={18} color={COLORS.textDim} />
          </Pressable>
        </View>

        {phase === 'q' ? (
          <Animated.View entering={FadeIn.duration(300)}>
            {(quiz.type === 'mc' || quiz.type === 'meaning') && (
              <View className="gap-2.5">
                {quiz.options.map((o, i) => (
                  <OptionRow key={i} label={o} selected={sel === i} onPress={() => setSel(i)} />
                ))}
              </View>
            )}

            {quiz.type === 'fill' && (
              <View>
                <View
                  className="mb-4 flex-row flex-wrap items-center gap-1.5 rounded-[14px] bg-surface-2"
                  style={{ padding: 16 }}
                >
                  {quiz.sentence.map((s, i) =>
                    s === '___' ? (
                      <View
                        key={i}
                        className="items-center justify-center rounded-[9px]"
                        style={{ minWidth: 76, height: 34, borderWidth: 2, borderColor: COLORS.lime, borderStyle: 'dashed', paddingHorizontal: 10 }}
                      >
                        <Text className="font-nunito-x" style={{ color: COLORS.lime, fontSize: 18 }}>
                          {sel !== null ? quiz.choices[sel] : ''}
                        </Text>
                      </View>
                    ) : (
                      <Text key={i} className="font-nunito-x text-content" style={{ fontSize: 18 }}>
                        {s}
                      </Text>
                    ),
                  )}
                </View>
                <View className="flex-row flex-wrap gap-2">
                  {quiz.choices.map((c, i) => (
                    <ChoiceChip key={i} label={c} active={sel === i} onPress={() => setSel(i)} />
                  ))}
                </View>
              </View>
            )}

            {quiz.type === 'reorder' && (
              <View>
                <View
                  className="mb-2 min-h-[56px] flex-row flex-wrap items-center gap-2 rounded-[14px] bg-surface-2"
                  style={{ padding: 12, borderBottomWidth: 2, borderColor: COLORS.lime }}
                >
                  {order.length === 0 && (
                    <Text className="font-nunito-bold" style={{ color: COLORS.textFaint, fontSize: 13 }}>
                      Нажимай слова ниже ↓
                    </Text>
                  )}
                  {order.map((w, i) => (
                    <ChoiceChip
                      key={`${w}-${i}`}
                      label={w}
                      active
                      onPress={() => {
                        setOrder(order.filter((_, x) => x !== i));
                        setBank([...bank, w]);
                      }}
                    />
                  ))}
                </View>
                <View className="min-h-[44px] flex-row flex-wrap gap-2">
                  {bank.map((w, i) => (
                    <ChoiceChip
                      key={`${w}-${i}`}
                      label={w}
                      active={false}
                      onPress={() => {
                        setBank(bank.filter((_, x) => x !== i));
                        setOrder([...order, w]);
                      }}
                    />
                  ))}
                </View>
              </View>
            )}

            <PrimaryButton label="Проверить" disabled={!canSubmit} onPress={submit} className="mt-5" />
          </Animated.View>
        ) : (
          <Animated.View entering={FadeIn.duration(320)}>
            <View
              className="mb-3.5 flex-row items-center gap-3.5 rounded-[20px]"
              style={{
                padding: 14,
                backgroundColor: correct ? 'rgba(84,224,138,0.12)' : 'rgba(255,107,129,0.12)',
                borderWidth: 1,
                borderColor: correct ? 'rgba(84,224,138,0.4)' : 'rgba(255,107,129,0.4)',
              }}
            >
              <Sharik mood={correct ? 'celebrate' : 'sad'} size={66} />
              <View className="flex-1">
                <Text className="font-nunito-x" style={{ color: correct ? COLORS.green : COLORS.rose, fontSize: 21 }}>
                  {correct ? 'Гав! Верно 🎉' : 'Почти!'}
                </Text>
                <Text className="font-nunito-bold" style={{ color: COLORS.textDim, fontSize: 13, marginTop: 2 }}>
                  {correct ? `+${quiz.xp} XP заработано` : 'Шарик расстроился, но мы запомним'}
                </Text>
              </View>
            </View>

            <View className="mb-4 rounded-[20px] bg-surface-2" style={{ padding: 14 }}>
              <Text className="font-nunito-x uppercase" style={{ color: COLORS.textDim, fontSize: 11, marginBottom: 6, letterSpacing: 0.5 }}>
                Объяснение
              </Text>
              <Text className="font-nunito-semibold text-content" style={{ fontSize: 15, lineHeight: 21 }}>
                {quiz.explain}
              </Text>
            </View>

            <PrimaryButton
              label={correct ? 'Забрать награду' : 'Продолжить'}
              onPress={() => onResult(correct, correct ? quiz.xp : 0)}
            />
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}

function AnimatedBackdrop({ onPress }: { onPress: () => void }) {
  return (
    <Animated.View entering={FadeIn.duration(250)} style={{ position: 'absolute', inset: 0 }}>
      <Pressable onPress={onPress} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} />
    </Animated.View>
  );
}

function OptionRow({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="w-full flex-row items-center gap-3 rounded-[14px]"
      style={{
        padding: 14,
        backgroundColor: selected ? 'rgba(182,242,61,0.1)' : COLORS.surface2,
        borderWidth: 1.5,
        borderColor: selected ? COLORS.lime : COLORS.line,
      }}
    >
      <View
        className="items-center justify-center rounded-[8px]"
        style={{
          width: 26,
          height: 26,
          borderWidth: 2,
          borderColor: selected ? COLORS.lime : COLORS.line2,
          backgroundColor: selected ? COLORS.lime : 'transparent',
        }}
      >
        {selected && <Icon name="check" size={16} color="#08130a" />}
      </View>
      <Text className="font-nunito-x text-content" style={{ fontSize: 15, flexShrink: 1 }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Word-token button used by the fill / reorder quiz types. */
function ChoiceChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="rounded-[12px]"
      style={{
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: active ? COLORS.lime : COLORS.surface2,
        borderWidth: 1.5,
        borderColor: active ? COLORS.lime : COLORS.line2,
      }}
    >
      <Text className="font-nunito-x" style={{ fontSize: 15, color: active ? '#08130a' : COLORS.text }}>
        {label}
      </Text>
    </Pressable>
  );
}

