import { Hono } from "hono";
import { z } from "zod";
import { config } from "@/lib/config";
import { AuthError } from "@/domain/auth/auth-service";
import { requireRole } from "@/domain/auth/roles";
import { submitYouTubeShort, SubmitError } from "@/domain/curator/submit";
import { drainPipelineOnce } from "@/ingest/drain";
import { mapRouteError, requireUser } from "@/routes/http";

// Curator surface (bk-jaz.9.2). A vetted curator/admin pastes a YouTube Shorts
// URL → we validate + queue it into the ingest pipeline. Gated by the EFFECTIVE
// role (DB + env admin list), not the raw JWT claim, so a fresh grant takes
// effect immediately. The "be our curator" application + UI live in mobile
// (bk-jaz.9.3); this is the backend it calls.

export const curator = new Hono();

const SUBMIT_STATUS = {
  invalid_url: 400,
  not_embeddable: 422,
  not_a_short: 422,
  fetch_failed: 502,
} as const;

/** Verify the bearer token and require at least the curator role. */
async function requireCurator(authorization: string | undefined): Promise<string> {
  const userID = await requireUser(authorization);
  await requireRole(userID, "curator"); // throws invalid_credentials if below
  return userID;
}

// Like the shared handle(), but the success path carries its own status (202
// queued vs 200 duplicate), and SubmitError maps before the common errors.
async function handle(fn: () => Promise<{ status: number; body: unknown }>) {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof SubmitError) return { status: SUBMIT_STATUS[err.code], body: { error: err.code } };
    return mapRouteError(err);
  }
}

const submitBody = z.object({ url: z.string().min(1) });

// POST /curator/videos — submit a YouTube Shorts URL. 202 when newly queued,
// 200 when it's already in the feed or pipeline.
curator.post("/videos", async (c) => {
  const { status, body } = await handle(async () => {
    await requireCurator(c.req.header("authorization"));
    const { url } = submitBody.parse(await c.req.json());
    const result = await submitYouTubeShort({ url });
    if (result.status === "queued" && config.CURATOR_AUTOPROCESS) {
      // Fire-and-forget: drive the queued candidate through the pipeline.
      void drainPipelineOnce().catch((e) => console.error("curator drain failed:", e));
    }
    return { status: result.status === "queued" ? 202 : 200, body: result };
  });
  return c.json(body, status as 200);
});

// GET /curator/videos/:id — pipeline status of a submission (for the curator UI
// to poll until it lands in the feed).
curator.get("/videos/:id", async (c) => {
  const { status, body } = await handle(async () => {
    await requireCurator(c.req.header("authorization"));
    const id = c.req.param("id");
    const { db } = await import("@/db");
    const { ingestVideo } = await import("@/db/ingest-schema");
    const { eq } = await import("drizzle-orm");
    const [row] = await db
      .select({
        id: ingestVideo.id,
        status: ingestVideo.status,
        rejectReason: ingestVideo.rejectReason,
        promotedVideoId: ingestVideo.promotedVideoId,
      })
      .from(ingestVideo)
      .where(eq(ingestVideo.id, id));
    if (!row) throw new AuthError("not_found", "no such submission");
    return { status: 200, body: row };
  });
  return c.json(body, status as 200);
});
