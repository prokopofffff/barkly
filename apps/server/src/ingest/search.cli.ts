import { arg, has } from "@/ingest/util";
import { searchSeed, type SearchQuery } from "@/ingest/search.seed";
import { discoverBySearch, type SearchDiscoverResult } from "@/ingest/discover-search";

// CLI for keyless ytsearch discovery (bk-44m).
//
//   bun run ingest:search                      # all curated queries -> DB
//   bun run ingest:search -- --dry             # no DB writes, just search+count
//   bun run ingest:search -- --limit 30        # max hits per query (default 20)
//   bun run ingest:search -- --query "cooking english shorts"  # one ad-hoc query
//   bun run ingest:search -- --delay 1500      # ms between queries (default 1200)

async function main(): Promise<void> {
  const limit = Number(arg("--limit") ?? 20);
  const delayMs = Number(arg("--delay") ?? 1200);
  const persist = !has("--dry");
  const adhoc = arg("--query");

  const queries: readonly SearchQuery[] = adhoc
    ? [{ query: adhoc, topic: "daily_life" }]
    : searchSeed;

  console.log(
    `search discovery: ${queries.length} quer${queries.length === 1 ? "y" : "ies"}, ` +
      `limit=${limit}/query, delay=${delayMs}ms, ${persist ? "PERSIST" : "DRY RUN"}`,
  );

  const results = await discoverBySearch({ queries, limitPerQuery: limit, persist, delayMs });

  let totalFound = 0;
  let totalInserted = 0;
  const failures: SearchDiscoverResult[] = [];
  for (const r of results) {
    totalFound += r.found;
    totalInserted += r.inserted;
    if (r.error) failures.push(r);
    const status = r.error
      ? `ERROR: ${r.error}`
      : `found ${r.found}, kept ${r.kept}, +${r.inserted} new`;
    console.log(`  ${r.query.padEnd(48)} ${status}`);
  }

  console.log(
    `\ndone: ${totalFound} found, ${totalInserted} new candidates, ` +
      `${failures.length} quer${failures.length === 1 ? "y" : "ies"} failed`,
  );

  // postgres-js keeps the pool open; a CLI must exit explicitly.
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
