import { useQuery } from '@rocicorp/zero/react';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  type GestureResponderEvent,
  type LayoutChangeEvent,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip } from '@/components/chip';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { Sharik } from '@/components/mascot';
import { PrimaryButton } from '@/components/primary-button';
import { SectionHead } from '@/components/section-head';
import { COLORS, GRADIENTS } from '@/constants/gav';
import { useAuth } from '@/lib/auth/auth-context';
import { seeded } from '@/lib/feed/prng';
import { SAMPLE_VIDEOS } from '@/lib/feed/sample-videos';
import {
  useCreatorVideosQuery,
  useQuizMarkersQuery,
  useVideoAnalyticsQuery,
  useVideoSubtitlesQuery,
} from '@/lib/zero/queries';
import { ZERO_ENABLED, useZeroApp } from '@/lib/zero/provider';

type QuizType = 'mc' | 'fill' | 'reorder' | 'meaning';
type Marker = { pos: number; type: QuizType };
/** One subtitle token rendered in the editor: the word, its translation
 * (when present), and whether it's a highlighted key vocabulary word. */
type Sub = { w: string; t?: string; key?: boolean };

/** Placeholder subtitle tokens shown until a real video's `subtitle` jsonb loads. */
const PLACEHOLDER_SUBS: Sub[] = [
  { w: 'pull', t: 'тянуть', key: true },
  { w: 'off', key: true },
  { w: 'that', t: 'это' },
  { w: 'was', t: 'было' },
  { w: 'insane', t: 'безумно', key: true },
];

const TYPE_COLOR: Record<QuizType, string> = {
  mc: COLORS.lime,
  fill: COLORS.cyan,
  reorder: COLORS.violet,
  meaning: COLORS.pink,
};

const QUIZ_TYPES: [QuizType, string][] = [
  ['mc', 'Выбор'],
  ['fill', 'Пропуск'],
  ['reorder', 'Порядок'],
  ['meaning', 'Смысл'],
];

type Studio = 'home' | 'editor' | 'stats';

/**
 * Creator Studio — a main tab (no nav bar of its own; the floating BottomNav
 * lives in the layout). Local `view` state swaps between the published-videos
 * hub, the lesson editor (upload zone, quiz-marker timeline, subtitle list),
 * and the analytics tab. Faithful port of design/studio.jsx.
 */
