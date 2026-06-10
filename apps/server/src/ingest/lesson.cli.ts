import { arg } from "@/ingest/util";
import { runLesson } from "@/ingest/lesson";

// CLI for lesson generation (bk-z5t.15). Operates on 'approved' rows: one Haiku
// call per clip -> subtitle tokens + quiz, then advances to 'quizzed'. Needs
// DATABASE_URL + ANTHROPIC_API_KEY; --dry skips the DB writes.
//
//   bun run ingest:lesson
//   bun run ingest:lesson -- --limit 20
//   bun run ingest:lesson -- --dry


async function main(): Promise<void> {
  const limit = Number(arg("--limit") ?? 200);
  const delayMs = Number(arg("--delay") ?? 200);
  const persist = !process.argv.includes("--dry");

  console.log(
    `lesson: up to ${limit}, delay=${delayMs}ms, ${persist ? "PERSIST" : "DRY RUN"}`,
  );

  const results = await runLesson({ limit, delayMs, persist });

  let ok = 0;
  let failed = 0;
  for (const r of results) {
    if (r.ok) {
      ok++;
      console.log(`  ${r.videoId}  ok (${r.words} subtitle tokens)`);
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
