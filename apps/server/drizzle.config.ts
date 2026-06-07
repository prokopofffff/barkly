import { defineConfig } from "drizzle-kit";

export default defineConfig({
  // Synced tables + server-only tables (auth, ingestion). Only schema.ts feeds
  // drizzle-zero (see zero:generate); auth-schema.ts and ingest-schema.ts are
  // migrated but never synced to clients.
  schema: [
    "./src/db/schema.ts",
    "./src/db/auth-schema.ts",
    "./src/db/ingest-schema.ts",
  ],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
