# Barkly — mobile

A TikTok-style language-learning app: learn by scrolling a vertical video feed.

## Frontend stack

| Concern | Choice |
| --- | --- |
| Framework | **Expo** (SDK 56) + dev client / prebuild |
| Language | **TypeScript** |
| Package manager | **Bun** |
| Navigation | **Expo Router** (file-based, `src/app`) |
| Styling | **NativeWind** (Tailwind for RN) |
| Video feed | **@shopify/flash-list** + **expo-video** |
| Local-first data + sync | **Zero** (`@rocicorp/zero`) over SQLite |
| Auth | anonymous-first ("deferred registration"), link Apple/Google/email later |
| Secure storage | **expo-secure-store** |

> ⚠️ Zero uses `expo-sqlite`/`op-sqlite`, which don't run in **Expo Go**. Use a
> **development build**: `bunx expo prebuild` then `bunx expo run:ios|run:android`.

## Getting started

```bash
bun install
cp .env.example .env        # fill in your endpoints (optional for first run)

# Development build (required for Zero + native video):
bunx expo prebuild
bunx expo run:ios           # or: bunx expo run:android
```

The app boots into the vertical feed using placeholder data (`src/lib/feed/sample-videos.ts`)
and a fresh **anonymous** user — no backend required to see it run.

> `bun install` blocks the lifecycle scripts of `@rocicorp/zero-sqlite3` and
> `protobufjs`. Those are **server-side only** (used by `zero-cache` on Node, not
> bundled into the app), so the mobile build is unaffected. If you self-host
> `zero-cache` from this repo, run `bun pm trust @rocicorp/zero-sqlite3 protobufjs`.

## How it fits together

```
[Postgres 15+]  source of truth
   │ logical replication
[zero-cache]    Rocicorp sync service (self-hosted)  ──sync──▶  app (SQLite replica)
   │ push (mutations)
[TS/Hono API]   auth, custom mutators, anon→real account merge (apps/server)
[CDN / Mux]     HLS video delivery (separate from sync; app just plays the URL)
```

- **Reads** sync automatically via Zero into a local SQLite replica → instant + offline.
- **Writes** (progress, likes) go through Zero *custom mutators* → the Hono push endpoint.
- **Video** is never synced; `video.hlsUrl` points at your CDN, played by `expo-video`.

## Project layout

```
src/
  app/
    _layout.tsx          providers (Gesture → SafeArea → Auth → Zero) + Stack
    index.tsx            the vertical video feed
  components/
    feed-video.tsx       single full-screen clip (plays only when active)
  lib/
    auth/auth-context.tsx   anonymous-first session + account linking
    zero/schema.ts          Zero schema (user, video, progress, like)
    zero/provider.tsx       ZeroProvider wired to the current user
    zero/queries.ts         example reactive queries
    feed/sample-videos.ts   placeholder feed data (swap for a Zero query)
```

## Next steps

- [ ] Stand up Postgres + zero-cache, set `EXPO_PUBLIC_ZERO_SERVER`.
- [ ] Build out `apps/server` (TypeScript/Hono): `/auth/anonymous`, account-linking, Zero push endpoint.
- [ ] Swap `SAMPLE_VIDEOS` for `useFeedQuery(...)` (see `src/lib/zero/queries.ts`).
- [ ] Pick video infra (Mux / Cloudflare Stream / self-hosted) and populate `video.hlsUrl`.
- [ ] Add Sign in with Apple (required by App Store when offering Google login).
