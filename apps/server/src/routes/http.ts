import { z } from "zod";
import { bearerToken, verifyToken } from "@/lib/jwt";
import { AuthError } from "@/domain/auth/auth-service";

// Shared route plumbing: bearer-token auth + error→HTTP mapping, so each route
// file (auth, admin, curator) doesn't re-implement the same boilerplate.

export const STATUS = { invalid_credentials: 401, not_found: 404, bad_request: 400 } as const;

/** Pull the verified userID from the `Authorization: Bearer <jwt>` header. */
export async function requireUser(authorization: string | undefined): Promise<string> {
  const token = bearerToken(authorization);
  if (!token) throw new AuthError("bad_request", "missing bearer token");
  try {
    return (await verifyToken(token)).sub;
  } catch {
    throw new AuthError("invalid_credentials", "invalid token");
  }
}

/** Map a common route error (AuthError / zod) to a clean response; rethrow the
 * rest. Callers with their own error types check those first, then delegate. */
export function mapRouteError(err: unknown): { status: number; body: { error: string } } {
  if (err instanceof AuthError) return { status: STATUS[err.code], body: { error: err.code } };
  if (err instanceof z.ZodError) return { status: 400, body: { error: "bad_request" } };
  throw err;
}

/** Run a handler, returning its result as a 200 body or a mapped error. */
export async function handle(fn: () => Promise<unknown>): Promise<{ status: number; body: unknown }> {
  try {
    return { status: 200, body: await fn() };
  } catch (err) {
    return mapRouteError(err);
  }
}
