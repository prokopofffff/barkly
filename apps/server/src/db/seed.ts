import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { seedVideos } from "@/db/seed-videos.gen";
import {
  aggregateByVideo,
  materializeVideoAnalytics,
  type ProgressRow,
  type WatchEventRow,
} from "@/domain/analytics";

// Dev seed: one demo user plus enough content to light up every screen over
// Zero. The feed videos come from `seed-videos.gen.ts` — a snapshot of real,
// pipeline-rated YouTube Shorts (regenerate with `bun run db:export-videos`);
// the rest is hand-written placeholder data.
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
      friendshipLevel: 8,
      wordsLearned: 312,
      league: "Изумрудная",
      leagueRank: 3,
      mascotCosmetic: "cap",
      onboarded: true,
      createdAt: now,
    })
    .onConflictDoNothing();

  await db
    .insert(s.video)
    .values(seedVideos.map((v, i) => (i < 3 ? { ...v, creatorId: U } : v)))
    .onConflictDoNothing();

  // Watch history for the demo owner's first 3 clips (bk-cj6.24). A spread of
  // viewers (some completed, some not) so the denormalized creator stats below
  // aggregate to realistic views + completion. One row per (user, video).
  const [v0, v1, v2] = seedVideos.map((v) => v.id);
  if (!v0 || !v1 || !v2) throw new Error("seed: expected at least 3 seedVideos");
  const seededProgress: ProgressRow[] = [
    // v0: 5 viewers, 4 completed -> 80%
    { userID: U, videoID: v0, completed: true },
    { userID: "u_max", videoID: v0, completed: true },
    { userID: "u_sofia", videoID: v0, completed: true },
    { userID: "u_timur", videoID: v0, completed: true },
    { userID: "u_jenny", videoID: v0, completed: false },
    // v1: 4 viewers, 2 completed -> 50%
    { userID: U, videoID: v1, completed: true },
    { userID: "u_max", videoID: v1, completed: true },
    { userID: "u_ilya", videoID: v1, completed: false },
    { userID: "u_timur", videoID: v1, completed: false },
    // v2: 3 viewers, 1 completed -> 33%
    { userID: "u_sofia", videoID: v2, completed: true },
    { userID: "u_jenny", videoID: v2, completed: false },
    { userID: "u_ilya", videoID: v2, completed: false },
  ];

  await db
    .insert(s.progress)
    .values(
      seededProgress.map((p, i) => ({
        id: `${p.userID}:${p.videoID}`,
        userID: p.userID,
        videoID: p.videoID,
        watchedMs: 4000 + i * 500,
        completed: p.completed,
        score: p.completed ? 60 + ((i * 7) % 40) : (i * 11) % 60,
        updatedAt: now,
      })),
    )
    .onConflictDoNothing();

  // Denormalize per-video creator stats from exactly those seeded rows.
  for (const [videoID, { views, completionRate }] of aggregateByVideo(seededProgress)) {
    await db.update(s.video).set({ views, completionRate }).where(eq(s.video.id, videoID));
  }

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
    .insert(s.league)
    .values([
      { id: "emerald", name: "Изумрудная лига", daysLeft: 3 },
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
      { id: `${U}:n1`, userID: U, kind: "streak", title: "Шарик скучает! 🐶", text: "Не теряй стрик 47 дней — пройди один урок сегодня.", time: "сейчас", accent: "#ff8a3d", read: false, createdAt: now - 5_000 },
      { id: `${U}:n2`, userID: U, kind: "friend", title: "Sofia обогнала тебя!", text: "Она набрала 3 890 XP. Догонишь?", time: "12 мин", accent: "#c084fc", read: false, createdAt: now - 12 * 60_000 },
      { id: `${U}:n3`, userID: U, kind: "xp", title: "Новый уровень — 12! ⚡", text: "Ты теперь «Болтун». Открыт новый скин.", time: "1 ч", accent: "#ffd83d", read: false, createdAt: now - 60 * 60_000 },
      { id: `${U}:n4`, userID: U, kind: "reward", title: "Сундук готов открыться", text: "Заработай 100 XP, чтобы получить награду.", time: "3 ч", accent: "#b6f23d", read: false, createdAt: now - 3 * 60 * 60_000 },
      { id: `${U}:n5`, userID: U, kind: "friend", title: "kirill_92 теперь твой друг", text: "Соревнуйтесь в недельной лиге!", time: "вчера", accent: "#34e3ff", read: false, createdAt: now - 24 * 60 * 60_000 },
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

  // Per-day activity rollup for the demo user — last 7 calendar days (bk-cj6.26).
  // Day-keys are the YYYY-MM-DD prefix of each date's ISO string; id = U:day.
  const activityDays = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(now - i * 86_400_000).toISOString().slice(0, 10);
    return {
      id: `${U}:${day}`,
      userID: U,
      day,
      xp: 40 + ((i * 47) % 281), // 40..320-ish, varied
      lessons: 1 + (i % 6), // 1..6
      minutes: 8 + ((i * 13) % 40),
    };
  });
  await db.insert(s.dailyActivity).values(activityDays).onConflictDoNothing();

  // Raw watch events across the demo owner's first 3 clips from several viewers
  // (bk-cj6.26). Mostly "reach" at increasing depths, plus a few replay/answer
  // interactions; one row per (user, video, posPct, kind).
  const watchViewers = [U, "u_max", "u_sofia", "u_timur", "u_jenny", "u_ilya"];
  const watchEvents: WatchEventRow[] = [];
  [v0, v1, v2].forEach((videoID, vi) => {
    watchViewers.forEach((userID, ui) => {
      // Deeper reach for earlier viewers, tapering per later video.
      const depth = Math.max(20, 100 - ui * 12 - vi * 8);
      for (let p = 20; p <= depth; p += 20) {
        watchEvents.push({ userID, videoID, posPct: p, kind: "reach" });
      }
    });
    // A few explicit interactions that feed the engagement curve.
    watchEvents.push({ userID: U, videoID, posPct: 32, kind: "replay" });
    watchEvents.push({ userID: "u_max", videoID, posPct: 68, kind: "answer" });
    watchEvents.push({ userID: "u_sofia", videoID, posPct: 68 - vi * 4, kind: "replay" });
  });
  await db
    .insert(s.watchEvent)
    .values(
      watchEvents.map((e) => ({
        id: `${e.userID}:${e.videoID}:${e.posPct}:${e.kind}`,
        userID: e.userID,
        videoID: e.videoID,
        posPct: e.posPct,
        kind: e.kind,
        createdAt: now,
      })),
    )
    .onConflictDoNothing();

  // Materialize per-video retention + engagement from exactly those events.
  const analytics = materializeVideoAnalytics(watchEvents);
  await db
    .insert(s.videoAnalytics)
    .values(
      [...analytics].map(([videoID, { retention, engagement }]) => ({
        videoID,
        retention,
        engagement,
      })),
    )
    .onConflictDoNothing();

  // Editor quiz-marker timeline for the first clip (bk-cj6.25) — matches the
  // editor defaults (mc @ 32, fill @ 68) plus a meaning marker near the end.
  await db
    .insert(s.quizMarker)
    .values([
      { id: `${v0}:32:mc`, videoID: v0, pos: 32, type: "mc" as const, createdAt: now },
      { id: `${v0}:68:fill`, videoID: v0, pos: 68, type: "fill" as const, createdAt: now },
      { id: `${v0}:88:meaning`, videoID: v0, pos: 88, type: "meaning" as const, createdAt: now },
    ])
    .onConflictDoNothing();

  console.log("✅ seeded demo data");
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
