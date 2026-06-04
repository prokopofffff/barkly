import { SignJWT, jwtVerify } from "jose";
import { config } from "@/lib/config";

// JWT minting/verification for anonymous-first auth (DEV_STANDARDS §9). HS256
// with JWT_SECRET — the SAME secret zero-cache holds as ZERO_AUTH_SECRET, so a
// token we mint here is accepted for sync auth and at the push endpoint.
//
// Anonymous and linked tokens are structurally identical (only the `anon`
// claim differs); zero-cache cares only about `sub` = userID.

const secret = new TextEncoder().encode(config.JWT_SECRET);

const ACCESS_TTL = "1h";
const REFRESH_TTL = "30d";

export type Claims = { sub: string; anon: boolean };

export type TokenPair = { token: string; refreshToken: string };

export async function mintTokens(userID: string, isAnonymous: boolean): Promise<TokenPair> {
  const token = await new SignJWT({ anon: isAnonymous })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userID)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TTL)
    .sign(secret);

  const refreshToken = await new SignJWT({ typ: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userID)
    .setIssuedAt()
    .setExpirationTime(REFRESH_TTL)
    .sign(secret);

  return { token, refreshToken };
}

export async function verifyToken(token: string): Promise<Claims> {
  const { payload } = await jwtVerify(token, secret);
  if (typeof payload.sub !== "string") throw new Error("token missing sub");
  return { sub: payload.sub, anon: payload.anon === true };
}

/** Pull the raw JWT out of an `Authorization: Bearer <jwt>` header value. */
export function bearerToken(authorization: string | undefined): string | undefined {
  return authorization?.replace(/^Bearer\s+/i, "");
}
