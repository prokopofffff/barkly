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

  // Anthropic — the ingestion LLM stages (classify, lesson). Optional at boot;
  // src/ingest/anthropic.ts fails fast if used without either credential.
  // Provide ONE of: ANTHROPIC_API_KEY (console.anthropic.com, x-api-key) or
  // ANTHROPIC_AUTH_TOKEN (OAuth bearer; note: subscription tokens are scoped to
  // Claude Code and may be rejected for direct API use).
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_AUTH_TOKEN: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-haiku-4-5"),
});

export type Config = z.infer<typeof envSchema>;

export const config: Config = envSchema.parse(process.env);
