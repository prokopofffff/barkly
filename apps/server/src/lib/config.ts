import { z } from "zod";

// Validate all configuration at startup — the process must fail fast on a
// missing or malformed value, never boot half-configured (DEV_STANDARDS §10).
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(1),
});

export type Config = z.infer<typeof envSchema>;

export const config: Config = envSchema.parse(process.env);
