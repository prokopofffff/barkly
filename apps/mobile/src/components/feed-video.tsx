import { LinearGradient } from 'expo-linear-gradient';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { Chip } from '@/components/chip';
import { FloatXp, type FloatItem } from '@/components/float-xp';
import { Icon } from '@/components/icon';
import { Sharik } from '@/components/mascot';
import { RailButton } from '@/components/rail-button';
import { StreakBadge } from '@/components/streak-badge';
import { YouTubeShort } from '@/components/youtube-short';
import { COLORS, GRADIENTS } from '@/constants/gav';
import type { FeedVideoItem, SubtitleToken } from '@/lib/feed/sample-videos';

/** Vocabulary entry produced when a learner saves a subtitle word. */
export type SavedWord = {
  en: string;
  ru: string;
  type: 'word' | 'phrase';
  source: string;
  example: string;
};

type FeedState = { streak: number; xpToday: number; combo: number };

type Props = {
  item: FeedVideoItem;
  isActive: boolean;
  height: number;
  state: FeedState;
  autoNudge?: boolean;
  onQuiz: () => void;
  onComments: () => void;
  onEarn: (amount: number, combo: number) => void;
  onSaveWord: (word: SavedWord) => void;
  onOpenVocab: () => void;
};

/**
 * One full-screen clip in the vertical feed, with the ГАВ learning overlay:
 * live subtitles with tappable/saveable words, a right action rail, the quiz
 * trigger, and top streak/XP chips. Plays only while it's the active item.
 */
