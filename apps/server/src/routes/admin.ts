import { Hono } from "hono";
import { z } from "zod";
import { bearerToken, verifyToken } from "@/lib/jwt";
import { AuthError } from "@/domain/auth/auth-service";
import { effectiveRole, grantRole } from "@/domain/auth/roles";

// Admin surface (bk-jaz.9.1). The one MVP endpoint grants/revokes the content
// role after a curator applicant is vetted by email. Gated by the *effective*
// role (DB + env admin list), not just the JWT claim, so it stays correct even
// if the caller's token predates their own grant.

export const admin = new Hono();

const STATUS = { invalid_credentials: 401, not_found: 404, bad_request: 400 } as const;

async function requireUser(authorization: string | undefined): Promise<string> {
  const token = bearerToken(authorization);
  if (!token) throw new AuthError("bad_request", "missing bearer token");
  try {
    return (await verifyToken(token)).sub;
  } catch {
    throw new AuthError("invalid_credentials", "invalid token");
  }
}

async function handle(fn: () => Promise<unknown>) {
  try {
    return { status: 200 as number, body: await fn() };
  } catch (err) {
    if (err instanceof AuthError) return { status: STATUS[err.code], body: { error: err.code } };
    if (err instanceof z.ZodError) return { status: 400, body: { error: "bad_request" } };
    throw err;
  }
}

const roleBody = z.object({
  userID: z.string().min(1),
  role: z.enum(["admin", "curator", "basic"]),
});

// POST /admin/role — grant or revoke a content role. Admin only (grantRole
// enforces it). Body: { userID, role }.
admin.post("/role", async (c) => {
  const { status, body } = await handle(async () => {
    const actorID = await requireUser(c.req.header("authorization"));
    const { userID, role } = roleBody.parse(await c.req.json());
    await grantRole(actorID, userID, role);
    return { userID, role };
  });
  return c.json(body, status as 200);
});

// GET /admin/me — debug helper: the caller's effective role. Any authed user.
admin.get("/me", async (c) => {
  const { status, body } = await handle(async () => {
    const userID = await requireUser(c.req.header("authorization"));
    return { userID, role: await effectiveRole(userID) };
  });
  return c.json(body, status as 200);
});