export default function StudioScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const z = useZeroApp();
  const [view, setView] = useState<Studio>('home');
  const [localMarkers, setLocalMarkers] = useState<Marker[]>([
    { pos: 32, type: 'mc' },
    { pos: 68, type: 'fill' },
  ]);
  const [playhead, setPlayhead] = useState(45);
  const [aiBusy, setAiBusy] = useState(false);
  const aiTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The editor previews the creator's first owned video's subtitles, when any
  // exist; otherwise the editor falls back to placeholder subs.
  const [ownVideos] = useQuery(useCreatorVideosQuery(user?.userID ?? ''));
  const editorVideoId = ownVideos[0]?.id;

  // Quiz markers for the edited video come from Zero (bk-cj6.25). When the
  // edited video has persisted markers, render those; otherwise fall back to
  // the local default markers so the editor still shows a timeline offline.
  const [markerRows] = useQuery(useQuizMarkersQuery(editorVideoId ?? ''));
  const markers: Marker[] =
    editorVideoId && markerRows.length > 0
      ? markerRows.map((m) => ({ pos: m.pos, type: m.type as QuizType }))
      : localMarkers;

  useEffect(() => () => {
    if (aiTimer.current) clearTimeout(aiTimer.current);
  }, []);

  // Persist a marker to Zero when a backend + edited video are available.
  // Returns true when the write was issued (so callers can skip the local
  // fallback), false otherwise (offline / no video → keep local optimistic state).
  const persistMarker = (pos: number, type: QuizType): boolean => {
    if (ZERO_ENABLED && editorVideoId) {
      const r = z.mutate.addQuizMarker({
        id: `${editorVideoId}:${pos}:${type}`,
        videoID: editorVideoId,
        pos,
        type,
        createdAt: Date.now(),
      });
      r.client.catch(() => {});
      r.server.catch(() => {});
      return true;
    }
    return false;
  };

  const addMarker = () => {
    if (markers.some((m) => Math.abs(m.pos - playhead) < 5)) return;
    if (!persistMarker(playhead, 'mc')) {
      const next: Marker = { pos: playhead, type: 'mc' };
      setLocalMarkers((m) => [...m, next].sort((a, b) => a.pos - b.pos));
    }
  };

  const genAI = () => {
    if (aiBusy) return;
    setAiBusy(true);
    aiTimer.current = setTimeout(() => {
      setAiBusy(false);
      if (!persistMarker(88, 'meaning')) {
        const aiMarker: Marker = { pos: 88, type: 'meaning' };
        setLocalMarkers((m) => [...m, aiMarker].sort((a, b) => a.pos - b.pos));
      }
    }, 1400);
  };

  const title = view === 'home' ? 'Мои видео' : view === 'editor' ? 'Редактор' : 'Аналитика';

  return (
    <View className="flex-1 bg-bg">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* header */}
        <View
          className="flex-row items-center gap-3"
          style={{ paddingTop: insets.top + 24, paddingHorizontal: 22, paddingBottom: 14 }}
        >
          {view !== 'home' && (
            <IconButton icon="chevL" onPress={() => setView('home')} />
          )}
          <View className="flex-1">
            <Text
              className="font-nunito-bold uppercase text-content-dim"
              style={{ fontSize: 11, letterSpacing: 0.9 }}
            >
              Студия
            </Text>
            <Text className="font-nunito-black text-content" style={{ fontSize: 27 }}>
              {title}
            </Text>
          </View>
          {view === 'home' && (
            <LinearGradient
              colors={GRADIENTS.brand}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }}
            >
              <Sharik mood="happy" size={38} />
            </LinearGradient>
          )}
        </View>

        {view === 'home' && (
          <MyVideosHome onEditor={() => setView('editor')} onStats={() => setView('stats')} />
        )}
        {view === 'stats' && <AnalyticsTab video={ownVideos[0]} />}
        {view === 'editor' && (
          <Editor
            markers={markers}
            playhead={playhead}
            aiBusy={aiBusy}
            onTrackPress={setPlayhead}
            onAddMarker={addMarker}
            onGenAI={genAI}
            videoId={editorVideoId}
          />
        )}
      </ScrollView>
    </View>
  );
}

/* ----------------------- Мои видео (hub) ----------------------- */
type StudioVideo = { title: string; grad: readonly [string, string]; views: string; done: string; quizzes: number };

// Compact view count formatter, e.g. 1200 -> "1.2K", 940 -> "940".
const formatViews = (n: number): string => (n >= 1000 ? `${Math.round(n / 100) / 10}K` : String(n));

// Placeholder list shown before the creator has any published clips in the
// replica (same spirit as the feed's SAMPLE_VIDEOS fallback) — never blank.
const SAMPLE_MINE: StudioVideo[] = [
  { title: 'Фразовые глаголы: pull off', grad: SAMPLE_VIDEOS[0].bgGradient, views: '42K', done: '78%', quizzes: 3 },
  { title: '3 способа сказать «я устал»', grad: SAMPLE_VIDEOS[3].bgGradient, views: '128K', done: '85%', quizzes: 2 },
  { title: 'Сленг: no cap, fr fr', grad: SAMPLE_VIDEOS[1].bgGradient, views: '9.4K', done: '61%', quizzes: 1 },
];

