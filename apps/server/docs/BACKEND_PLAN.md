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
- **Read permissions** (zero-permissions config): `video`/`creator`/`league*` are
  public; `app_user`, `vocabulary`, `achievement`, `cosmetic`, `notification`,
  `like`, `follow`, `progress` are row-scoped to `auth.sub === user_id`.
- JWT verification key shared with the auth service (`ZERO_AUTH_SECRET`/JWKS).

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

---

## 7. Media pipeline (never synced through Zero)

`video.hls_url`/`thumb` are pointers only. Build:

- **Upload** (Studio screen): signed direct-upload URL → object storage.
- **Transcode** to HLS (Mux or `ffmpeg` workers), generate poster/thumbnail.
- **Subtitle + quiz authoring**: ASR for captions, then the Studio editor's markers
  produce the `subtitle`/`quiz` JSON saved on the `video` row. (Studio currently mocks
  the timeline/AI-quiz; this is the real pipeline behind it.)
- CDN in front; the app just plays `hls_url` via expo-video.

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
