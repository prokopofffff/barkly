import { ANYONE_CAN, definePermissions, type PermissionsConfig } from "@rocicorp/zero";
import { schema, type Schema } from "./schema.gen";

/**
 * Zero read permissions (BACKEND_PLAN §4). zero-cache denies reads by default,
 * so every syncable table needs an explicit rule:
 *  - `video` / `leagueMember` are PUBLIC (feed + leaderboard show everyone).
 *  - everything user-owned is row-scoped to `auth.sub` (the JWT subject =
 *    userID), so a client only ever syncs its own rows.
 *
 * `auth.sub` matches the token minted in apps/server/src/lib/jwt.ts; zero-cache
 * validates it with the shared secret.
 *
 * NOTE: writes are NOT governed here — they go through the authoritative push
 * mutators (src/zero/server-mutators.ts). The deprecated insert/update/delete
 * asset rules are intentionally omitted. (definePermissions itself is marked
 * deprecated in Zero 1.6 in favour of query/mutator auth — migrate later.)
 *
 * `video.quiz` carries the answer; that's acceptable because grading authority
 * is the server re-grade in completeQuiz, not the client.
 */

/** The JWT claims zero-cache verifies (see lib/jwt.ts). */
export type AuthData = { sub: string };

export const permissions = definePermissions<AuthData, Schema>(schema, () => {
  return {
    // Public reads.
    video: { row: { select: ANYONE_CAN } },
    leagueMember: { row: { select: ANYONE_CAN } },
    league: { row: { select: ANYONE_CAN } },
    // Comments are public — everyone viewing a video sees its comments.
    comment: { row: { select: ANYONE_CAN } },
    // Materialized per-video analytics + editor quiz markers are public (like video).
    videoAnalytics: { row: { select: ANYONE_CAN } },
    quizMarker: { row: { select: ANYONE_CAN } },

    // User-owned — only the authed user's own rows sync.
    user: { row: { select: [(auth, eb) => eb.cmp("id", "=", auth.sub)] } },
    vocabulary: { row: { select: [(auth, eb) => eb.cmp("userID", "=", auth.sub)] } },
    achievement: { row: { select: [(auth, eb) => eb.cmp("userID", "=", auth.sub)] } },
    cosmetic: { row: { select: [(auth, eb) => eb.cmp("userID", "=", auth.sub)] } },
    notification: { row: { select: [(auth, eb) => eb.cmp("userID", "=", auth.sub)] } },
    like: { row: { select: [(auth, eb) => eb.cmp("userID", "=", auth.sub)] } },
    follow: { row: { select: [(auth, eb) => eb.cmp("userID", "=", auth.sub)] } },
    progress: { row: { select: [(auth, eb) => eb.cmp("userID", "=", auth.sub)] } },
    dailyActivity: { row: { select: [(auth, eb) => eb.cmp("userID", "=", auth.sub)] } },
    watchEvent: { row: { select: [(auth, eb) => eb.cmp("userID", "=", auth.sub)] } },
    dailyChestClaim: { row: { select: [(auth, eb) => eb.cmp("userID", "=", auth.sub)] } },
  } satisfies PermissionsConfig<AuthData, Schema>;
});
