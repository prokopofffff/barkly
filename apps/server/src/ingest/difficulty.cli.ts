import { arg } from "@/ingest/util";
import { runDifficulty } from "@/ingest/difficulty";

// CLI for the difficulty-prior stage (bk-z5t.10). Operates on 'classified' rows,
// computing prior_difficulty from features + LLM signals and advancing to
// 'approved'. Pure compute — needs only DATABASE_URL; --dry skips the writes.
//
//   bun run ingest:difficulty
//   bun run ingest:difficulty -- --limit 100
//   bun run ingest:difficulty -- --dry


async function main(): Promise<void> {
  const limit = Number(arg("--limit") ?? 500);
  const persist = !process.argv.includes("--dry");

  console.log(`difficulty: up to ${limit}, ${persist ? "PERSIST" : "DRY RUN"}`);
  const results = await runDifficulty({ limit, persist });

  let ok = 0;
  let failed = 0;
  for (const r of results) {
    if (r.ok) {
      ok++;
      console.log(`  ${r.videoId}  prior=${r.prior}`);
    } else {
      failed++;
      console.log(`  ${r.videoId}  ERROR: ${r.error}`);
    }
  }

  console.log(`\ndone: ${results.length} processed — ${ok} ok, ${failed} failed`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
