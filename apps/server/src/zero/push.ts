import { Hono } from "hono";
import { PushProcessor } from "@rocicorp/zero/server";
import { zeroPostgresJS } from "@rocicorp/zero/server/adapters/postgresjs";
import { createMutators, schema } from "@barkly/zero";
import { config } from "@/lib/config";

// Zero custom-mutators push endpoint. It runs the SHARED mutators (@barkly/zero)
// authoritatively inside a Postgres transaction — the exact definitions the
// mobile client applies optimistically, so client and server can never drift.
//
// TODO (anti-cheat — apps/server/docs/BACKEND_PLAN.md §5): override the economy
// mutators (earnXp / completeQuiz / reviewWord / claimReward) here to recompute
// XP/streak/gems and re-grade quizzes from server state instead of trusting the
// client-supplied values, and derive the user id from the verified JWT.

// Built lazily so importing this module (e.g. in tests) doesn't open a DB pool.
const makeProcessor = () => new PushProcessor(zeroPostgresJS(schema, config.DATABASE_URL));
let processor: ReturnType<typeof makeProcessor> | undefined;

export const push = new Hono();

push.post("/", async (c) => {
  processor ??= makeProcessor();
  const result = await processor.process(createMutators(), c.req.raw);
  return c.json(result);
});
