# Barkly / ГАВ — Backend plan

How the screens connect to data today, what Zero gives us for free, and what we
still have to build on the server. Scope: everything the client (`src/lib/zero`)
already assumes but that does **not** live inside the Expo app.

Stack decision (see `AGENTS.md`): the backend is **TypeScript + Hono**, Postgres
for storage, **Zero (`@rocicorp/zero`) / zero-cache** for sync.

---

## 1. Architecture

```
                 ┌─────────────────────────── Expo app (this repo) ───────────────────────────┐
                 │  screens → useGame()/useFeedVideos()  reads: useQuery(...)  writes: z.mutate │
                 └───────▲───────────────────────────────▲───────────────────────────▲─────────┘
        JWT (auth)       │ reactive read sync            │ custom-mutator push        │ media
                 ┌───────┴───────┐            ┌──────────┴──────────┐        ┌────────┴────────┐
                 │  Auth service │            │   zero-cache        │        │  CDN / Mux      │
                 │  (Hono)       │            │ (read replica + WS) │        │  HLS + thumbs   │
                 └───────┬───────┘            └──────────┬──────────┘        └─────────────────┘
                         │                               │ logical replication
                         │                    ┌──────────┴──────────┐
                         └───── writes ───────►   Push endpoint      │  (Hono /push — runs the
                                  (authoritative│   + Postgres        │   server mutators below)
                                   mutators)    └─────────────────────┘
```

Three server surfaces:

1. **zero-cache** — replicates Postgres and streams reactive query results to the
   client's local SQLite replica. We deploy and configure it; we don't write it.
2. **Push endpoint** (`/push`) — a Hono route that re-runs our **custom mutators**
   authoritatively inside a Postgres transaction. This is where anti-cheat lives.
3. **Auth + plain HTTP API** — anonymous session creation, identity linking, and
   anything that isn't a synced read or a mutator (media upload, analytics).

---

## 2. What Zero already covers (no backend code, just config)

- **Reactive reads** for every screen via the builders in `src/lib/zero/queries.ts`
  (`useFeedQuery`, `useCurrentUserQuery`, `useVocabularyQuery`, `useLeaderboardQuery`,
  `useAchievementsQuery`, `useCosmeticsQuery`, `useNotificationsQuery`,
  `useProgressForUser`). Offline-first, instant, live-updating.
- **Optimistic writes + sync** for every action via `src/lib/zero/mutators.ts`
  (`earnXp`, `completeQuiz`, `toggleLike`, `followCreator`, `saveWord`, `reviewWord`,
  `equipCosmetic`, `claimReward`, `completeOnboarding`).
- **Local persistence** (expo-sqlite) and **per-user partitioning** (provider keys
  storage by `userID`).

**Client status today:** the app runs Zero **local-only** (no `EXPO_PUBLIC_ZERO_SERVER`).
The replica is empty, so screens fall back to bundled placeholders
(`src/lib/feed/{sample-videos,app-data}.ts`) via `useFeedVideos()` and the
`game-context` optimistic store. Optimistic mutator dispatch is gated behind
`ZERO_ENABLED` (`src/lib/zero/provider.ts`), so wiring up the backend lights the
screens up with **no client changes** beyond setting env vars.

---

## 3. Postgres schema (source of truth)

`zero-cache` replicates these tables; `src/lib/zero/schema.ts` mirrors them. The
Zero `video` row is a **denormalized read model** — keep creators/quizzes
normalized in Postgres and expose the flat shape through a view.

