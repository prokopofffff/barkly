import { Hono } from "hono";
import { PushProcessor } from "@rocicorp/zero/server";
import { zeroPostgresJS } from "@rocicorp/zero/server/adapters/postgresjs";
import { schema } from "@barkly/zero";
import { config } from "@/lib/config";
import { bearerToken, verifyToken } from "@/lib/jwt";
import { createServerMutators } from "@/zero/server-mutators";

// Zero custom-mutators push endpoint. It runs the AUTHORITATIVE mutators
// (src/zero/server-mutators.ts) inside a Postgres transaction — the same names
// the mobile client applies optimistically, but recomputed server-side so the
// two can't drift and the client can't cheat the economy (BACKEND_PLAN §5).
//
// Identity comes from the verified JWT, not the request body. PushProcessor
// handles per-client mutation idempotency itself.

// Built lazily so importing this module (e.g. in tests) doesn't open a DB pool.
const makeProcessor = () => new PushProcessor(zeroPostgresJS(schema, config.DATABASE_URL));
let processor: ReturnType<typeof makeProcessor> | undefined;

export const push = new Hono();

push.post("/", async (c) => {
  const token = bearerToken(c.req.header("authorization"));
  let userID: string | null = null;
  if (token) {
    try {
      userID = (await verifyToken(token)).sub;
    } catch {
      return c.json({ error: "invalid_token" }, 401);
    }
  }

  processor ??= makeProcessor();
  const result = await processor.process(createServerMutators({ userID }), c.req.raw);
  return c.json(result);
});
