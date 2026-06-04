import { defineConfig } from "drizzle-kit";

export default defineConfig({
  // Synced tables + server-only auth tables. Only schema.ts feeds drizzle-zero
  // (see zero:generate); auth-schema.ts is migrated but never synced.
  schema: ["./src/db/schema.ts", "./src/db/auth-schema.ts"],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