```sql
create table app_user (
  id            text primary key,            -- 'anon_…' or linked id
  handle        text not null,
  name          text not null,
  is_anonymous  boolean not null default true,
  email         text,
  native_lang   text not null default 'ru',
  learning_lang text not null default 'en',
  level         int  not null default 1,
  level_name    text not null default '',
  xp            int  not null default 0,
  xp_today      int  not null default 0,
  xp_to_next    int  not null default 1000,
  gems          int  not null default 0,
  streak        int  not null default 0,
  last_active   date,                          -- for streak rollover
  league        text not null default '',
  league_rank   int  not null default 0,
  mascot_cosmetic text not null default '',
  onboarded     boolean not null default false,
  created_at    bigint not null
);

create table creator (
  handle text primary key, name text not null, gradient text not null,
  followers text not null, verified boolean not null, is_mascot boolean not null default false
);

create table video (
  id text primary key,
  creator_handle text not null references creator(handle),
  category text not null, cat_en text not null,
  bg_gradient jsonb not null,                  -- [from, to]
  caption text not null, tag text not null,
  likes text not null, comments text not null, shares text not null,
  subtitle jsonb not null,                     -- SubtitleToken[]
  quiz jsonb not null,                         -- Quiz
  hls_url text not null, lang_code text not null, level text not null,
  created_at bigint not null
);
-- feed_video view = video ⨝ creator, projected to the client's denormalized row.

create table vocabulary (
  id text primary key,                         -- '{user}:{en}'
  user_id text not null references app_user(id),
  en text not null, ru text not null, type text not null,
  source text not null, example text not null,
  mastery int not null default 0, created_at bigint not null
);

create table league (id text primary key, name text not null, ends_at bigint not null);
create table league_member (
  id text primary key, league_id text references league(id),
  user_id text references app_user(id), name text not null, gradient text not null,
  xp int not null default 0, streak int not null default 0
);

create table achievement (
  id text primary key, user_id text references app_user(id),
  icon text, name text, description text, done boolean, color text, pct int, sort int
);

create table cosmetic (                          -- per-user ownership row, id '{user}:{cosmeticId}'
  id text primary key, user_id text references app_user(id),
  name text, rarity text, cost int, color text, owned boolean default false, sort int
);

create table notification (
  id text primary key, user_id text references app_user(id),
  kind text, title text, text text, time text, accent text,
  read boolean default false, created_at bigint not null
);

create table "like"   (id text primary key, user_id text, video_id text, created_at bigint);
create table follow   (id text primary key, user_id text, creator_handle text, created_at bigint);
create table progress (id text primary key, user_id text, video_id text,
                       watched_ms int, completed boolean, score int, updated_at bigint);
```

Migrations live with the backend (e.g. `drizzle`/`kysely` migrations). **Never edit
`schema.ts` without a matching migration** (DEV_STANDARDS §6).

---

## 4. zero-cache

- Deploy `zero-cache` pointed at Postgres logical replication (`wal_level=logical`).
- Set `EXPO_PUBLIC_ZERO_SERVER` to its public WebSocket URL → flips `ZERO_ENABLED`.
- **Read permissions** — implemented in `packages/zero/src/permissions.ts`
  (`definePermissions`): `video`/`leagueMember` are public; `user` (by `id`) and
  `vocabulary`/`achievement`/`cosmetic`/`notification`/`like`/`follow`/`progress`
  (by `user_id`) are row-scoped to `auth.sub`. zero-cache denies reads with no
  rule, so deploy them after `db:migrate`/`db:seed`:
  `ZERO_UPSTREAM_DB=… bun run zero:deploy-perms` (writes the upstream
  `zero.permissions` table; entry = `src/zero/schema-config.ts`). Writes are NOT
  governed here — they go through the authoritative push mutators (§5).
  (`definePermissions` is deprecated in Zero 1.6 → migrate to query/mutator auth.)
- JWT verification key shared with the auth service (`ZERO_AUTH_SECRET`/JWKS).
  Note: `ZERO_AUTH_SECRET` is deprecated in zero-cache 1.6 (move to a JWK).

---

## 5. Push endpoint — authoritative mutators (the important part)

`POST /push` runs the **same-named** mutators as `src/lib/zero/mutators.ts`, but
server-side and **authoritatively**. Use Zero's `PushProcessor` + a Postgres
adapter; implement one handler per mutator name. Rules:

- **Identity from the JWT, never the args.** `ctx.userID = jwt.sub`. Ignore any
  client-supplied `userID`.
- **Recompute economy values; never trust the client.** The client sends optimistic
  totals for snappy UI, but the server derives them:
  - `earnXp` / `reviewWord` flashcard XP → clamp per-action XP, apply daily caps,
    derive `gems = floor(xp/2)`, update `streak` from `last_active`.
  - `completeQuiz` → **re-grade** against the stored `quiz.answer`; award XP only if
    correct; recompute combo. This is the core anti-cheat path.
  - `claimReward` → verify the chest is actually available (server-side cooldown)
    before granting the cosmetic + gems.
- **Idempotency**: Zero supplies a per-client `mutationID`; persist last-seen id per
  client so retries don't double-apply.
- **Ownership checks**: `equipCosmetic` requires an owned `cosmetic` row; `toggleLike`/
  `followCreator` validate the target exists.
- Wrap each mutation in a single SQL transaction; return success/error so the client
  can roll back its optimistic state.

Recommended files (backend repo): `push/processor.ts`, `push/mutators/*.ts` (mirror
the client names), `push/economy.ts` (XP/streak/league math, shared rules).

---

## 6. Auth service (Hono)

