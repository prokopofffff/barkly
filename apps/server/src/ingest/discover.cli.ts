import { channelSeed, type ChannelSeed } from "@/ingest/channels.seed";
import { discoverAll, type DiscoverResult } from "@/ingest/discover";

// CLI for discovery (bk-z5t.4).
//
//   bun run ingest:discover                 # all seed channels -> DB
//   bun run ingest:discover -- --dry        # no DB writes, just resolve+count
//   bun run ingest:discover -- --limit 100  # max Shorts per channel (default 50)
//   bun run ingest:discover -- --handle @TED  # a single channel
//   bun run ingest:discover -- --delay 2000 # ms between channels (default 1500)

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function has(flag: string): boolean {
  return process.argv.includes(flag);
}

async function main(): Promise<void> {
  const limit = Number(arg("--limit") ?? 50);
  const delayMs = Number(arg("--delay") ?? 1500);
  const persist = !has("--dry");
  const handle = arg("--handle");

  const seeds: readonly ChannelSeed[] = handle
    ? [{ handle, topic: "daily_life", trust: 1 }]
    : channelSeed;

  console.log(
    `discovery: ${seeds.length} channel(s), limit=${limit}/channel, ` +
      `delay=${delayMs}ms, ${persist ? "PERSIST" : "DRY RUN"}`,
  );

  const results = await discoverAll({ limit, persist, delayMs, seeds });

  let totalFound = 0;
  let totalInserted = 0;
  const failures: DiscoverResult[] = [];
  for (const r of results) {
    totalFound += r.found;
    totalInserted += r.inserted;
    if (r.error) failures.push(r);
    const status = r.error ? `ERROR: ${r.error}` : `found ${r.found}, +${r.inserted} new`;
    console.log(`  ${r.handle.padEnd(28)} ${status}`);
  }

  console.log(
    `\ndone: ${totalFound} found, ${totalInserted} new candidates, ` +
      `${failures.length} channel(s) failed`,
  );
  if (failures.length > 0) {
    console.log("failed channels (verify the handle):");
    for (const f of failures) console.log(`  - ${f.handle}: ${f.error}`);
  }

  // postgres-js keeps the pool open; a CLI must exit explicitly.
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
