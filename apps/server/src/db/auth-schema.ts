import { bigint, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

// Server-only auth tables. Deliberately kept OUT of `schema.ts` so drizzle-zero
// (which exports EVERY table it sees) never syncs identity/secrets to clients.
// drizzle.config.ts lists this file too, so migrations still cover it.

export const authIdentity = pgTable(
  "auth_identity",
  {
    id: text("id").primaryKey(), // `${provider}:${subject}`
    provider: text("provider").$type<"email" | "apple" | "google">().notNull(),
    // The provider's stable user id (Apple/Google `sub`) or the email address.
    subject: text("subject").notNull(),
    userID: text("user_id").notNull(), // -> user.id (kept stable across links)
    // Email password hash (Bun.password / argon2); null for OAuth providers.
    secret: text("secret"),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
  },
  (t) => [uniqueIndex("auth_identity_provider_subject").on(t.provider, t.subject)],
);

export type AuthIdentity = typeof authIdentity.$inferSelect;