Implements the stubs in `src/lib/auth/auth-context.tsx`:

- `POST /auth/anonymous` → create `app_user(is_anonymous=true)`, return `{ userID, token }`.
- `POST /auth/link/email` `/auth/link/apple` `/auth/link/google` → **keep the same
  `userID`** (merge identity in place) so synced progress carries over; rotate JWT.
- JWT: `sub = userID`, short TTL + refresh; signed with `ZERO_AUTH_SECRET`. The client
  stores it in `expo-secure-store` and hands it to Zero as `auth`.
- **Sign in with Apple is mandatory** if we offer Google/email (App Store rule).
- **Email is unverified for now** — the client links in place with email+password and
  no confirmation. Follow-up: `POST /auth/email/start` (send OTP) + `/auth/email/verify`
  (confirm code, then flip `is_anonymous`). Until then treat email-linked accounts as
  unverified.
- An **identity table** maps providers → user: `auth_identity(provider, subject, user_id)`
  with `unique(provider, subject)`. Linking inserts a row; one `app_user` can own
  several identities (Apple + Google + email all resolving to the same `userID`).
- The onboarding answers the client collects (CEFR level / goals / daily target) have
  **no columns yet** — add `learning_level text`, `goals text[]`, `daily_target int`
  to `app_user` (one migration) so they can sync. Until then the mobile app keeps them
  device-local (`src/lib/profile/local-profile.tsx`) and only `onboarded`/`learning_lang`
  round-trip via the `completeOnboarding` mutator.

### Account merge on link

Linking is **identity-keyed**, so platform (iOS/Android) is irrelevant — a merge is
needed only when the **same identity** (an email/Apple/Google subject) is presented
from a second device that already accrued anonymous progress.

- **No conflict** (identity is new): just bind it to the current `userID`. Done.
- **Conflict** (identity already maps to user `A`, current device is anon user `B`):
  fold `B` into the canonical `A`, return `A`'s `{ userID, token }`, and let the client
  re-partition its Zero store. Do the whole fold in **one Postgres transaction**.

Per-field merge policy (server-authoritative — recompute, never trust the client):

| Data | Rule |
| --- | --- |
| `xp`, `gems` | **sum**, but **excluding starter/onboarding bonuses** — only earned XP merges (track bonus XP separately, or subtract the known +50 onboarding grant before summing) so multi-device farming can't inflate totals |
| `level`, `xp_to_next`, `xp_today` | **recompute** from the merged `xp` (do not add directly) |
| `streak`, `last_active` | **max** |
| `vocabulary` | **union by word**, keep the higher `mastery` |
| `cosmetic` (owned) | **union**; equipped cosmetic taken from canonical `A` |
| `achievement` | **union**; `done=true` wins, `pct = max` |
| `follow`, `like` | **union**, dedup by target |
| `progress` (per video) | **union by `video_id`**; `max(watched_ms, score)`, `completed=true` wins |
| `native_lang` / `learning_lang` / onboarding prefs | take `A`'s; fall back to `B` only where `A` is empty |

