import type { CustomMutatorDefs, ServerTransaction } from "@rocicorp/zero/server";
import type { PostgresJsTransaction } from "@rocicorp/zero/server/adapters/postgresjs";
import { createMutators, type Quiz, type Schema } from "@barkly/zero";
import { applyEarn, gradeQuiz } from "@/domain/lessons/economy";

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

    async completeQuiz(tx, a) {
      const userID = requireUser();
      const video = await one(tx, 'SELECT quiz FROM video WHERE id = $1', [a.videoID]);
      if (!video) throw new Error("video not found");
      const quiz = video.quiz as Quiz; // jsonb → object (postgres-js parses it)
      const correct = gradeQuiz(quiz, a.selected);

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
