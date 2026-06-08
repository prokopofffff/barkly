import { runTranscribe } from "@/ingest/transcribe";

// CLI for the transcript stage (bk-z5t.7). Operates on 'prefiltered' rows:
// fetches the English .vtt (no video), normalizes it, stores the transcript,
// and advances to 'transcribed'. Needs yt-dlp + DATABASE_URL; --dry skips DB.
//
//   bun run ingest:transcribe                 # up to 200
//   bun run ingest:transcribe -- --limit 20
//   bun run ingest:transcribe -- --dry         # fetch+parse, print, no DB
//   bun run ingest:transcribe -- --delay 1000

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const limit = Number(arg("--limit") ?? 200);
  const delayMs = Number(arg("--delay") ?? 800);
  const persist = !process.argv.includes("--dry");

  console.log(
    `transcribe: up to ${limit}, delay=${delayMs}ms, ${persist ? "PERSIST" : "DRY RUN"}`,
  );

  const results = await runTranscribe({ limit, delayMs, persist });

  let ok = 0;
  let failed = 0;
  for (const r of results) {
    if (r.ok) {
      ok++;
      console.log(`  ${r.videoId}  ${r.words} words, quality ${r.quality?.toFixed(2)}`);
    } else {
      failed++;
      console.log(`  ${r.videoId}  ERROR: ${r.error}`);
    }
  }

  console.log(`\ndone: ${results.length} processed — ${ok} ok, ${failed} failed`);
  process.exit(failed > 0 && ok === 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
