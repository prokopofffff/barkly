import { z } from "zod";

// Validate all configuration at startup — the process must fail fast on a
// missing or malformed value, never boot half-configured (DEV_STANDARDS §10).
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(1),

  // Yandex Object Storage (S3-compatible). Optional at boot: only the ingestion
  // pipeline needs them, so the API can run without media access. lib/storage.ts
  // fails fast if used while the keys are absent.
  S3_ENDPOINT: z.string().url().default("https://storage.yandexcloud.net"),
  S3_REGION: z.string().default("ru-central1"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
});

export type Config = z.infer<typeof envSchema>;

export const config: Config = envSchema.parse(process.env);
