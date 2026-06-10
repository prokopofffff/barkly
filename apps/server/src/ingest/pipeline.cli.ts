import { arg } from "@/ingest/util";
import { runPipeline } from "@/ingest/pipeline";

// CLI for the whole ingestion pipeline (bk-z5t.11). Runs every stage in order,
// in bounded batches, until drained. Resumable: re-run to continue or top up.
// Needs DATABASE_URL (+ ANTHROPIC_API_KEY to include classify/difficulty).
//
//   bun run ingest:run                       # process existing candidates
//   bun run ingest:run -- --discover         # discover seed channels first
//   bun run ingest:run -- --discover --discover-limit 50
//   bun run ingest:run -- --batch 100 --delay 800 --rounds 1000


async function main(): Promise<void> {
  const opts = {
    batch: Number(arg("--batch") ?? 100),
    delayMs: Number(arg("--delay") ?? 800),
    rounds: Number(arg("--rounds") ?? 1000),
    discover: process.argv.includes("--discover"),
    discoverLimit: Number(arg("--discover-limit") ?? 50),
  };

  console.log(
    `pipeline: batch=${opts.batch}, delay=${opts.delayMs}ms, rounds<=${opts.rounds}` +
      `${opts.discover ? `, discover (limit ${opts.discoverLimit})` : ""}`,
  );

  const totals = await runPipeline(opts);

  console.log("\ntotals processed per stage:");
  const entries = Object.entries(totals);
  if (entries.length === 0) {
    console.log("  (nothing — pipeline already drained)");
  } else {
    for (const [stage, n] of entries) console.log(`  ${stage.padEnd(12)} ${n}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
