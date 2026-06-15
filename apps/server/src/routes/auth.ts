import { Hono } from "hono";
import { z } from "zod";
import { createAnonymousUser, linkIdentity, type Provider } from "@/domain/auth/auth-service";
import { handle, requireUser } from "@/routes/http";

// Auth routes (thin — parse + authorize + delegate to the auth service).
// Implements the stubs the mobile client expects (apps/mobile/src/lib/auth):
//   POST /auth/anonymous            -> mint an anonymous session
//   POST /auth/link/email           -> link email+password (no OTP yet)
//   POST /auth/link/{apple,google}  -> link an OAuth identity (token verify: A4)

export const auth = new Hono();

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
