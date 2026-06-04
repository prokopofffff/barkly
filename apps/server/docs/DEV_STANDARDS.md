# Barkly Backend — Development Standards

Conventions for the Barkly backend (the service behind the TikTok-style
language-learning feed). The mobile app is the client; this service owns writes,
auth, media orchestration, and AI content generation. When in doubt, match the
surrounding code, and keep this doc in sync with the mobile `DEV_STANDARDS.md`.

---

## 0. Architecture in one breath

The backend is **not a classic REST API**. Rocicorp **Zero** is the sync engine:

- **Reads** never hit this service. The client reads from a local replica that
  `zero-cache` keeps in sync via Postgres logical replication.
- **Writes** go client → Zero **custom mutators** → our **push endpoint**. A
  mutator function runs *optimistically* on the client and *authoritatively*
  here, in one Postgres transaction.
- This service is really four things: **(1)** the Zero push endpoint,
  **(2)** plain endpoints for what Zero is bad at (auth token minting, video
  upload/transcode orchestration, AI content jobs, push notifications),
  **(3)** the JWT issuer that `zero-cache` trusts, and **(4)** background workers
  for the content pipeline.

The product is **English for Russian speakers**: a video feed plus
Duolingo-style lessons (XP, streaks, spaced repetition).

## 1. Tooling & environment

- **Runtime is Bun.** Use `bun install`, `bun add`, `bun run`. Never run
  `npm`/`yarn`/`pnpm`. Commit `bun.lock`; never commit a
  `package-lock.json`/`yarn.lock`. (Same as mobile — one toolchain across repos.)
- **HTTP framework is Hono.** Keep route handlers thin; push logic into
  `src/<domain>`.
- `node_modules/.bin` tools run via `bunx` (e.g. `bunx tsc`, `bunx drizzle-kit`).
- Local stack runs via **Docker Compose**: Postgres, `zero-cache`, this service.
  `docker compose up` must give a working backend from a clean checkout.

## 2. Language & types

- **TypeScript, `strict` on.** No `any` without a `// reason:` comment. Prefer
  `unknown` + narrowing.
- **No `as` casts to silence the compiler.** Fix the type. Casts are allowed only
  for genuinely untyped boundaries, with a comment.
- Public functions get explicit return types; locals stay inferred.
- **Validate all external input with `zod`** at the boundary (HTTP bodies, job
  payloads, third-party responses) — never trust a parsed JSON shape.
- A change is not done until `bunx tsc --noEmit` is clean.

## 3. Project structure

```
src/
  index.ts        Hono app entry + middleware wiring
  routes/         HTTP routes ONLY (thin). One file per surface.
  zero/           push endpoint + server mutators (mirror of mobile mutators)
  db/             Drizzle schema, queries, migrations
  domain/<area>/  feature logic by domain (auth, feed, lessons, content, media)
  jobs/           pg-boss workers (transcode-orchestration, stt, question-gen)
  lib/            cross-cutting helpers (yandex clients, jwt, config)
```

- Routes and job handlers stay thin: parse + authorize + delegate. Logic lives in
  `src/domain/<area>`.
- Import with the `@/` alias (`@/domain/...`, `@/db/...`), never deep `../../`.

## 4. Naming

- **Files: `kebab-case`** — `push-endpoint.ts`, `lesson-service.ts`,
  `question-gen.job.ts`.
- Types/classes `PascalCase`, functions/vars `camelCase`, module constants
  `UPPER_SNAKE_CASE`.
- DB tables/columns `snake_case`; Drizzle maps them to `camelCase` in TS.

## 5. Data & schema — Drizzle is the single source of truth

- **The Postgres schema is defined once in Drizzle** (`src/db/schema.ts`). The
  Zero schema (`src/zero/schema.ts`) is **generated from it via `drizzle-zero`** —
  never hand-edit the Zero schema or let the two drift.
- The mobile app's `src/lib/zero/schema.ts` mirrors this same schema. A schema
  change is **one coordinated change**: Drizzle migration → regenerate Zero schema
  → update the mobile mirror. Never edit one side alone.
- **Migrations via `drizzle-kit`.** Every schema change ships a migration; never
  mutate a deployed schema by hand.
- `wal_level=logical` is required for Zero. On Yandex Managed PostgreSQL set
  **`max_slot_wal_keep_size` to a bounded value** — an inactive `zero-cache`
  replication slot with the default `-1` can fill the disk and lock the cluster.

## 6. Writes — Zero custom mutators

- **Every client write is a Zero custom mutator**, never a bespoke REST write.
  The client calls a mutator; we run it authoritatively in the push endpoint.
