import { runPrefilter } from "@/ingest/prefilter";

// CLI for the cheap pre-filter (bk-z5t.5). Operates on rows in 'discovered',
// fetching full metadata per video (yt-dlp -J) and advancing each to
// 'prefiltered' or 'prefiltered_out'. Reads the DB in both modes (needs
// DATABASE_URL); --dry just skips the writes.
//
//   bun run ingest:prefilter                  # process up to 200 candidates
//   bun run ingest:prefilter -- --limit 50    # cap this batch
//   bun run ingest:prefilter -- --dry         # evaluate + print, no writes
//   bun run ingest:prefilter -- --delay 1000  # ms between videos (default 800)

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const limit = Number(arg("--limit") ?? 200);
  const delayMs = Number(arg("--delay") ?? 800);
  const persist = !process.argv.includes("--dry");

  console.log(
    `prefilter: up to ${limit} candidate(s), delay=${delayMs}ms, ` +
      `${persist ? "PERSIST" : "DRY RUN"}`,
  );

  const results = await runPrefilter({ limit, delayMs, persist });

  let kept = 0;
  let dropped = 0;
  let failed = 0;
  const reasons = new Map<string, number>();
  for (const r of results) {
    if (r.error) {
      failed++;
      reasons.set("error", (reasons.get("error") ?? 0) + 1);
    } else if (r.ok) {
      kept++;
    } else {
      dropped++;
      const key = r.reason ?? "unknown";
      reasons.set(key, (reasons.get(key) ?? 0) + 1);
    }
  }

  console.log(
    `\ndone: ${results.length} processed — ${kept} kept, ${dropped} dropped, ` +
      `${failed} failed`,
  );
  if (reasons.size > 0) {
    console.log("breakdown:");
    for (const [reason, n] of [...reasons].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${reason.padEnd(22)} ${n}`);
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
