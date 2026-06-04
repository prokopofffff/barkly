/**
 * The Zero schema is GENERATED from the Drizzle schema (the Postgres source of
 * truth) via drizzle-zero — run `bun run zero:generate` in apps/server after
 * changing apps/server/src/db/schema.ts. This module just re-exports the
 * generated artifact (schema, Schema, the Row types, and the `zql`/`builder`
 * query builders) so app code imports a stable `@barkly/zero` path.
 *
 * Do not edit schema.gen.ts by hand.
 */
export * from './schema.gen';
