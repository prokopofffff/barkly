import { describe, expect, it } from "bun:test";

// Pure round-trip — no DB. Sets config env before the dynamic import so
// importing jwt.ts (which reads config) succeeds without a real environment.
describe("jwt", () => {
  it("round-trips userID + anon claim, rejects garbage", async () => {
    process.env.JWT_SECRET ??= "test-secret-please-change";
    process.env.DATABASE_URL ??= "postgresql://u:p@localhost:5432/db";
    const { mintTokens, verifyToken } = await import("@/lib/jwt");

    const { token, refreshToken } = await mintTokens("anon_abc", true);
    expect(token).not.toBe(refreshToken);

    const claims = await verifyToken(token);
    expect(claims.sub).toBe("anon_abc");
    expect(claims.anon).toBe(true);

    await expect(verifyToken("not-a-jwt")).rejects.toThrow();
  });
});