- **Mutators are shared with the client.** Write the mutator logic once in a form
  both repos use; the server version runs in a transaction via
  `@rocicorp/zero`'s `PushProcessor`. The client (optimistic) and server
  (authoritative) versions **must stay behavior-identical** — divergence shows up
  as UI that disagrees with the database.
- The push endpoint accepts a `POST`, runs each mutation in a Postgres txn,
  records that it ran, and returns which succeeded/failed. Return **401/403** to
  make Zero re-authenticate and retry; any other non-200 makes it retry after a
  delay — so make mutators **idempotent**.
- Authorization lives in the mutator (check the JWT claims against the row),
  not in client code.

## 7. Things that are NOT Zero (plain endpoints / jobs)

Some work doesn't fit the sync model and lives in `routes/` + `jobs/`:

- **Auth token minting** (§9).
- **Video upload + transcode orchestration** → Yandex **Cloud Video** (managed
  HLS). We store only the resulting `hlsUrl` pointer; **video is never synced
  through Zero**.
- **AI content pipeline** (§8).
- **Push notifications.**

## 8. Content pipeline — AI subtitles & questions

Lessons are **hand-authored**, but subtitles and questions are **AI-generated**,
then human-reviewed. The pipeline runs as `pg-boss` jobs:

```
upload → Cloud Video (HLS) → [job] SpeechKit STT (subtitles)
       → [job] YandexGPT (translate + generate questions)
       → human review/edit → publish
```

- **STT: Yandex SpeechKit.** **AI generation: YandexGPT.** Both are native to our
  cloud — no foreign-API access friction, and stronger on Russian. Don't add
  Claude/OpenAI without an explicit decision recorded here.
- **AI output is always `draft` until a human approves it.** Content has a
  `draft → reviewed → published` status; only `published` reaches learners.
  Never auto-publish generated questions.
- Jobs must be **idempotent and retry-safe** — a re-run must not double-charge
  AI calls or create duplicate rows. Key jobs by content id.

## 9. Auth — anonymous-first (Duolingo-style)

- **Every user starts as an anonymous session** minted on first launch. No login
  wall before value.
- We **mint short-lived JWTs**; anonymous and authed tokens look the same to
  `zero-cache`, which validates them for sync auth. The push endpoint trusts the
  same claims.
- **Linking an identity keeps the same `userID`** so progress carries over;
  `signOut` returns to a fresh anonymous session, never a dead end.
- Providers: **Sign in with Apple is mandatory** (App Store), Google supported.
- JWT signing keys are secrets (§10). Use `jose` for signing/verification.

## 10. Configuration & secrets

- All config via env vars, validated with `zod` at startup — the process must
  **fail fast** on missing/invalid config, never boot half-configured.
- **Secrets live only here**, never in the client (the client holds only the
  user's JWT). Never log secrets, tokens, or full AI prompts containing user data.
- Provide a `.env.example` with every key documented and dummy values.

## 11. Hosting — Yandex Cloud, self-managed services

- **Managed PostgreSQL** (logical replication enabled), **Object Storage**
  (S3-compatible, for media + the `zero-cache` replication backup), **Cloud CDN**
  (video delivery), **Cloud Video** (transcode), **SpeechKit**, **YandexGPT**.
- This service, the admin web app, and **`zero-cache`** run on Compute /
  Serverless Containers. `zero-cache` is **stateful** (keeps a SQLite replica on
  disk) — it needs a persistent volume and is the trickiest piece to deploy.
- Start simple (Docker Compose / single host); split services only when load
  demands it. Don't start on Kubernetes.

## 12. Quality gates

Available as Bun scripts:

```bash
bun run typecheck     # tsc --noEmit
bun run lint          # eslint
bun run test          # bun test
bun run check         # typecheck + lint (the fast pre-PR combo)
bun run db:generate   # drizzle-kit: emit migration from schema change
bun run zero:generate # regenerate Zero schema from Drizzle (drizzle-zero)
```

How they're enforced:

- **Pre-commit hook** runs `typecheck` + `lint` on every commit. Bypass a single
  commit with `git commit --no-verify` (use sparingly).
- **CI** runs `typecheck` + `lint` + `test` on every PR and on `main`. PRs must be
  green.

General:

- Keep changes scoped; match the existing file's comment density and idioms.
- A change that touches the schema is not done until the Drizzle migration, the
  regenerated Zero schema, and the mobile mirror are all updated together.
- Update this doc (and the mobile one) when you change the stack, a convention, or
  the architecture.
</content>
</invoke>
