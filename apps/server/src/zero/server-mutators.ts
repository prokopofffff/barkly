import type { CustomMutatorDefs, ServerTransaction } from "@rocicorp/zero/server";
import type { PostgresJsTransaction } from "@rocicorp/zero/server/adapters/postgresjs";
import { createMutators, type Quiz, type Schema } from "@barkly/zero";
import { applyEarn, gradeQuiz } from "@/domain/lessons/economy";
import {
  applyEloResult,
  applyRewatchPenalty,
  DEFAULT_ELO,
  seedElo,
} from "@/domain/lessons/elo";

// Authoritative server mutators (BACKEND_PLAN §5). The push endpoint re-runs the
// SAME-named mutators the client applies optimistically, but here we:
//   - take the userID from the verified JWT (`ctx`), never the client args,
//   - recompute the economy from current DB state instead of trusting totals,
//   - re-grade quizzes against the stored answer.
// Non-economy mutators delegate to the shared definitions (their CRUD bodies are
// already authoritative-safe). Idempotency is handled by PushProcessor (it
// dedupes by clientID + mutationID), so mutators don't track that themselves.

type Tx = ServerTransaction<Schema, PostgresJsTransaction>;

export type ServerCtx = { userID: string | null };

/** Read a single row by id via the raw SQL escape hatch (server-only). */
async function one(tx: Tx, sql: string, args: unknown[]): Promise<Record<string, unknown> | undefined> {
  const rows = [...(await tx.dbTransaction.query(sql, args))];
  return rows[0] as Record<string, unknown> | undefined;
}

export function createServerMutators(ctx: ServerCtx): CustomMutatorDefs<Tx> {
  const shared = createMutators();

  /** Identity comes from the JWT — never the client-supplied userID. */
  function requireUser(): string {
    if (!ctx.userID) throw new Error("unauthenticated");
    return ctx.userID;
  }

  /** Recompute + persist an XP grant from the user's current DB state. */
  async function awardXp(tx: Tx, userID: string, amount: number): Promise<void> {
    const row = await one(tx, 'SELECT xp, xp_today FROM "user" WHERE id = $1', [userID]);
    const next = applyEarn({ xp: Number(row?.xp ?? 0), xpToday: Number(row?.xp_today ?? 0) }, amount);
    await tx.mutate.user.update({ id: userID, xp: next.xp, xpToday: next.xpToday, gems: next.gems });
  }

  // Start from the shared (client-optimistic) mutators — their non-economy CRUD
  // bodies are safe to run authoritatively as-is — then override the economy
  // ones with server-recomputed versions.
  return {
    ...shared,

    async earnXp(tx, a) {
      await awardXp(tx, requireUser(), a.amount);
    },

    // Seed the starting ELO from the onboarding self-assessment (authoritative;
    // identity from the JWT). `learningLevel` now carries the friendly key
    // (only_starting…fluent), not a CEFR letter.
    async completeOnboarding(tx, a) {
      await tx.mutate.user.update({
        id: requireUser(),
        learningLang: a.learningLang,
        learningLevel: a.learningLevel,
        goals: a.goals,
        dailyTarget: a.dailyTarget,
        onboarded: true,
        elo: seedElo(a.learningLevel),
        eloGames: 0,
      });
    },

    async completeQuiz(tx, a) {
      const userID = requireUser();
      const video = await one(tx, "SELECT quiz, difficulty FROM video WHERE id = $1", [a.videoID]);
      if (!video) throw new Error("video not found");
      const quiz = video.quiz as Quiz; // jsonb → object (postgres-js parses it)
      const correct = gradeQuiz(quiz, a.selected);

      // Adaptive ELO (bk-z5t.19). First genuine attempt moves the rating by the
      // graded result; a re-attempt (rewatch + retry) only ever costs a little
      // and never grants ELO — so the rating can't be farmed by replaying.
      const priorProgress = await one(
        tx,
        "SELECT id FROM progress WHERE user_id = $1 AND video_id = $2",
        [userID, a.videoID],
      );
      const u = await one(tx, 'SELECT elo, elo_games FROM "user" WHERE id = $1', [userID]);
      const state = {
        elo: Number(u?.elo ?? DEFAULT_ELO),
        games: Number(u?.elo_games ?? 0),
      };
      const next = priorProgress
        ? applyRewatchPenalty(state)
        : applyEloResult(state, Number(video.difficulty ?? 0), quiz.type, correct);
      await tx.mutate.user.update({ id: userID, elo: next.elo, eloGames: next.games });

      await tx.mutate.progress.upsert({
        id: a.progressID,
        userID,
        videoID: a.videoID,
        watchedMs: 0,
        completed: true,
        score: correct ? 100 : 0,
        updatedAt: Date.now(),
      });

      // Award the quiz's own XP only when the server-graded answer is correct.
      if (correct) await awardXp(tx, userID, quiz.xp);
    },
  } satisfies CustomMutatorDefs<Tx>;
}
