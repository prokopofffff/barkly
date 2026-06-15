// Test preload (configured in apps/server/bunfig.toml). Runs before any test
// module is imported, so lib/config.ts — which parses process.env at import time
// and REQUIRES DATABASE_URL + JWT_SECRET — always succeeds, no matter which test
// file loads config first. Without this the suite is order-dependent: a test that
// pulls in config (e.g. an ingest stage) before another sets the env would throw.
// Real values can still be supplied by the environment (e.g. RUN_DB_TESTS runs).
process.env.JWT_SECRET ??= "test-secret-please-change";
process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/test";
