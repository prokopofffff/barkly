# Barkly / ГАВ — agent & contributor guide (monorepo)

Bun-workspace monorepo with two apps. Follow the **per-app** standards:

- **Mobile** (`apps/mobile`, Expo SDK 56): [`apps/mobile/docs/DEV_STANDARDS.md`](apps/mobile/docs/DEV_STANDARDS.md)
- **Backend** (`apps/server`, Hono + Drizzle): [`apps/server/docs/DEV_STANDARDS.md`](apps/server/docs/DEV_STANDARDS.md)
  and the build-out plan [`apps/server/docs/BACKEND_PLAN.md`](apps/server/docs/BACKEND_PLAN.md)

## Layout
```
apps/mobile    the Expo app (src/app routes, NativeWind, Zero client)
apps/server    the TypeScript/Hono backend (Drizzle, Zero push/auth, jobs)
packages/      reserved for shared code (e.g. the Zero schema + mutators)
```

## Critical reminders
- **Package manager is Bun.** One `bun install` at the repo root installs every
  workspace. Never `npm`/`yarn`. Install Expo/native modules with
  `cd apps/mobile && bunx expo install <pkg>`.
- **Hoisted node_modules is required.** `bunfig.toml` sets `linker = "hoisted"`
  so Expo/Metro see a flat tree — do not remove it (isolated installs make
  `expo-doctor` report duplicate dependencies).
- **Expo SDK 56 — read the exact versioned docs** at
  https://docs.expo.dev/versions/v56.0.0/ before writing Expo code.
- **No Expo Go** — Zero + native video need a dev build (`bunx expo prebuild`).
- **Keep the Zero contract in lockstep.** `schema.ts` + `mutators.ts` must match
  between client and (eventually) server; the server re-runs the same mutators
  authoritatively. Coordinate schema changes with a Postgres migration.
- Before finishing, the relevant gates must pass:
  - whole repo: `bun run check` (typecheck + lint, all workspaces)
  - mobile also: `cd apps/mobile && bun run doctor` (expo-doctor 21/21)
  - server also: `cd apps/server && bun test`