- **Idempotency**: key the merge on the link request (or Zero's `mutationID`) and
  tombstone `B` with `merged_into = A` instead of hard-deleting, so a retried link is a
  no-op and any late-arriving `B` writes can be redirected.
- **Starter-bonus rule** (above) is the one explicit anti-abuse measure for v1; broader
  economy re-derivation lives in the push endpoint (§5).

---

## 7. Content pipeline — YouTube Shorts embed-only (MVP)

**MVP decision:** the app shows **only YouTube Shorts**, embedded via the official
IFrame player (`video.youtube_id` set, `video.hls_url = ""`). We store, download, or
transcode **no** video server-side. The self-hosted media path (signed upload → object
storage → `ffmpeg`/HLS → poster/CDN, `lib/storage.ts` + `ingest/download.ts` +
`ingest/ffmpeg.ts`) is **retained in-tree but out of scope** for MVP; it returns when a
real Studio upload flow lands.

Content reaches the feed two ways, both ending at the existing **promote** stage which
writes the embed-only `video` row:

- **Automated discovery** (current): allowlisted seed channels → `yt-dlp` enumerate
  `/shorts` → ingest pipeline.
- **Curator submission** (this work): a curator pastes a single YouTube Shorts URL.

### Curator submission flow

1. **Who may submit — curator + admin only.** Two roles for MVP:
   - `admin` — full access (the team).
   - `curator` — vetted users granted submission rights.
   - Basic users see a **"Стать куратором"** ("Be our curator") button → submits an
     application; we contact them by email to vet their skills before granting the role.
   - Everywhere submission UI appears, show a banner: **"Скоро создавать видео смогут
     все"** ("Creating videos will be open to everyone soon").
2. **Endpoint** (`apps/server/src/routes`, curator/admin-gated by JWT role): accept a
   YouTube URL → extract the video id.
3. **Validate** via `yt-dlp` metadata that it is a playable, **embeddable** Short
   (`playable_in_embed = true`, duration/format sanity).
4. **Dedupe** against `video` + `ingest_video` (the YouTube id is the row id).
5. **Inject** an `ingest_video` row and run it through the **full** existing pipeline —
   `transcribe → features → classify → difficulty → lesson → promote`. No fast-path:
   curator content still passes the LLM safety/topic gates, gets an ELO difficulty, and
   gets its `subtitle` + `quiz` generated (both required for the learning UX).
6. **Promote** writes the embed-only `video` row (`youtube_id` set, `hls_url = ""`).

The app just plays `youtube_id` via the IFrame player (bk-z5t.14); `hls_url`/`thumb`
stay empty for embedded clips.

**Implemented (bk-jaz.9.1 + .9.2):**

- `user.role` (`basic`/`curator`/`admin`), synced so the mobile UI reacts to a grant
  live. `ADMIN_USER_IDS` env bootstraps the first admins.
- `POST /admin/role` `{ userID, role }` — admin-only grant/revoke (vetting is manual,
  by email). Gated by the **effective** role (DB + env), not the JWT claim.
- `POST /curator/videos` `{ url }` — curator/admin submit; `202` when newly queued,
  `200` when already in the feed/pipeline. `GET /curator/videos/:id` reports pipeline
  status for the UI to poll.
- `CURATOR_AUTOPROCESS=true` fire-and-forget drains the queue (single-flight) after a
  submission; set `false` in production and run a dedicated worker (§8).

---

## 8. Periodic / async jobs

- **Streak rollover** (daily cron): reset `xp_today`, decrement/break `streak` using
  `last_active`; emit "Шарик скучает" notifications.
- **Leagues** (weekly cron): assign users to cohorts, compute promotion/relegation
  (top-3 up, bottom-2 down — the leaderboard screen's zones), open a new `league`.
- **Push notifications**: store Expo push tokens; schedule streak/friend/reward nudges
  (the `notification` rows + a real APNs/FCM send).
- **Analytics ingestion** (Studio retention curve + engagement heatmap): event stream
  (`video_view`, `watch_progress`, `quiz_answer`) → rollups the Studio reads.

---

## 9. Client work remaining to "fully connect" (small, after backend exists)

The data layer is in place; these are one-liners per screen once rows are served:

- Profile / Rewards / Leaderboard / Achievements / Notifications: swap their
  placeholder constants for the matching `useQuery(useXxxQuery(userID))` (+ a tiny
  row→props map, mirroring `useFeedVideos`). A `useFallbackQuery(query, fallback)`
  helper can encapsulate the "rows-or-placeholder" pattern.
- Vocabulary: read `useVocabularyQuery(userID)` instead of `game-context` once the
  user row exists (writes already route through `saveWord`/`reviewWord`).
- Feed: `likes`/`follow`/`completeQuiz` actions can call `z.mutate.*` directly
  (today only `earnXp`/`saveWord` fire via `game-context`).
- Replace `useFeedVideos`' hardcoded `'en'` with the user's `learning_lang`.

---

## 10. Environment variables

Client (`EXPO_PUBLIC_*`, public — never secrets):
- `EXPO_PUBLIC_ZERO_SERVER` — zero-cache WS URL (enables sync + writes).
- `EXPO_PUBLIC_API_URL` — auth/REST base URL.

Backend (secret): `DATABASE_URL`, `ZERO_AUTH_SECRET`, `ZERO_UPSTREAM_DB`, Mux/CDN
keys, APNs/FCM credentials, OAuth client secrets.

---

## 11. Suggested rollout order

1. Postgres + migrations + zero-cache; seed `video`/`creator`/`cosmetic`/`league`.
   Set `EXPO_PUBLIC_ZERO_SERVER` → feed/cosmetics/leaderboard read live.
2. Auth service (anonymous first) → real `userID` + JWT → per-user reads + read perms.
3. Push endpoint with authoritative mutators (start with `earnXp`, `completeQuiz`,
   `saveWord`, `equipCosmetic`) → writes persist + anti-cheat.
4. Media pipeline + Studio publish.
5. Crons (streak, leagues) + push notifications + analytics.
```