function MyVideosHome({ onEditor, onStats }: { onEditor: () => void; onStats: () => void }) {
  const { user } = useAuth();
  const [rows] = useQuery(useCreatorVideosQuery(user?.userID ?? ''));
  // `views`/`done` come from the real integer columns on the video row
  // (views, completionRate 0-100). One quiz jsonb per row.
  const mine: StudioVideo[] =
    rows.length === 0
      ? SAMPLE_MINE
      : rows.map((v) => ({
          title: v.caption || v.catEn,
          grad: [v.bgGradient[0], v.bgGradient[1]] as const,
          views: formatViews(v.views ?? 0),
          done: `${v.completionRate ?? 0}%`,
          quizzes: 1,
        }));

  return (
    <View style={{ paddingHorizontal: 22 }}>
      {/* action cards */}
      <View className="flex-row gap-3" style={{ marginBottom: 22 }}>
        <Pressable
          onPress={onEditor}
          className="flex-1 rounded-[28px]"
          style={{ padding: 18, backgroundColor: COLORS.lime }}
        >
          <Icon name="plus" size={26} color="#08130a" strokeWidth={3} />
          <Text className="font-nunito-x" style={{ fontSize: 17, color: '#08130a', marginTop: 12 }}>
            Новый урок
          </Text>
          <Text className="font-nunito-black" style={{ fontSize: 12, color: 'rgba(8,19,10,0.65)' }}>
            Редактор видео →
          </Text>
        </Pressable>
        <Pressable
          onPress={onStats}
          className="flex-1 rounded-[28px] bg-surface"
          style={{ padding: 18, borderWidth: 1, borderColor: COLORS.line }}
        >
          <Icon name="chart" size={26} color={COLORS.cyan} />
          <Text className="font-nunito-x text-content" style={{ fontSize: 17, marginTop: 12 }}>
            Аналитика
          </Text>
          <Text className="font-nunito-bold text-content-dim" style={{ fontSize: 11 }}>
            Просмотры и удержание →
          </Text>
        </Pressable>
      </View>

      <SectionHead title="Опубликовано" action={`${mine.length} видео`} />
      <View className="gap-2.5">
        {mine.map((m, i) => (
          <Pressable
            key={i}
            onPress={onStats}
            className="w-full flex-row items-center gap-3.5 rounded-[20px] bg-surface"
            style={{ padding: 12, borderWidth: 1, borderColor: COLORS.line }}
          >
            <View className="overflow-hidden rounded-[12px]" style={{ width: 54, height: 72 }}>
              <LinearGradient
                colors={m.grad}
                start={{ x: 0.2, y: 0 }}
                end={{ x: 0.8, y: 1 }}
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
              >
                <Icon name="play" size={20} color="rgba(255,255,255,0.75)" />
              </LinearGradient>
            </View>
            <View className="flex-1">
              <Text className="font-nunito-x text-content" style={{ fontSize: 17 }}>
                {m.title}
              </Text>
              <View className="flex-row gap-3" style={{ marginTop: 7 }}>
                <Stat icon="play" color={COLORS.textDim} value={m.views} />
                <Stat icon="bolt" color={COLORS.gold} value={m.done} />
                <Stat icon="sparkle" color={COLORS.lime} value={String(m.quizzes)} />
              </View>
            </View>
            <Icon name="chevR" size={18} color={COLORS.textFaint} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Stat({ icon, color, value }: { icon: 'play' | 'bolt' | 'sparkle'; color: string; value: string }) {
  return (
    <View className="flex-row items-center gap-1">
      <Icon name={icon} size={11} color={color} />
      <Text className="font-nunito-bold text-content-dim" style={{ fontSize: 11 }}>
        {value}
      </Text>
    </View>
  );
}

/* ----------------------- Редактор ----------------------- */
function Editor({
  markers,
  playhead,
  aiBusy,
  onTrackPress,
  onAddMarker,
  onGenAI,
  videoId,
}: {
  markers: Marker[];
  playhead: number;
  aiBusy: boolean;
  onTrackPress: (pos: number) => void;
  onAddMarker: () => void;
  onGenAI: () => void;
  videoId?: string;
}) {
  const trackW = useRef(0);

  // The subtitle list comes from the selected video's `subtitle` jsonb (flat
  // SubtitleToken[] — no timecodes). Falls back to placeholders when there's no
  // video selected or the row carries no tokens.
  const [video] = useQuery(useVideoSubtitlesQuery(videoId ?? ''));
  const subs: Sub[] =
    video && video.subtitle.length > 0
      ? video.subtitle.map((tok) => ({ w: tok.w, t: tok.t, key: tok.key }))
      : PLACEHOLDER_SUBS;

  const onTrackLayout = (e: LayoutChangeEvent) => {
    trackW.current = e.nativeEvent.layout.width;
  };
  const handleTrack = (e: GestureResponderEvent) => {
    const w = trackW.current;
    if (!w) return;
    onTrackPress(Math.max(0, Math.min(100, Math.round((e.nativeEvent.locationX / w) * 100))));
  };

  return (
    <View style={{ paddingHorizontal: 22 }}>
      {/* upload zone */}
      <View
        className="ph-stripe items-center rounded-[28px] bg-surface"
        style={{ borderWidth: 2, borderColor: COLORS.line2, borderStyle: 'dashed', paddingVertical: 28, paddingHorizontal: 18, marginBottom: 18 }}
      >
        <View
          className="items-center justify-center rounded-[16px] bg-surface-2"
          style={{ width: 56, height: 56, marginBottom: 10 }}
        >
          <Icon name="upload" size={26} color={COLORS.lime} />
        </View>
        <Text className="font-nunito-x text-content" style={{ fontSize: 17 }}>
          Загрузить вертикальное видео
        </Text>
        <Text className="font-nunito-bold text-content-dim" style={{ fontSize: 13, marginTop: 4 }}>
          MP4 · 9:16 · до 3 минут
        </Text>
      </View>

      {/* timeline with quiz markers */}
      <View
        className="rounded-[20px] bg-surface"
        style={{ padding: 16, borderWidth: 1, borderColor: COLORS.line, marginBottom: 18 }}
      >
        <View className="flex-row items-center justify-between" style={{ marginBottom: 14 }}>
          <Text className="font-nunito-x text-content" style={{ fontSize: 17 }}>
            Таймлайн квизов
          </Text>
          <Text className="font-nunito-bold text-content-dim" style={{ fontSize: 11 }}>
            0:00 — 0:42
          </Text>
        </View>

        {/* track */}
        <Pressable onPress={handleTrack} onLayout={onTrackLayout}>
          <View className="overflow-hidden rounded-[12px] bg-surface-2" style={{ height: 54 }}>
            {/* waveform-ish bars */}
            <View
              className="absolute inset-0 flex-row items-center"
              style={{ gap: 3, paddingHorizontal: 6, opacity: 0.35 }}
            >
              {Array.from({ length: 40 }).map((_, i) => (
                <View
                  key={i}
                  style={{ flex: 1, height: 20 + Math.abs(Math.sin(i)) * 26, backgroundColor: COLORS.lime, borderRadius: 2 }}
                />
              ))}
            </View>
            {/* playhead */}
            <View style={{ position: 'absolute', top: 0, bottom: 0, left: `${playhead}%`, width: 2, backgroundColor: '#fff' }}>
              <View style={{ position: 'absolute', top: -4, left: -5, width: 12, height: 12, borderRadius: 6, backgroundColor: '#fff' }} />
            </View>
            {/* markers */}
            {markers.map((m, i) => (
              <View
                key={i}
                className="items-center justify-center rounded-[8px]"
                style={{
                  position: 'absolute',
                  top: 4,
                  left: `${m.pos}%`,
                  marginLeft: -12,
                  width: 24,
                  height: 24,
                  backgroundColor: TYPE_COLOR[m.type],
                  shadowColor: '#000',
                  shadowOpacity: 0.4,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: 4,
                }}
              >
                <Icon name="sparkle" size={14} color="#08130a" />
              </View>
            ))}
          </View>
        </Pressable>

        <View className="flex-row gap-2" style={{ marginTop: 12 }}>
          <Pressable
            onPress={onAddMarker}
            className="flex-1 flex-row items-center justify-center gap-2 rounded-[20px] bg-surface-2"
            style={{ paddingVertical: 11, borderWidth: 1, borderColor: COLORS.line2 }}
          >
            <Icon name="add" size={18} color={COLORS.text} />
            <Text className="font-nunito-x text-content" style={{ fontSize: 14 }}>
              Квиз здесь
            </Text>
          </Pressable>
          <Pressable onPress={onGenAI} className="flex-1 overflow-hidden rounded-[20px]">
            <LinearGradient
              colors={GRADIENTS.fun}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="flex-row items-center justify-center gap-2"
              style={{ paddingVertical: 11 }}
            >
              {aiBusy ? <Spinner /> : <Icon name="sparkle" size={18} color="#fff" />}
              <Text className="font-nunito-x text-white" style={{ fontSize: 14 }}>
                {aiBusy ? 'Генерация…' : 'AI-квиз'}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>

      {/* quiz type selector */}
      <View style={{ marginBottom: 18 }}>
        <Text className="font-nunito-x text-content" style={{ fontSize: 17, marginBottom: 10 }}>
          Тип квиза в точке {playhead}%
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {QUIZ_TYPES.map(([k, t]) => (
            <Chip key={k} borderColor={TYPE_COLOR[k]} className="bg-surface">
              <Text className="font-nunito-x" style={{ fontSize: 12, color: TYPE_COLOR[k] }}>
                {t}
              </Text>
            </Chip>
          ))}
        </View>
      </View>

      {/* subtitle editor */}
      <View
        className="rounded-[20px] bg-surface"
        style={{ padding: 16, borderWidth: 1, borderColor: COLORS.line }}
      >
        <View className="flex-row items-center justify-between" style={{ marginBottom: 12 }}>
          <Text className="font-nunito-x text-content" style={{ fontSize: 17 }}>
            Субтитры
          </Text>
          <Chip borderColor="rgba(182,242,61,0.3)" className="bg-surface">
            <Icon name="sparkle" size={12} color={COLORS.lime} />
            <Text className="font-nunito-x" style={{ fontSize: 12, color: COLORS.lime }}>
              авто
            </Text>
          </Chip>
        </View>
        <View className="gap-2">
          {subs.map((s, i) => (
            <View
              key={i}
              className="flex-row items-center gap-2.5 rounded-[12px] bg-surface-2"
              style={{ paddingVertical: 10, paddingHorizontal: 12 }}
            >
              <Text className="font-mono" style={{ fontSize: 11, color: COLORS.textFaint }}>
                {i + 1}
              </Text>
              <Text
                className="font-nunito-x"
                style={{ fontSize: 13, color: s.key ? COLORS.lime : COLORS.text }}
              >
                {s.w}
              </Text>
              {s.t ? (
                <Text className="flex-1 font-nunito-bold text-content-dim" style={{ fontSize: 13 }}>
                  {s.t}
                </Text>
              ) : (
                <View className="flex-1" />
              )}
              {s.key && <Icon name="sparkle" size={12} color={COLORS.lime} />}
              <Icon name="edit" size={16} color={COLORS.textFaint} />
            </View>
          ))}
        </View>
      </View>

      <PrimaryButton label="Опубликовать урок" onPress={() => {}} className="mt-[18px]" />
    </View>
  );
}

/** Slowly rotating gear, shown while the AI quiz is "generating". */
function Spinner() {
  const r = useSharedValue(0);
  useEffect(() => {
    r.value = withRepeat(withTiming(1, { duration: 1000, easing: Easing.linear }), -1, false);
  }, [r]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value * 360}deg` }] }));
  return (
    <Animated.View style={style}>
      <Icon name="settings" size={18} color="#fff" />
    </Animated.View>
  );
}

/* ----------------------- Аналитика ----------------------- */
const RETENTION = [100, 92, 81, 74, 70, 58, 52, 49, 44, 40];
const STAT_TILES: [string, string, string][] = [
  ['👁', '42K', 'Просмотры'],
  ['⚡', '78%', 'Заверш.'],
  ['❤️', '12K', 'Лайки'],
];

type AnalyticsVideo = { id: string; views?: number | null; completionRate?: number | null; likes?: string | null };

function AnalyticsTab({ video }: { video?: AnalyticsVideo }) {
  const [analytics] = useQuery(useVideoAnalyticsQuery(video?.id ?? ''));

  // Retention curve: prefer materialized analytics, else the static fallback.
  const retention: readonly number[] =
    analytics && analytics.retention.length > 0 ? analytics.retention : RETENTION;

  // Engagement heatmap: prefer materialized analytics (padded/sliced to the
  // 35-cell grid the map renders), else the seeded PRNG fallback.
  const heat = useMemo(() => {
    if (analytics && analytics.engagement.length > 0) {
      const cells = analytics.engagement.slice(0, 35);
      while (cells.length < 35) cells.push(0);
      return cells;
    }
    const rng = seeded(20240603);
    return Array.from({ length: 35 }, () => rng());
  }, [analytics]);

  // Stat tiles: derived from the real video row when present, else the static
  // fallback trio.
  const statTiles: [string, string, string][] = video
    ? [
        ['👁', formatViews(video.views ?? 0), 'Просмотры'],
        ['⚡', `${video.completionRate ?? 0}%`, 'Заверш.'],
        ['❤️', video.likes ?? '0', 'Лайки'],
      ]
    : STAT_TILES;

  return (
    <View style={{ paddingHorizontal: 22 }}>
      {/* top stats */}
      <View className="flex-row gap-2.5" style={{ marginBottom: 18 }}>
        {statTiles.map(([e, v, l], i) => (
          <View
            key={i}
            className="flex-1 items-center rounded-[20px] bg-surface"
            style={{ padding: 14, borderWidth: 1, borderColor: COLORS.line }}
          >
            <Text style={{ fontSize: 20 }}>{e}</Text>
            <Text className="font-nunito-x text-content" style={{ fontSize: 21, marginTop: 4, marginBottom: 2 }}>
              {v}
            </Text>
            <Text className="font-nunito-bold text-content-faint" style={{ fontSize: 11 }}>
              {l}
            </Text>
          </View>
        ))}
      </View>

      {/* retention curve */}
      <View
        className="rounded-[20px] bg-surface"
        style={{ padding: 16, borderWidth: 1, borderColor: COLORS.line, marginBottom: 18 }}
      >
        <Text className="font-nunito-x text-content" style={{ fontSize: 17, marginBottom: 14 }}>
          Удержание зрителей
        </Text>
        <View className="flex-row items-end gap-[5px]" style={{ height: 96 }}>
          {retention.map((h, i) => (
            <View key={i} className="flex-1 overflow-hidden" style={{ height: `${h}%`, borderTopLeftRadius: 5, borderTopRightRadius: 5, opacity: 0.4 + (h / 100) * 0.6 }}>
              <LinearGradient
                colors={[COLORS.lime, 'rgba(182,242,61,0.2)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={{ flex: 1 }}
              />
            </View>
          ))}
        </View>
        <View className="flex-row justify-between" style={{ marginTop: 8 }}>
          <Text className="font-nunito-bold text-content-faint" style={{ fontSize: 11 }}>
            0:00
          </Text>
          <Text className="font-nunito-bold text-content-faint" style={{ fontSize: 11 }}>
            0:42
          </Text>
        </View>
      </View>

      {/* engagement heatmap */}
      <View
        className="rounded-[20px] bg-surface"
        style={{ padding: 16, borderWidth: 1, borderColor: COLORS.line }}
      >
        <Text className="font-nunito-x text-content" style={{ fontSize: 17, marginBottom: 4 }}>
          Карта вовлечённости
        </Text>
        <Text className="font-nunito-bold text-content-dim" style={{ fontSize: 13, marginBottom: 14 }}>
          Где зрители пересматривают и отвечают
        </Text>
        <View className="flex-row flex-wrap" style={{ gap: 5 }}>
          {heat.map((v, i) => (
            <View
              key={i}
              style={{ width: '13.1%', aspectRatio: 1, borderRadius: 6, backgroundColor: `rgba(182,242,61,${0.12 + v * 0.8})` }}
            />
          ))}
        </View>
        <View className="flex-row items-center gap-2" style={{ marginTop: 12 }}>
          <Text className="font-nunito-bold text-content-faint" style={{ fontSize: 11 }}>
            меньше
          </Text>
          <View className="flex-1 overflow-hidden" style={{ height: 6, borderRadius: 3 }}>
            <LinearGradient
              colors={['rgba(182,242,61,0.12)', COLORS.lime]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ flex: 1 }}
            />
          </View>
          <Text className="font-nunito-bold text-content-faint" style={{ fontSize: 11 }}>
            больше
          </Text>
        </View>
      </View>
    </View>
  );
}
