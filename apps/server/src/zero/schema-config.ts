// Entry point consumed by `zero-deploy-permissions` (bun run zero:deploy-perms):
// it must export the Zero `schema` and the compiled read `permissions`. Both
// live in the shared @barkly/zero contract.
export { schema, permissions } from "@barkly/zero";
