import { arg } from "@/ingest/util";
import { runFeatures } from "@/ingest/features";

// CLI for the deterministic features stage (bk-z5t.8). Operates on 'transcribed'
// rows, computing lexical/speed metrics and advancing to 'featured'. Pure
// compute — needs only DATABASE_URL; --dry skips the writes.
//
//   bun run ingest:features
//   bun run ingest:features -- --limit 50
//   bun run ingest:features -- --dry


async function main(): Promise<void> {
  const limit = Number(arg("--limit") ?? 500);
  const persist = !process.argv.includes("--dry");

  console.log(`features: up to ${limit}, ${persist ? "PERSIST" : "DRY RUN"}`);
  const results = await runFeatures({ limit, persist });

  let ok = 0;
  let failed = 0;
  for (const r of results) {
    if (r.ok) {
      ok++;
      console.log(
        `  ${r.videoId}  wpm ${r.wpm?.toFixed(0)}, rare ${(r.rareWordRatio! * 100).toFixed(1)}%`,
      );
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
