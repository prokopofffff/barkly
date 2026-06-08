import { runClassify } from "@/ingest/classify";

// CLI for LLM classification (bk-z5t.9). Operates on 'featured' rows: one Haiku
// call per clip, then advances to 'classified' (safe) or 'rejected'. Needs
// DATABASE_URL + ANTHROPIC_API_KEY; --dry classifies but skips the DB writes.
//
//   bun run ingest:classify
//   bun run ingest:classify -- --limit 20
//   bun run ingest:classify -- --dry
//   bun run ingest:classify -- --delay 500

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const limit = Number(arg("--limit") ?? 200);
  const delayMs = Number(arg("--delay") ?? 200);
  const persist = !process.argv.includes("--dry");

  console.log(
    `classify: up to ${limit}, delay=${delayMs}ms, ${persist ? "PERSIST" : "DRY RUN"}`,
  );

  const results = await runClassify({ limit, delayMs, persist });

  let kept = 0;
  let rejected = 0;
  let failed = 0;
  for (const r of results) {
    if (r.error) {
      failed++;
      console.log(`  ${r.videoId}  ERROR: ${r.error}`);
    } else if (r.rejected) {
      rejected++;
      console.log(`  ${r.videoId}  REJECTED (${r.rejected})  [${r.topic}]`);
    } else {
      kept++;
      console.log(
        `  ${r.videoId}  ok  topic=${r.topic} level=${r.level} score=${r.score}`,
      );
    }
  }

  console.log(
    `\ndone: ${results.length} processed — ${kept} classified, ${rejected} rejected, ${failed} failed`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
