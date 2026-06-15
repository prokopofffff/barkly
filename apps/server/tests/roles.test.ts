import { describe, expect, it } from "bun:test";

// Integration: the role grant/gate logic (bk-jaz.9.1) against Postgres. Guarded
// by RUN_DB_TESTS like auth-flow.test, so the default `bun test` stays green:
//   RUN_DB_TESTS=1 DATABASE_URL=postgres://… JWT_SECRET=… bun test
const RUN = !!process.env.RUN_DB_TESTS;

describe.skipIf(!RUN)("roles (db)", () => {
  it("defaults to basic, admin can grant curator, non-admin cannot, env-admin overrides", async () => {
    process.env.ADMIN_USER_IDS = "team_admin";
    const { createAnonymousUser, linkIdentity, AuthError } = await import("@/domain/auth/auth-service");
    const { effectiveRole, grantRole } = await import("@/domain/auth/roles");
    const { db } = await import("@/db");
    const s = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");

    // A fresh user is "basic".
    const u = await createAnonymousUser();
    expect(u.role).toBe("basic");
    expect(await effectiveRole(u.userID)).toBe("basic");

    // An env-listed id is admin even with no DB row.
    expect(await effectiveRole("team_admin")).toBe("admin");

    // A non-admin cannot grant.
    await expect(grantRole(u.userID, u.userID, "curator")).rejects.toBeInstanceOf(AuthError);

    // Anonymous users can't be promoted (a role needs a real identity).
    await expect(grantRole("team_admin", u.userID, "curator")).rejects.toBeInstanceOf(AuthError);

    // Link an identity, then the env-admin grants curator — it sticks and the
    // next minted token reflects it.
    const email = `r_${crypto.randomUUID().slice(0, 8)}@example.com`;
    await linkIdentity({ currentUserID: u.userID, provider: "email", subject: email, secret: "secret123" });
    await grantRole("team_admin", u.userID, "curator");
    expect(await effectiveRole(u.userID)).toBe("curator");

    const [row] = await db.select().from(s.user).where(eq(s.user.id, u.userID));
    expect(row?.role).toBe("curator");

    // Re-linking the same email re-mints a token carrying the granted role.
    const relinked = await linkIdentity({
      currentUserID: u.userID,
      provider: "email",
      subject: email,
      secret: "secret123",
    });
    expect(relinked.role).toBe("curator");
  });
});
