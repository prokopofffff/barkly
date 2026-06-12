import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { authIdentity } from "@/db/auth-schema";
import { mintTokens, type Role, type TokenPair } from "@/lib/jwt";
import { mergeAccounts } from "@/domain/auth/merge";

// Anonymous-first auth service (DEV_STANDARDS §9, BACKEND_PLAN §6). Owns the
// identity lifecycle: mint an anonymous user on first launch, then link a real
// identity in place (same userID) — merging into an existing account when that
// identity already belongs to one.

export type Provider = "email" | "apple" | "google";

/** A typed error so routes can map a failure to the right HTTP status. */
export class AuthError extends Error {
  constructor(
    readonly code: "invalid_credentials" | "not_found" | "bad_request",
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export type Session = {
  userID: string;
  isAnonymous: boolean;
  email?: string;
  role: Role;
} & TokenPair;

function shortId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

/** Mint a brand-new anonymous user + token pair. */
export async function createAnonymousUser(): Promise<Session> {
  const userID = `anon_${shortId()}`;
  await db.insert(s.user).values({
    id: userID,
    handle: `@guest_${userID.slice(5, 11)}`,
    name: "Гость",
    isAnonymous: true,
    createdAt: Date.now(),
  });
  const tokens = await mintTokens(userID, true, "basic");
  return { userID, isAnonymous: true, role: "basic", ...tokens };
}

/**
 * Link `provider:subject` to the signed-in user (`currentUserID`), keeping the
 * userID stable so synced progress carries over. Three cases:
 *  - identity new            → bind it, de-anonymize the current user
 *  - identity already ours   → idempotent no-op
 *  - identity owned by A      → merge current user into A, return A
 *
 * Email is verified by password (no OTP yet); Apple/Google subjects are assumed
 * already verified from the native id-token (token verification lands in A4).
 */
export async function linkIdentity(args: {
  currentUserID: string;
  provider: Provider;
  subject: string;
  /** Email: the raw password. OAuth: ignored. */
  secret?: string;
}): Promise<Session> {
  const provider = args.provider;
  const subject = provider === "email" ? args.subject.trim().toLowerCase() : args.subject.trim();
  if (!subject) throw new AuthError("bad_request", "subject required");
  if (provider === "email" && !args.secret) throw new AuthError("bad_request", "password required");

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(authIdentity)
      .where(and(eq(authIdentity.provider, provider), eq(authIdentity.subject, subject)));

    let canonical = args.currentUserID;

    if (existing) {
      if (existing.userID !== args.currentUserID) {
        // Identity belongs to another account. For email, prove ownership with
        // the password before merging — otherwise this is account takeover.
        if (provider === "email") {
          const ok = existing.secret
            ? await Bun.password.verify(args.secret as string, existing.secret)
            : false;
          if (!ok) throw new AuthError("invalid_credentials", "wrong email or password");
        }
        await mergeAccounts(tx, args.currentUserID, existing.userID);
        canonical = existing.userID;
      }
      // identity already ours → fall through (idempotent)
    } else {
      const secretHash = provider === "email" ? await Bun.password.hash(args.secret as string) : null;
      await tx.insert(authIdentity).values({
        id: `${provider}:${subject}`,
        provider,
        subject,
        userID: args.currentUserID,
        secret: secretHash,
        createdAt: Date.now(),
      });
    }

    await tx
      .update(s.user)
      .set({ isAnonymous: false, ...(provider === "email" ? { email: subject } : {}) })
      .where(eq(s.user.id, canonical));

    const [row] = await tx.select().from(s.user).where(eq(s.user.id, canonical));
    // Mint with the stored role. Env-admin bootstrap is applied authoritatively
    // by roles.ts effectiveRole() at the gate, not baked into the token here.
    const role: Role = row?.role ?? "basic";
    const tokens = await mintTokens(canonical, false, role);
    return { userID: canonical, isAnonymous: false, email: row?.email ?? undefined, role, ...tokens };
  });
}
