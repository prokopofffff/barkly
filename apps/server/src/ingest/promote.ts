import { eq } from "drizzle-orm";
import type { GradientName, Quiz, SubtitleToken } from "@barkly/zero";

// Promote (bk-z5t.12, variant B): copy an approved + quizzed clip into the
// Zero-synced `video` table the mobile feed reads. The clip plays via the
// YouTube IFrame embed (video.youtubeId); no media URLs. Quiz + subtitle tokens
// come from the lesson stage; the rest is mapped from channel/classification/
// difficulty metadata.

type Labels = { ru: string; en: string };

const TOPIC_LABELS: Record<string, Labels> = {
  daily_life: { ru: "Повседневная жизнь", en: "DAILY LIFE" },
  travel: { ru: "Путешествия", en: "TRAVEL" },
  food: { ru: "Еда", en: "FOOD" },
  shopping: { ru: "Шопинг", en: "SHOPPING" },
  productivity: { ru: "Продуктивность", en: "PRODUCTIVITY" },
  technology: { ru: "Технологии", en: "TECHNOLOGY" },
  study_tips: { ru: "Советы по учёбе", en: "STUDY TIPS" },
  street_interviews: { ru: "Уличные интервью", en: "STREET INTERVIEWS" },
  funny_conversations: { ru: "Смешные разговоры", en: "FUNNY" },
  workplace_conversations: { ru: "Разговоры на работе", en: "WORKPLACE" },
  relationship_conversations: { ru: "Отношения", en: "RELATIONSHIPS" },
  movies_tv: { ru: "Кино и ТВ", en: "MOVIES & TV" },
  english_learning: { ru: "Английский язык", en: "ENGLISH" },
  other: { ru: "Разное", en: "MISC" },
};

export function topicLabels(topic: string): Labels {
  return TOPIC_LABELS[topic] ?? TOPIC_LABELS.other!;
}

// Stable, deterministic accent/backdrop from a seed (channel/video id) so a
// clip always looks the same across re-promotes.
function hash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const GRADIENTS: readonly GradientName[] = ["brand", "reward", "fun", "streak"];
export function pickGradient(seed: string): GradientName {
  return GRADIENTS[hash(seed) % GRADIENTS.length]!;
}

const BG_GRADIENTS: readonly (readonly [string, string])[] = [
  ["#3a1c5e", "#11122b"],
  ["#1c3a5e", "#0b1626"],
  ["#5e1c2e", "#2b1116"],
  ["#1c5e3a", "#0b261a"],
  ["#5e4a1c", "#26200b"],
];
export function pickBgGradient(seed: string): readonly [string, string] {
  return BG_GRADIENTS[hash(seed) % BG_GRADIENTS.length]!;
}

/** Human-friendly count: 1234 -> "1.2K", 2_500_000 -> "2.5M". */
export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function handleFrom(seed: string, channelHandle: string | null): string {
  if (channelHandle) return channelHandle;
  return `@${seed.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 16)}`;
}

// --- stage runner ------------------------------------------------------------

export type PromoteResult = {
  videoId: string;
  ok: boolean;
  error?: string;
};

export async function runPromote(opts: {
  limit: number;
  persist: boolean;
}): Promise<PromoteResult[]> {
  const { db } = await import("@/db");
  const { video } = await import("@/db/schema");
  const { ingestChannel, ingestVideo, videoClassification, videoDifficulty, videoLesson } =
    await import("@/db/ingest-schema");

  const rows = await db
    .select({
      id: ingestVideo.id,
      channelName: ingestChannel.title,
      channelHandle: ingestChannel.handle,
      topic: videoClassification.topic,
      captionRu: videoLesson.captionRu,
      subtitle: videoLesson.subtitle,
      quiz: videoLesson.quiz,
      prior: videoDifficulty.priorDifficulty,
    })
    .from(ingestVideo)
    .innerJoin(ingestChannel, eq(ingestChannel.id, ingestVideo.channelId))
    .innerJoin(
      videoClassification,
      eq(videoClassification.videoId, ingestVideo.id),
    )
    .innerJoin(videoLesson, eq(videoLesson.videoId, ingestVideo.id))
    .leftJoin(videoDifficulty, eq(videoDifficulty.videoId, ingestVideo.id))
    .where(eq(ingestVideo.status, "quizzed"))
    .limit(opts.limit);

  const results: PromoteResult[] = [];
  for (const row of rows) {
    try {
      if (!row.quiz) throw new Error("no quiz on lesson");
      const labels = topicLabels(row.topic);

      const videoRow = {
        id: row.id,
        category: labels.ru,
        catEn: labels.en,
        creatorName: row.channelName,
        creatorHandle: handleFrom(row.channelName, row.channelHandle),
        creatorGradient: pickGradient(row.id),
        creatorFollowers: "",
        creatorVerified: false,
        creatorMascot: false,
        bgGradient: pickBgGradient(row.id) as readonly [string, string],
        caption: row.captionRu,
        // Engagement counts come from OUR platform (the like/comment/repost
        // tables), not YouTube — seed them at zero so real activity takes over.
        likes: "0",
        comments: "0",
        shares: "0",
        tag: `#${row.topic}`,
        subtitle: row.subtitle as readonly SubtitleToken[],
        quiz: row.quiz as Quiz,
        hlsUrl: "",
        youtubeId: row.id,
        langCode: "en",
        // Difficulty is the ELO prior (0-1000); the app has no CEFR concept.
        // The LLM english_level stays ingestion-only in video_classification.
        difficulty: Math.round(row.prior ?? 0),
        createdAt: Date.now(),
      };

      if (opts.persist) {
        await db
          .insert(video)
          .values(videoRow)
          .onConflictDoUpdate({ target: video.id, set: videoRow });
        await db
          .update(ingestVideo)
          .set({
            status: "promoted",
            promotedVideoId: row.id,
            error: null,
            updatedAt: new Date(),
          })
          .where(eq(ingestVideo.id, row.id));
      }

      results.push({ videoId: row.id, ok: true });
    } catch (err) {
      const message = (err as Error).message;
      if (opts.persist) {
        await db
          .update(ingestVideo)
          .set({ status: "failed", error: message, updatedAt: new Date() })
          .where(eq(ingestVideo.id, row.id));
      }
      results.push({ videoId: row.id, ok: false, error: message });
    }
  }

  return results;
}
