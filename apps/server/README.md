# barkly-back

Backend for Barkly — a TikTok-style language-learning app (English for Russian
speakers). The mobile app is the client; this service owns writes, auth, media
orchestration, and AI content generation.

## Stack

- **Runtime:** Bun · **HTTP:** Hono
- **Sync:** Rocicorp Zero — reads come from the client replica via `zero-cache`;
  writes go through custom mutators → our push endpoint
- **DB:** Postgres via Drizzle (single schema source; Zero schema generated with
  `drizzle-zero`)
- **Jobs:** pg-boss · **Auth:** anonymous-first JWT (`jose`)
- **Cloud:** managed Postgres + S3-compatible object storage + CDN (provider TBD)

See [`docs/DEV_STANDARDS.md`](docs/DEV_STANDARDS.md) for conventions.

## Develop

```bash
bun install            # also wires the pre-commit hook
cp .env.example .env    # fill in values
docker compose up       # Postgres + zero-cache + app
bun run dev             # or run the app directly with hot reload
```

## Quality gates

```bash
bun run check     # typecheck + lint (the fast pre-PR combo)
bun run test
```

Enforced by a pre-commit hook (`typecheck` + `lint`) and CI on every PR.
