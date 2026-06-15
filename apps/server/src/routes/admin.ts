import { Hono } from "hono";
import { z } from "zod";
import { effectiveRole, grantRole } from "@/domain/auth/roles";
import { handle, requireUser } from "@/routes/http";

// Admin surface (bk-jaz.9.1). The one MVP endpoint grants/revokes the content
// role after a curator applicant is vetted by email. Gated by the *effective*
// role (DB + env admin list), not just the JWT claim, so it stays correct even
// if the caller's token predates their own grant.

export const admin = new Hono();

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