export function FeedVideo({
  item,
  isActive,
  height,
  state,
  autoNudge = true,
  onQuiz,
  onComments,
  onEarn,
  onSaveWord,
  onOpenVocab,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [following, setFollowing] = useState(false);
  const [pop, setPop] = useState<number | null>(null); // tapped word index
  const [floats, setFloats] = useState<FloatItem[]>([]);
  const [nudge, setNudge] = useState(false);

  // No expo-video source for embedded YouTube clips — they play via YouTubeShort.
  const player = useVideoPlayer(item.youtubeId ? null : item.hlsUrl, (p) => {
    p.loop = true;
    p.muted = false;
  });

  useEffect(() => {
    if (isActive) {
      player.play();
    } else {
      player.pause();
      // expo-video's player is an intentionally mutable native handle, not React state.
      // eslint-disable-next-line react-hooks/immutability
      player.currentTime = 0;
    }
  }, [isActive, player]);

  // "Try the quiz" pulse nudge a couple seconds into the active clip. The reset
  // lives in cleanup (runs when the clip scrolls away) so we never setState
  // synchronously in the effect body.
  useEffect(() => {
    if (!isActive || !autoNudge) return;
    const id = setTimeout(() => setNudge(true), 2600);
    return () => {
      clearTimeout(id);
      setNudge(false);
    };
  }, [isActive, autoNudge]);

  const spawnFloat = (x: number, y: number, amt: number) => {
    const id = Math.random();
    setFloats((f) => [...f, { id, x, y, amt }]);
    setTimeout(() => setFloats((f) => f.filter((z) => z.id !== id)), 1100);
  };

  const doLike = () => {
    if (!liked) {
      spawnFloat(300, height * 0.45, 5);
      onEarn(5, state.combo);
    }
    setLiked((l) => !l);
  };

  const saveWord = (token: SubtitleToken) => {
    setSaved(true);
    spawnFloat(140, height * 0.4, 8);
    onEarn(8, state.combo);
    setPop(null);
    onSaveWord({
      en: token.w,
      ru: token.t ?? '',
      type: token.w.trim().includes(' ') ? 'phrase' : 'word',
      source: item.category,
      example: item.subtitle.map((s) => s.w).join(' '),
    });
  };

  return (
    <View style={{ height, width: '100%' }} className="overflow-hidden bg-bg">
      {/* placeholder backdrop (visible until/if the real clip loads) */}
      <LinearGradient
        colors={item.bgGradient}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View className="absolute inset-0 items-center justify-center" style={{ opacity: 0.5 }}>
        {item.creator.mascot ? (
          <Sharik mood={isActive ? 'happy' : 'idle'} size={120} />
        ) : (
          <Icon name="play" size={62} color="rgba(255,255,255,0.6)" />
        )}
        <Text className="font-mono" style={{ marginTop: 10, fontSize: 11, letterSpacing: 1, color: 'rgba(255,255,255,0.5)' }}>
          {item.catEn} · VIDEO
        </Text>
      </View>

      {/* the real clip on top of the placeholder — embedded YouTube when the
          row carries a youtubeId, otherwise the self-hosted/HLS player */}
      {item.youtubeId ? (
        <YouTubeShort videoId={item.youtubeId} playing={isActive} width={width} height={height} />
      ) : (
        <VideoView style={StyleSheet.absoluteFill} player={player} contentFit="cover" nativeControls={false} />
      )}

      {/* legibility scrim */}
      <LinearGradient
        colors={['rgba(0,0,0,0.55)', 'transparent', 'transparent', 'rgba(0,0,0,0.85)']}
        locations={[0, 0.22, 0.5, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* top bar: category + streak + today's XP */}
      <View className="absolute left-3.5 right-3.5 z-10 flex-row items-center justify-between" style={{ top: insets.top + 8 }}>
        <Chip borderColor="rgba(255,255,255,0.15)">
          <Text className="font-nunito-x" style={{ color: COLORS.lime, fontSize: 12 }}>
            {item.category}
          </Text>
        </Chip>
        <View className="flex-row gap-2">
          <StreakBadge count={state.streak} size="sm" />
          <Chip borderColor="rgba(255,216,61,0.4)">
            <Icon name="bolt" size={14} color={COLORS.gold} />
            <Text className="font-nunito-x" style={{ color: COLORS.gold, fontSize: 12 }}>
              {state.xpToday}
            </Text>
          </Chip>
        </View>
      </View>

      {/* right action rail */}
      <View className="absolute right-3 z-10 items-center gap-[18px]" style={{ bottom: 150 }}>
        <QuizTrigger xp={item.quiz.xp} nudge={nudge} onPress={onQuiz} />
        <View className="mb-1">
          <Avatar name={item.creator.name} size={48} gradient={item.creator.gradient} />
          {!following && (
            <Pressable
              onPress={() => setFollowing(true)}
              className="absolute left-1/2 -ml-[11px] h-[22px] w-[22px] items-center justify-center rounded-full"
              style={{ bottom: -8, backgroundColor: COLORS.lime, borderWidth: 2, borderColor: COLORS.bg }}
            >
              <Icon name="plus" size={14} color="#08130a" />
            </Pressable>
          )}
        </View>
        <RailButton icon="heart" label={item.likes} filled={liked} color={liked ? COLORS.rose : '#fff'} onPress={doLike} />
        <RailButton icon="comment" label={item.comments} color="#fff" onPress={onComments} />
        <RailButton icon="bookmark" label="Словарь" filled={saved} color={saved ? COLORS.gold : '#fff'} onPress={onOpenVocab} />
        <RailButton icon="share" label={item.shares} color="#fff" onPress={() => {}} />
      </View>

      {/* bottom: subtitle (tappable) + creator + caption */}
      <View className="absolute left-3.5 z-10" style={{ right: 78, bottom: 104 }}>
        <SubtitleBox subtitle={item.subtitle} pop={pop} onTapWord={(i) => setPop(pop === i ? null : i)} onSave={saveWord} />

        <View className="mb-2 flex-row items-center gap-2">
          <Text className="font-nunito-x text-white" style={{ fontSize: 17 }}>
            {item.creator.handle}
          </Text>
          {item.creator.verified && (
            <View className="h-4 w-4 items-center justify-center rounded-full" style={{ backgroundColor: COLORS.cyan }}>
              <Icon name="check" size={11} color="#06222a" />
            </View>
          )}
        </View>
        <Text className="font-nunito-semibold" style={{ color: 'rgba(255,255,255,0.92)', fontSize: 15, lineHeight: 21 }}>
          {item.caption}
        </Text>
      </View>

      <View className="absolute inset-0" pointerEvents="none">
        <FloatXp items={floats} />
      </View>
    </View>
  );
}

/* ----------------------- subtitle with tappable words ----------------------- */
function SubtitleBox({
  subtitle,
  pop,
  onTapWord,
  onSave,
}: {
  subtitle: SubtitleToken[];
  pop: number | null;
  onTapWord: (i: number) => void;
  onSave: (token: SubtitleToken) => void;
}) {
  const active = pop !== null ? subtitle[pop] : null;

  return (
    <View className="relative mb-3 self-start">
      {/* translation popover, anchored above the subtitle box */}
      {active && (
        <View
          className="absolute left-0 rounded-[14px]"
          style={{
            bottom: '100%',
            marginBottom: 10,
            minWidth: 140,
            padding: 12,
            backgroundColor: COLORS.elevated,
            borderWidth: 1,
            borderColor: COLORS.line2,
            zIndex: 20,
          }}
        >
          <Text className="font-nunito-bold uppercase" style={{ color: COLORS.textFaint, fontSize: 11, letterSpacing: 0.5 }}>
            перевод
          </Text>
          <Text className="font-nunito-x text-content" style={{ fontSize: 17, marginVertical: 4 }}>
            {active.t}
          </Text>
          <Pressable onPress={() => onSave(active)} className="flex-row items-center gap-1.5">
            <Icon name="bookmark" size={14} color={COLORS.gold} filled />
            <Text className="font-nunito-x" style={{ color: COLORS.gold, fontSize: 12 }}>
              Сохранить слово +8
            </Text>
          </Pressable>
        </View>
      )}

      <View
        className="flex-row flex-wrap items-center rounded-[14px]"
        style={{ paddingVertical: 10, paddingHorizontal: 12, backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', columnGap: 6, rowGap: 2 }}
      >
        {subtitle.map((s, i) =>
          s.key ? (
            <Pressable key={i} onPress={() => onTapWord(i)}>
              <Text
                className="font-nunito-x"
                style={{ color: COLORS.lime, fontSize: 17, borderBottomWidth: 2, borderColor: COLORS.lime, borderStyle: 'dotted' }}
              >
                {s.w}
              </Text>
            </Pressable>
          ) : (
            <Text key={i} className="font-nunito-x text-white" style={{ fontSize: 17 }}>
              {s.w}
            </Text>
          ),
        )}
      </View>
    </View>
  );
}

/* ----------------------- quiz trigger (pulsing rail button) ----------------------- */
function QuizTrigger({ xp, nudge, onPress }: { xp: number; nudge: boolean; onPress: () => void }) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (nudge) {
      pulse.value = withRepeat(withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }), -1, true);
    } else {
      pulse.value = withTiming(0, { duration: 200 });
    }
  }, [nudge, pulse]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pulse.value * 0.08 }] }));

  return (
    <Pressable onPress={onPress} className="mb-0.5 items-center gap-[5px]">
      <Animated.View style={style}>
        <LinearGradient
          colors={GRADIENTS.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.18)' }}
        >
          <Icon name="sparkle" size={28} color="#08130a" />
        </LinearGradient>
      </Animated.View>
      <Text className="font-nunito-black" style={{ fontSize: 12, color: COLORS.lime }}>
        +{xp} XP
      </Text>
    </Pressable>
  );
}

