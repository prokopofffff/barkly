# Barkly / ГАВ — monorepo

A TikTok × Duolingo language-learning app (Russian speakers learning English):
an addictive vertical video feed with inline quizzes and Duolingo-style
gamification. Bun workspaces hold the mobile app and its backend together so the
shared **Zero** sync contract stays in lockstep.

```
apps/
  mobile/   Expo (SDK 56) + Expo Router + NativeWind + Zero  — the app
  server/   Hono + Drizzle + Postgres + Zero push/auth       — the backend
packages/   (reserved) shared code, e.g. the Zero schema + mutators
```

## Prerequisites
- **Bun** (package manager for the whole repo — never `npm`/`yarn`).
- For the mobile app: a dev build toolchain (Xcode / Android Studio). No Expo Go.
- For the backend: Docker (Postgres + zero-cache via `apps/server/docker-compose.yml`).

## Getting started
```bash
bun install                 # one install for all workspaces (hoisted node_modules)

# Mobile (from apps/mobile, or via root scripts):
bun run mobile              # = bun --filter barkly-mobile run start
#   first run needs a dev build: cd apps/mobile && bunx expo prebuild && bunx expo run:ios

# Backend:
bun run server             # = bun --filter barkly-back run dev
#   full local stack: cd apps/server && docker compose up
```

## Quality gates
```bash
bun run check              # typecheck + lint across every workspace (pre-commit runs this)
bun run typecheck          # tsc --noEmit in every workspace
bun run lint               # eslint in every workspace
# per-app extras:
cd apps/mobile && bun run doctor   # expo-doctor (expect 21/21)
cd apps/server && bun test
```

## Conventions
- **Mobile:** [`apps/mobile/docs/DEV_STANDARDS.md`](apps/mobile/docs/DEV_STANDARDS.md)
- **Backend:** [`apps/server/docs/DEV_STANDARDS.md`](apps/server/docs/DEV_STANDARDS.md)
- **Backend build-out plan:** [`apps/server/docs/BACKEND_PLAN.md`](apps/server/docs/BACKEND_PLAN.md)

## Notes
- `bunfig.toml` pins Bun to the **hoisted** linker — Expo/Metro need a flat
  `node_modules`. Don't remove it or `expo-doctor` will report duplicate deps.
- The **Zero contract** lives in `packages/zero` (`@barkly/zero`), shared by
  both apps. `apps/server/src/db/schema.ts` (Drizzle) is the **Postgres source
  of truth**; the Zero schema (`packages/zero/src/schema.gen.ts`) is generated
  from it via **drizzle-zero** — run `bun --filter barkly-back run zero:generate`
  after changing the Drizzle schema. The custom mutators are hand-written in
  `@barkly/zero` and run on both client and server. See
  `apps/server/docs/BACKEND_PLAN.md`.
