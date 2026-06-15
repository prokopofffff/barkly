import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { config } from "@/lib/config";
import type { Role } from "@/lib/jwt";
import { AuthError } from "@/domain/auth/auth-service";

// Authoritative role logic (bk-jaz.9.1). The JWT carries a `role` claim for
// convenience, but it can go stale (a grant lands mid-token-lifetime), so the
// server resolves the *effective* role from the DB on every privileged action.
//
// `config.ADMIN_USER_IDS` always wins: those team IDs are admin even if the DB
// row says "basic", which bootstraps the very first grant.

export type { Role };

const RANK: Record<Role, number> = { basic: 0, curator: 1, admin: 2 };

/** Resolve a user's effective role from the DB, honouring the env admin list. */
export async function effectiveRole(userID: string): Promise<Role> {
  if (config.ADMIN_USER_IDS.includes(userID)) return "admin";
  const [row] = await db
    .select({ role: s.user.role })
    .from(s.user)
    .where(eq(s.user.id, userID));
  return row?.role ?? "basic";
}

/** Throw `invalid_credentials` unless the user holds at least `min`. */
export async function requireRole(userID: string, min: Role): Promise<Role> {
  const role = await effectiveRole(userID);
  if (RANK[role] < RANK[min]) throw new AuthError("invalid_credentials", `requires role ${min}`);
  return role;
}

/**
 * Grant (or revoke) a role. Admin-only: `actorID` must resolve to admin. The
 * env-admin bootstrap means you cannot demote an env admin's effective role,
 * but you can still set their DB column. Anonymous users cannot be promoted —
 * a role only sticks to a real (linked) identity.
 */
export async function grantRole(actorID: string, targetID: string, role: Role): Promise<void> {
  await requireRole(actorID, "admin");

  const [target] = await db
    .select({ id: s.user.id, isAnonymous: s.user.isAnonymous })
    .from(s.user)
    .where(eq(s.user.id, targetID));
  if (!target) throw new AuthError("not_found", "user not found");
  if (target.isAnonymous && role !== "basic") {
    throw new AuthError("bad_request", "cannot grant a role to an anonymous user");
  }

  await db.update(s.user).set({ role }).where(eq(s.user.id, targetID));
}
