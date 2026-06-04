import { Hono } from "hono";
import { z } from "zod";
import { bearerToken, verifyToken } from "@/lib/jwt";
import { AuthError, createAnonymousUser, linkIdentity, type Provider } from "@/domain/auth/auth-service";

// Auth routes (thin — parse + authorize + delegate to the auth service).
// Implements the stubs the mobile client expects (apps/mobile/src/lib/auth):
//   POST /auth/anonymous            -> mint an anonymous session
//   POST /auth/link/email           -> link email+password (no OTP yet)
//   POST /auth/link/{apple,google}  -> link an OAuth identity (token verify: A4)

export const auth = new Hono();

/** Pull the verified userID from the `Authorization: Bearer <jwt>` header. */
async function requireUser(authorization: string | undefined): Promise<string> {
  const token = bearerToken(authorization);
  if (!token) throw new AuthError("bad_request", "missing bearer token");
  try {
    return (await verifyToken(token)).sub;
  } catch {
    throw new AuthError("invalid_credentials", "invalid token");
  }
}

const STATUS = { invalid_credentials: 401, not_found: 404, bad_request: 400 } as const;

/** Run a handler, mapping AuthError/zod failures to clean HTTP responses. */
async function handle(fn: () => Promise<unknown>) {
  try {
    return { status: 200 as number, body: await fn() };
  } catch (err) {
    if (err instanceof AuthError) return { status: STATUS[err.code], body: { error: err.code } };
    if (err instanceof z.ZodError) return { status: 400, body: { error: "bad_request" } };
    throw err;
  }
}

auth.post("/anonymous", async (c) => {
  const { status, body } = await handle(() => createAnonymousUser());
  return c.json(body, status as 200);
});

const emailBody = z.object({ email: z.string().email(), password: z.string().min(6) });
auth.post("/link/email", async (c) => {
  const { status, body } = await handle(async () => {
    const userID = await requireUser(c.req.header("authorization"));
    const { email, password } = emailBody.parse(await c.req.json());
    return linkIdentity({ currentUserID: userID, provider: "email", subject: email, secret: password });
  });
  return c.json(body, status as 200);
});

// OAuth: until A4 wires native id-token verification, the route trusts an
// already-verified `subject` (the provider `sub`) + optional email.
const oauthBody = z.object({ subject: z.string().min(1), email: z.string().email().optional() });
for (const provider of ["apple", "google"] as const satisfies readonly Provider[]) {
  auth.post(`/link/${provider}`, async (c) => {
    const { status, body } = await handle(async () => {
      const userID = await requireUser(c.req.header("authorization"));
      const { subject } = oauthBody.parse(await c.req.json());
      return linkIdentity({ currentUserID: userID, provider, subject });
    });
    return c.json(body, status as 200);
  });
}
