import { arg } from "@/ingest/util";
import { runPromote } from "@/ingest/promote";

// CLI for promote (bk-z5t.12). Copies 'quizzed' clips into the synced `video`
// table (embed via youtubeId) and advances to 'promoted'. Needs DATABASE_URL;
// --dry skips the writes.
//
//   bun run ingest:promote
//   bun run ingest:promote -- --limit 100
//   bun run ingest:promote -- --dry


async function main(): Promise<void> {
  const limit = Number(arg("--limit") ?? 500);
  const persist = !process.argv.includes("--dry");

  console.log(`promote: up to ${limit}, ${persist ? "PERSIST" : "DRY RUN"}`);
  const results = await runPromote({ limit, persist });

  let ok = 0;
  let failed = 0;
  for (const r of results) {
    if (r.ok) {
      ok++;
      console.log(`  ${r.videoId}  -> video`);
    } else {
      failed++;
      console.log(`  ${r.videoId}  ERROR: ${r.error}`);
    }
  }

  console.log(`\ndone: ${results.length} processed — ${ok} promoted, ${failed} failed`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
