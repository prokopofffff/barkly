# Barkly — Development Standards

Conventions for the Barkly mobile app (TikTok-style language-learning feed).
These are derived from the stack decisions in the project README. When in doubt,
match the surrounding code.

---

## 1. Tooling & environment

- **Package manager is Bun.** Use `bun install`, `bun add`, `bunx <tool>`.
  Never run `npm`/`yarn`/`pnpm`. Commit `bun.lock`; never commit a
  `package-lock.json`/`yarn.lock`.
- **Install native/Expo modules with `bunx expo install <pkg>`**, not `bun add` —
  it pins versions compatible with the current Expo SDK. Use plain `bun add` only
  for JS-only libraries.
- **No Expo Go.** Zero (`expo-sqlite`) and native video require a **dev build**:
  `bunx expo prebuild` → `bunx expo run:ios` / `run:android`.
- **Expo SDK 56.** Before using an Expo API, check the versioned docs at
  https://docs.expo.dev/versions/v56.0.0/ — APIs change between SDKs.
- `node_modules/.bin` tools run via `bunx` (e.g. `bunx tsc`, `bunx expo lint`).

## 2. Language & types

- **TypeScript, `strict` on.** No `any` without a `// reason:` comment. Prefer
  `unknown` + narrowing.
- **No `as` casts to silence the compiler.** Fix the type. Casts are allowed only
  for genuinely untyped boundaries, with a comment.
- Public functions/components get explicit return/prop types; locals stay inferred.
- A change is not done until `bunx tsc --noEmit` is clean.

## 3. Project structure

```
src/
  app/         Expo Router routes ONLY (file = route). Keep these thin.
  components/   reusable presentational components
  lib/<domain>/ feature logic, grouped by domain (auth, zero, feed, ...)
```

- **Routing is file-based** under `src/app`. Don't hand-roll navigation; add a file.
- Screens stay thin: data + layout. Push logic into `src/lib/<domain>`.
- Import with the `@/` alias (`@/lib/...`, `@/components/...`), never deep `../../`.

## 4. Naming

- **Files: `kebab-case`** — `feed-video.tsx`, `auth-context.tsx`, `use-theme.ts`.
- Components `PascalCase`, hooks `useCamelCase`, vars/functions `camelCase`,
  module constants `UPPER_SNAKE_CASE`.
- Platform splits use suffixes: `name.web.tsx`, `name.ios.tsx`.

## 5. Styling — NativeWind

- **Style with `className` (Tailwind), not `StyleSheet.create`.**
- `StyleSheet` is allowed only for things NativeWind can't express well:
  `StyleSheet.absoluteFill`, and values computed at runtime (e.g. measured height).
- Brand tokens live in `tailwind.config.js` (`brand`, `ink`). Add new design tokens
  there — don't hardcode hex values in components.

## 6. Data & sync — Zero

- **Reads:** reactive `useQuery` against the local replica. Define reusable query
  builders in `src/lib/zero/queries.ts`; don't inline ad-hoc queries in screens.
- **Writes go through Zero custom mutators → the TypeScript/Hono backend.** Never write to a
  remote DB directly from the client; the client only calls mutators.
- **`src/lib/zero/schema.ts` mirrors the Postgres schema** that zero-cache
  replicates. Schema changes are coordinated with a Postgres migration — never
  edit one side alone.
- Keep `enableLegacyQueries: true` (the `z.query` builder) until/unless we migrate
  the whole app to synced queries — don't mix the two styles piecemeal.
- **Video is never synced.** `video.hlsUrl` is just a pointer to the CDN; media is
  played by `expo-video`, never stored or streamed through Zero.

## 7. Video feed

- The feed is a `FlashList`, `pagingEnabled`, one full-screen item per clip.
- **Only the active (on-screen) clip plays;** all others are paused and rewound.
  Drive this off viewability (`itemVisiblePercentThreshold`), not scroll math.
- Don't autoplay audio off-screen; don't hold more than the visible/adjacent
  players resident.

## 8. Auth — anonymous-first

- **Never put up a login wall before value.** Every user starts as an anonymous
  session created on first launch (Duolingo-style deferred registration).
- **Linking an identity keeps the same `userID`** so synced progress carries over.
  `signOut` returns to a fresh anonymous session, never a dead end.
- All identity/auth logic lives behind `useAuth()`; components never touch
  SecureStore or tokens directly.
- If we offer Google/Facebook login, **Sign in with Apple is mandatory** (App Store).

## 9. Configuration & secrets

- Client config via `EXPO_PUBLIC_*` env vars (see `.env.example`). These are
  **inlined into the bundle and public — never put a secret in one.**
- Secrets live only on the TypeScript/Hono backend. The client holds only the user's JWT,
  stored via `expo-secure-store`.

## 10. Quality gates

Three gates, available as Bun scripts:

```bash
bun run typecheck     # tsc --noEmit
bun run lint          # expo lint
bun run doctor        # expo-doctor (expect 21/21)
bun run check         # typecheck + lint (the fast pre-PR combo)
```

How they're enforced:

- **Pre-commit hook** (`.githooks/pre-commit`) runs `typecheck` + `lint` on every
  commit. It's wired automatically by the `prepare` script on `bun install`
  (`core.hooksPath = .githooks`). Bypass a single commit with `git commit --no-verify`
  (use sparingly).
- **CI** (`.github/workflows/ci.yml`) runs `typecheck` + `lint` + `doctor` on every
  PR and on `main`. PRs must be green.
- The **PR template** carries the full checklist.

General:

- Keep changes scoped; match the existing file's comment density and idioms.
- Update the README/this doc when you change the stack, a convention, or the
  architecture.
