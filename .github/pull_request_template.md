## What & why

<!-- What does this change do, and why? Link any issue. -->

## How to test

<!-- Steps to verify on a dev build (remember: not Expo Go). -->

## Checklist

See [`docs/DEV_STANDARDS.md`](../docs/DEV_STANDARDS.md).

- [ ] `bun run typecheck` passes
- [ ] `bun run lint` passes
- [ ] `bun run doctor` passes (21/21)
- [ ] Used **Bun** (no `npm`/`yarn`; `bun.lock` updated if deps changed)
- [ ] Styling via **NativeWind** `className` (no stray `StyleSheet`)
- [ ] Data writes go through **Zero mutators** (no direct remote DB writes)
- [ ] Zero `schema.ts` change is matched by a Postgres migration (if applicable)
- [ ] No secrets in `EXPO_PUBLIC_*` env vars
- [ ] README / `docs/DEV_STANDARDS.md` updated if conventions or stack changed
