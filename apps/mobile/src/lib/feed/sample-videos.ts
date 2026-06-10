/**
 * Placeholder feed data so the app runs before the backend exists.
 * Swap this for a Zero query (see src/lib/zero/queries.ts -> useFeedQuery)
 * once zero-cache + the TS/Hono backend are serving real `video` rows.
 *
 * Content mirrors the ГАВ design: short English clips for Russian-speaking
 * learners, each with tappable subtitle words and a comprehension quiz.
 * The HLS URLs are public test streams — replace with your CDN/Mux output.
 */
import type { Quiz, QuizChoice, QuizFill, QuizReorder, SubtitleToken } from '@barkly/zero';

import type { GradientName } from '@/constants/gav';

// Subtitle/quiz shapes are the shared Zero data contract — re-export them so
// app modules keep importing from '@/lib/feed/sample-videos'.
export type { SubtitleToken, Quiz, QuizChoice, QuizFill, QuizReorder };

export type Creator = {
  name: string;
  handle: string;
  gradient: GradientName;
  followers: string;
  verified: boolean;
  /** True for the mascot's official account (renders Шарик instead of a play icon). */
  mascot?: boolean;
};

export type FeedVideoItem = {
  id: string;
  category: string;
  catEn: string;
  creator: Creator;
  /** [top, bottom] stops for the placeholder backdrop behind the clip. */
  bgGradient: [string, string];
  caption: string;
  likes: string;
  comments: string;
  shares: string;
  tag: string;
  subtitle: SubtitleToken[];
  quiz: Quiz;
  hlsUrl: string;
  /** When set, the clip is an embedded YouTube Short played by its id. */
  youtubeId?: string;
};

export const SAMPLE_VIDEOS: FeedVideoItem[] = [
  {
    id: 'v1',
    category: 'Сцена из фильма',
    catEn: 'MOVIE SCENE',
    creator: { name: 'CineDose', handle: '@cinedose', gradient: 'fun', followers: '1.2M', verified: true },
    bgGradient: ['#3a1c5e', '#11122b'],
    caption: 'Лучшая сцена для отработки фразовых глаголов 🎬',
    likes: '128K',
    comments: '2.4K',
    shares: '18K',
    tag: '#movies',
    subtitle: [
      { w: 'I' },
      { w: "can't", t: 'не могу' },
      { w: 'believe', t: 'поверить', key: true },
      { w: 'you' },
      { w: 'pulled', t: 'провернул', key: true },
      { w: 'this' },
      { w: 'off', t: '(довести до конца)', key: true },
    ],
    quiz: {
      type: 'mc',
      prompt: 'Что значит "to pull this off"?',
      options: ['Снять одежду', 'Успешно справиться', 'Отъехать на машине', 'Сдаться'],
      answer: 1,
      xp: 30,
      explain:
        '"Pull off" — фразовый глагол: успешно сделать что-то трудное. Здесь: «не верится, что у тебя получилось».',
    },
    hlsUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
  },
  {
    id: 'v2',
    category: 'Мем',
    catEn: 'MEME',
    creator: { name: 'slanglord', handle: '@slanglord', gradient: 'brand', followers: '880K', verified: true },
    bgGradient: ['#0e3b2e', '#0a0f1e'],
    caption: 'POV: твой друг опять опаздывает 💀 #relatable',
    likes: '342K',
    comments: '9.1K',
    shares: '44K',
    tag: '#meme',
    subtitle: [
      { w: 'He' },
      { w: 'is' },
      { w: 'always', t: 'всегда' },
      { w: 'running', t: 'бежит', key: true },
      { w: 'late', t: 'опаздывает', key: true },
      { w: 'no' },
      { w: 'cap', t: 'без вранья (сленг)', key: true },
    ],
    quiz: {
      type: 'fill',
      prompt: 'Заполни пропуск так, как сказал бы носитель:',
      sentence: ['He is always', '___', 'late, no cap'],
      choices: ['running', 'walking', 'flying', 'sleeping'],
      answer: 0,
      xp: 25,
      explain: '"Running late" — устойчивое выражение «опаздывать». А "no cap" на сленге значит «без вранья / реально».',
    },
    hlsUrl: 'https://test-streams.mux.dev/pts_shift/master.m3u8',
  },
  {
    id: 'v3',
    category: 'Уличный опрос',
    catEn: 'STREET',
    creator: { name: 'NYC Talks', handle: '@nyctalks', gradient: 'reward', followers: '610K', verified: false },
    bgGradient: ['#5e3a12', '#1a1208'],
    caption: 'Спросили у прохожих в Нью-Йорке 🗽',
    likes: '76K',
    comments: '1.1K',
    shares: '8K',
    tag: '#street',
    subtitle: [
      { w: 'Honestly', t: 'честно говоря', key: true },
      { w: 'I' },
      { w: 'would' },
      { w: 'rather', t: 'скорее бы', key: true },
      { w: 'grab', t: 'схватить/взять', key: true },
      { w: 'a' },
      { w: 'coffee', t: 'кофе' },
    ],
    quiz: {
      type: 'reorder',
      prompt: 'Собери фразу в правильном порядке:',
      words: ['I', 'would', 'rather', 'grab', 'coffee'],
      answer: ['I', 'would', 'rather', 'grab', 'coffee'],
      xp: 35,
      explain: '"Would rather" + глагол = «предпочёл бы». Порядок: подлежащее → would rather → глагол.',
    },
    hlsUrl: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_ts/master.m3u8',
  },
  {
    id: 'v4',
    category: 'Мини-урок',
    catEn: 'LESSON',
    creator: {
      name: 'Шарик',
      handle: '@gav_official',
      gradient: 'brand',
      followers: '3.4M',
      verified: true,
      mascot: true,
    },
    bgGradient: ['#1c3a00', '#0a0f06'],
    caption: '3 способа сказать «я устал» как носитель 🐶',
    likes: '512K',
    comments: '12K',
    shares: '88K',
    tag: '#lesson',
    subtitle: [
      { w: "I'm" },
      { w: 'absolutely', t: 'абсолютно', key: true },
      { w: 'wiped', t: 'вымотан (сленг)', key: true },
      { w: 'out', key: true },
      { w: 'today', t: 'сегодня' },
    ],
    quiz: {
      type: 'meaning',
      prompt: 'Что имел в виду говорящий?',
      options: ['Я очень устал', 'Я промок', 'Я заблудился', 'Я проголодался'],
      answer: 0,
      xp: 30,
      explain: '"Wiped out" — разговорное «полностью без сил». Синонимы: exhausted, knackered, beat.',
    },
    hlsUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
  },
];

/** Gamification counters tracked while scrolling the feed. */
export type FeedUserState = {
  xp: number;
  xpToday: number;
  streak: number;
  gems: number;
  combo: number;
};

/** Starting gamification state (mirrors GAV_DATA.user in the design). */
export const INITIAL_USER_STATE: FeedUserState = {
  xp: 2840,
  xpToday: 180,
  streak: 47,
  gems: 1240,
  combo: 0,
};
