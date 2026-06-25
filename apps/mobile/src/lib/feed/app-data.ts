/**
 * Placeholder content for the non-feed ГАВ screens (profile, leaderboard,
 * rewards, notifications, vocabulary, comments). Mirrors `window.GAV_DATA` in
 * the design. Swap for Zero queries once the backend serves real rows.
 */
import type { IconName } from '@/components/icon';
import type { GradientName } from '@/constants/gav';
import type { SavedWord } from '@/components/feed-video';

export type CosmeticId = 'cap' | 'glasses' | 'scarf' | 'crown';

export const USER = {
  name: 'Аня',
  handle: '@anya_lvl',
  level: 12,
  levelName: 'Болтун',
  xpToNext: 3200,
  totalXp: 2840,
  league: 'Изумрудная',
  leagueRank: 3,
  friendshipLevel: 8,
  wordsLearned: 312,
} as const;

export type Player = {
  name: string;
  xp: number;
  gradient: GradientName;
  streak: number;
  me?: boolean;
};

export const LEADERBOARD: { leagueName: string; daysLeft: number; players: Player[] } = {
  leagueName: 'Изумрудная лига',
  daysLeft: 3,
  players: [
    { name: 'Макс', xp: 4120, gradient: 'reward', streak: 88 },
    { name: 'Sofia', xp: 3890, gradient: 'fun', streak: 61 },
    { name: 'Аня', xp: 2840, gradient: 'brand', streak: 47, me: true },
    { name: 'Тимур', xp: 2610, gradient: 'streak', streak: 33 },
    { name: 'jenny_k', xp: 2400, gradient: 'fun', streak: 21 },
    { name: 'Илья', xp: 1980, gradient: 'brand', streak: 12 },
    { name: 'nastya', xp: 1750, gradient: 'reward', streak: 9 },
    { name: 'Артём', xp: 1320, gradient: 'fun', streak: 5 },
  ],
};

export type Achievement = {
  icon: IconName;
  name: string;
  desc: string;
  done: boolean;
  color: string;
  pct?: number;
};

export const ACHIEVEMENTS: Achievement[] = [
  { icon: 'fire', name: 'Стрик 50', desc: '50 дней подряд', done: false, color: '#ff8a3d', pct: 94 },
  { icon: 'bolt', name: 'Молния', desc: '10 000 XP', done: true, color: '#ffd83d' },
  { icon: 'sparkle', name: 'Слово дня', desc: '7 дней новых слов', done: true, color: '#c084fc' },
  { icon: 'trophy', name: 'Чемпион', desc: 'Топ-1 в лиге', done: false, color: '#34e3ff', pct: 40 },
];

export type Cosmetic = {
  id: CosmeticId;
  name: string;
  rarity: string;
  cost: number;
  owned: boolean;
  color: string;
};

export const COSMETICS: Cosmetic[] = [
  { id: 'cap', name: 'Кепка', rarity: 'Обычное', cost: 200, owned: true, color: '#ff6fcf' },
  { id: 'glasses', name: 'Очки', rarity: 'Редкое', cost: 600, owned: true, color: '#34e3ff' },
  { id: 'scarf', name: 'Шарф', rarity: 'Редкое', cost: 750, owned: false, color: '#34e3ff' },
  { id: 'crown', name: 'Корона', rarity: 'Легендарное', cost: 3000, owned: false, color: '#ffd83d' },
];

export type AppNotification = {
  kind: 'streak' | 'friend' | 'xp' | 'reward';
  title: string;
  text: string;
  time: string;
  accent: string;
};

export const NOTIFICATIONS: AppNotification[] = [
  { kind: 'streak', title: 'Шарик скучает! 🐶', text: 'Не теряй стрик 47 дней — пройди один урок сегодня.', time: 'сейчас', accent: '#ff8a3d' },
  { kind: 'friend', title: 'Sofia обогнала тебя!', text: 'Она набрала 3 890 XP. Догонишь?', time: '12 мин', accent: '#c084fc' },
  { kind: 'xp', title: 'Новый уровень — 12! ⚡', text: 'Ты теперь «Болтун». Открыт новый скин.', time: '1 ч', accent: '#ffd83d' },
  { kind: 'reward', title: 'Сундук готов открыться', text: 'Заработай 100 XP, чтобы получить награду.', time: '3 ч', accent: '#b6f23d' },
  { kind: 'friend', title: 'kirill_92 теперь твой друг', text: 'Соревнуйтесь в недельной лиге!', time: 'вчера', accent: '#34e3ff' },
];

/** Maps a notification kind to its glyph. */
export const NOTIFICATION_ICON: Record<AppNotification['kind'], IconName> = {
  streak: 'fire',
  friend: 'user',
  xp: 'bolt',
  reward: 'gift',
};

/** A saved word plus spaced-repetition mastery (0–3). */
export type VocabWord = SavedWord & { mastery: number; isNew?: boolean };

export const INITIAL_VOCABULARY: VocabWord[] = [
  { en: 'pull off', ru: 'провернуть, успешно справиться', type: 'phrase', source: 'Сцена из фильма', example: 'You pulled this off!', mastery: 1 },
  { en: 'no cap', ru: 'без вранья, серьёзно (сленг)', type: 'phrase', source: 'Мем', example: 'He is late, no cap.', mastery: 0 },
  { en: 'running late', ru: 'опаздывать', type: 'phrase', source: 'Мем', example: 'Sorry, I am running late.', mastery: 2 },
  { en: 'wiped out', ru: 'вымотан, без сил', type: 'phrase', source: 'Мини-урок', example: "I'm wiped out today.", mastery: 0 },
  { en: 'would rather', ru: 'предпочёл бы', type: 'phrase', source: 'Уличный опрос', example: 'I would rather grab a coffee.', mastery: 1 },
  { en: 'honestly', ru: 'честно говоря', type: 'word', source: 'Уличный опрос', example: 'Honestly, I agree with you.', mastery: 3 },
  { en: 'grab', ru: 'взять, схватить', type: 'word', source: 'Уличный опрос', example: "Let's grab a coffee.", mastery: 2 },
  { en: 'believe', ru: 'верить', type: 'word', source: 'Сцена из фильма', example: "I can't believe it.", mastery: 3 },
  { en: 'absolutely', ru: 'абсолютно, полностью', type: 'word', source: 'Мини-урок', example: 'That was absolutely insane.', mastery: 1 },
  { en: 'insane', ru: 'безумный, нереальный', type: 'word', source: 'Мем', example: 'That trick was insane.', mastery: 0 },
];
