import { describe, expect, it } from "bun:test";

// Integration: the real anonymous → link → merge flow against Postgres. Guarded
// by RUN_DB_TESTS so the default `bun test` (CI without a DB) stays green; run
// it with a migrated database:
//   RUN_DB_TESTS=1 DATABASE_URL=postgres://… JWT_SECRET=… bun test
const RUN = !!process.env.RUN_DB_TESTS;

describe.skipIf(!RUN)("auth flow (db)", () => {
  it("links in place, then merges a second device — excluding starter bonus", async () => {
    const { createAnonymousUser, linkIdentity } = await import("@/domain/auth/auth-service");
    const { db } = await import("@/db");
    const s = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");

    // Device 1: anonymous, earns progress, links an email (same userID kept).
    const d1 = await createAnonymousUser();
    await db
      .update(s.user)
      .set({ xp: 100, gems: 50, onboarded: true })
      .where(eq(s.user.id, d1.userID));
    const email = `t_${crypto.randomUUID().slice(0, 8)}@example.com`;
    const linked = await linkIdentity({
      currentUserID: d1.userID,
      provider: "email",
      subject: email,
      secret: "secret123",
    });
    expect(linked.userID).toBe(d1.userID);
    expect(linked.isAnonymous).toBe(false);
    expect(linked.email).toBe(email);

    // Device 2: a fresh anonymous session with its own progress + a saved word,
    // links the SAME email/password → folds into device 1's account.
    const d2 = await createAnonymousUser();
    await db
      .update(s.user)
      .set({ xp: 80, gems: 40, streak: 7, onboarded: true })
      .where(eq(s.user.id, d2.userID));
    await db.insert(s.vocabulary).values({
      id: `${d2.userID}:hi`,
      userID: d2.userID,
      en: "hi",
      ru: "привет",
      type: "word",
      source: "test",
      example: "hi there",
      mastery: 2,
      createdAt: Date.now(),
    });

    const merged = await linkIdentity({
      currentUserID: d2.userID,
      provider: "email",
      subject: email,
      secret: "secret123",
    });
    expect(merged.userID).toBe(d1.userID); // canonical A wins

    const [a] = await db.select().from(s.user).where(eq(s.user.id, d1.userID));
    // xp: 100 + (80 - 50 starter) = 130 ; gems: 50 + (40 - 25) = 65 ; streak max
    expect(a?.xp).toBe(130);
    expect(a?.gems).toBe(65);
    expect(a?.streak).toBe(7);

    const [b] = await db.select().from(s.user).where(eq(s.user.id, d2.userID));
    expect(b?.mergedInto).toBe(d1.userID); // tombstoned

    const [word] = await db.select().from(s.vocabulary).where(eq(s.vocabulary.id, `${d1.userID}:hi`));
    expect(word?.mastery).toBe(2); // vocab carried over to A

    // Wrong password must NOT take over the email account.
    const d3 = await createAnonymousUser();
    await expect(
      linkIdentity({ currentUserID: d3.userID, provider: "email", subject: email, secret: "WRONG" }),
    ).rejects.toThrow();
  });
});
