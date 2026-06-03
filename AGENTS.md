# Barkly — agent & contributor guide

**Follow [`docs/DEV_STANDARDS.md`](docs/DEV_STANDARDS.md)** for all conventions
(tooling, structure, styling, Zero, auth, quality gates).

## Critical reminders

- **Package manager is Bun** — `bun install`, `bunx <tool>`. Never `npm`/`yarn`.
  Install Expo/native modules with `bunx expo install`.
- **Expo SDK 56 — read the exact versioned docs** at
  https://docs.expo.dev/versions/v56.0.0/ before writing any Expo code; APIs change
  between SDKs.
- **No Expo Go** — Zero + native video need a dev build (`bunx expo prebuild`).
- Before finishing: `bunx tsc --noEmit`, `bunx expo lint`, `bunx expo-doctor` must pass.
