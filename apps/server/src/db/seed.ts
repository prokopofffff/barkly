import { db } from "@/db";
import * as s from "@/db/schema";

// Dev seed: one demo user plus the placeholder content the mobile app ships as
// fallback, so a freshly-migrated database lights up every screen over Zero.
// Run with `bun run db:seed` (after db:migrate). Idempotent via onConflictDoNothing.

const now = Date.now();
const U = "anon_demo";

async function seed() {
  await db
    .insert(s.user)
    .values({
      id: U,
      handle: "@anya_lvl",
      name: "Аня",
      isAnonymous: true,
      nativeLang: "ru",
      learningLang: "en",
      level: 12,
      levelName: "Болтун",
      xp: 2840,
      xpToday: 180,
      xpToNext: 3200,
      gems: 1240,
      streak: 47,
      league: "Изумрудная",
      leagueRank: 3,
      mascotCosmetic: "cap",
      onboarded: true,
      createdAt: now,
    })
    .onConflictDoNothing();

  await db
    .insert(s.video)
    .values([
      {
        id: "v1",
        category: "Сцена из фильма",
        catEn: "MOVIE SCENE",
        creatorName: "CineDose",
        creatorHandle: "@cinedose",
        creatorGradient: "fun",
        creatorFollowers: "1.2M",
        creatorVerified: true,
        creatorMascot: false,
        bgGradient: ["#3a1c5e", "#11122b"],
        caption: "Лучшая сцена для отработки фразовых глаголов 🎬",
        likes: "128K",
        comments: "2.4K",
        shares: "18K",
        tag: "#movies",
        subtitle: [
          { w: "I" },
          { w: "can't", t: "не могу" },
          { w: "believe", t: "поверить", key: true },
          { w: "you" },
          { w: "pulled", t: "провернул", key: true },
          { w: "this" },
          { w: "off", t: "(довести до конца)", key: true },
        ],
        quiz: {
          type: "mc",
          prompt: 'Что значит "to pull this off"?',
          options: ["Снять одежду", "Успешно справиться", "Отъехать на машине", "Сдаться"],
          answer: 1,
          xp: 30,
          explain: '"Pull off" — фразовый глагол: успешно сделать что-то трудное.',
        },
        hlsUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
        langCode: "en",
        level: "a2",
        createdAt: now - 4000,
      },
      {
        id: "v2",
        category: "Мем",
        catEn: "MEME",
        creatorName: "slanglord",
        creatorHandle: "@slanglord",
        creatorGradient: "brand",
        creatorFollowers: "880K",
        creatorVerified: true,
        creatorMascot: false,
        bgGradient: ["#0e3b2e", "#0a0f1e"],
        caption: "POV: твой друг опять опаздывает 💀 #relatable",
        likes: "342K",
        comments: "9.1K",
        shares: "44K",
        tag: "#meme",
        subtitle: [
          { w: "He" },
          { w: "is" },
          { w: "always", t: "всегда" },
          { w: "running", t: "бежит", key: true },
          { w: "late", t: "опаздывает", key: true },
          { w: "no" },
          { w: "cap", t: "без вранья (сленг)", key: true },
        ],
        quiz: {
          type: "fill",
          prompt: "Заполни пропуск так, как сказал бы носитель:",
          sentence: ["He is always", "___", "late, no cap"],
          choices: ["running", "walking", "flying", "sleeping"],
          answer: 0,
          xp: 25,
          explain: '"Running late" — устойчивое выражение «опаздывать».',
        },
        hlsUrl: "https://test-streams.mux.dev/pts_shift/master.m3u8",
        langCode: "en",
        level: "a2",
        createdAt: now - 3000,
      },
      {
        id: "v3",
        category: "Уличный опрос",
        catEn: "STREET",
        creatorName: "NYC Talks",
        creatorHandle: "@nyctalks",
        creatorGradient: "reward",
        creatorFollowers: "610K",
        creatorVerified: false,
        creatorMascot: false,
        bgGradient: ["#5e3a12", "#1a1208"],
        caption: "Спросили у прохожих в Нью-Йорке 🗽",
        likes: "76K",
        comments: "1.1K",
        shares: "8K",
        tag: "#street",
        subtitle: [
          { w: "Honestly", t: "честно говоря", key: true },
          { w: "I" },
          { w: "would" },
          { w: "rather", t: "скорее бы", key: true },
          { w: "grab", t: "схватить/взять", key: true },
          { w: "a" },
          { w: "coffee", t: "кофе" },
        ],
        quiz: {
          type: "reorder",
          prompt: "Собери фразу в правильном порядке:",
          words: ["I", "would", "rather", "grab", "coffee"],
          answer: ["I", "would", "rather", "grab", "coffee"],
          xp: 35,
          explain: '"Would rather" + глагол = «предпочёл бы».',
        },
        hlsUrl: "https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_ts/master.m3u8",
        langCode: "en",
        level: "b1",
        createdAt: now - 2000,
      },
      {
        id: "v4",
        category: "Мини-урок",
        catEn: "LESSON",
        creatorName: "Шарик",
        creatorHandle: "@gav_official",
        creatorGradient: "brand",
        creatorFollowers: "3.4M",
        creatorVerified: true,
        creatorMascot: true,
        bgGradient: ["#1c3a00", "#0a0f06"],
        caption: "3 способа сказать «я устал» как носитель 🐶",
        likes: "512K",
        comments: "12K",
        shares: "88K",
        tag: "#lesson",
        subtitle: [
          { w: "I'm" },
          { w: "absolutely", t: "абсолютно", key: true },
          { w: "wiped", t: "вымотан (сленг)", key: true },
          { w: "out", key: true },
          { w: "today", t: "сегодня" },
        ],
        quiz: {
          type: "meaning",
          prompt: "Что имел в виду говорящий?",
          options: ["Я очень устал", "Я промок", "Я заблудился", "Я проголодался"],
          answer: 0,
          xp: 30,
          explain: '"Wiped out" — разговорное «полностью без сил».',
        },
        hlsUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
        langCode: "en",
        level: "b1",
        createdAt: now - 1000,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(s.cosmetic)
    .values([
      { id: `${U}:cap`, userID: U, name: "Кепка", rarity: "Обычное", cost: 200, color: "#ff6fcf", owned: true, sort: 0 },
      { id: `${U}:glasses`, userID: U, name: "Очки", rarity: "Редкое", cost: 600, color: "#34e3ff", owned: true, sort: 1 },
      { id: `${U}:scarf`, userID: U, name: "Шарф", rarity: "Редкое", cost: 750, color: "#34e3ff", owned: false, sort: 2 },
      { id: `${U}:crown`, userID: U, name: "Корона", rarity: "Легендарное", cost: 3000, color: "#ffd83d", owned: false, sort: 3 },
    ])
    .onConflictDoNothing();

  await db
    .insert(s.leagueMember)
    .values([
      { id: "lm1", leagueId: "emerald", userID: "u_max", name: "Макс", gradient: "reward", xp: 4120, streak: 88 },
      { id: "lm2", leagueId: "emerald", userID: "u_sofia", name: "Sofia", gradient: "fun", xp: 3890, streak: 61 },
      { id: "lm3", leagueId: "emerald", userID: U, name: "Аня", gradient: "brand", xp: 2840, streak: 47 },
      { id: "lm4", leagueId: "emerald", userID: "u_timur", name: "Тимур", gradient: "streak", xp: 2610, streak: 33 },
      { id: "lm5", leagueId: "emerald", userID: "u_jenny", name: "jenny_k", gradient: "fun", xp: 2400, streak: 21 },
      { id: "lm6", leagueId: "emerald", userID: "u_ilya", name: "Илья", gradient: "brand", xp: 1980, streak: 12 },
      { id: "lm7", leagueId: "emerald", userID: "u_nastya", name: "nastya", gradient: "reward", xp: 1750, streak: 9 },
      { id: "lm8", leagueId: "emerald", userID: "u_artem", name: "Артём", gradient: "fun", xp: 1320, streak: 5 },
    ])
    .onConflictDoNothing();

  await db
    .insert(s.achievement)
    .values([
      { id: `${U}:streak50`, userID: U, icon: "fire", name: "Стрик 50", description: "50 дней подряд", done: false, color: "#ff8a3d", pct: 94, sort: 0 },
      { id: `${U}:bolt`, userID: U, icon: "bolt", name: "Молния", description: "10 000 XP", done: true, color: "#ffd83d", pct: 100, sort: 1 },
      { id: `${U}:wordday`, userID: U, icon: "sparkle", name: "Слово дня", description: "7 дней новых слов", done: true, color: "#c084fc", pct: 100, sort: 2 },
      { id: `${U}:champ`, userID: U, icon: "trophy", name: "Чемпион", description: "Топ-1 в лиге", done: false, color: "#34e3ff", pct: 40, sort: 3 },
    ])
    .onConflictDoNothing();

  await db
    .insert(s.notification)
    .values([
      { id: `${U}:n1`, userID: U, kind: "streak", title: "Шарик скучает! 🐶", text: "Не теряй стрик 47 дней — пройди один урок сегодня.", time: "сейчас", accent: "#ff8a3d", read: false, createdAt: now - 100 },
      { id: `${U}:n2`, userID: U, kind: "friend", title: "Sofia обогнала тебя!", text: "Она набрала 3 890 XP. Догонишь?", time: "12 мин", accent: "#c084fc", read: false, createdAt: now - 200 },
      { id: `${U}:n3`, userID: U, kind: "xp", title: "Новый уровень — 12! ⚡", text: "Ты теперь «Болтун». Открыт новый скин.", time: "1 ч", accent: "#ffd83d", read: false, createdAt: now - 300 },
      { id: `${U}:n4`, userID: U, kind: "reward", title: "Сундук готов открыться", text: "Заработай 100 XP, чтобы получить награду.", time: "3 ч", accent: "#b6f23d", read: false, createdAt: now - 400 },
      { id: `${U}:n5`, userID: U, kind: "friend", title: "kirill_92 теперь твой друг", text: "Соревнуйтесь в недельной лиге!", time: "вчера", accent: "#34e3ff", read: false, createdAt: now - 500 },
    ])
    .onConflictDoNothing();

  await db
    .insert(s.vocabulary)
    .values([
      { id: `${U}:pull off`, userID: U, en: "pull off", ru: "провернуть, успешно справиться", type: "phrase", source: "Сцена из фильма", example: "You pulled this off!", mastery: 1, createdAt: now - 90 },
      { id: `${U}:no cap`, userID: U, en: "no cap", ru: "без вранья, серьёзно (сленг)", type: "phrase", source: "Мем", example: "He is late, no cap.", mastery: 0, createdAt: now - 80 },
      { id: `${U}:running late`, userID: U, en: "running late", ru: "опаздывать", type: "phrase", source: "Мем", example: "Sorry, I am running late.", mastery: 2, createdAt: now - 70 },
      { id: `${U}:wiped out`, userID: U, en: "wiped out", ru: "вымотан, без сил", type: "phrase", source: "Мини-урок", example: "I'm wiped out today.", mastery: 0, createdAt: now - 60 },
      { id: `${U}:honestly`, userID: U, en: "honestly", ru: "честно говоря", type: "word", source: "Уличный опрос", example: "Honestly, I agree with you.", mastery: 3, createdAt: now - 50 },
    ])
    .onConflictDoNothing();

  console.log("✅ seeded demo data");
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
