import { runDownload } from "@/ingest/download";

// CLI for download + transcode + upload (bk-z5t.6). Operates on 'prefiltered'
// rows. Needs yt-dlp + ffmpeg on PATH; --dry skips the upload + DB write (still
// downloads and transcodes locally so you can eyeball the rendition sizes).
//
//   bun run ingest:download                 # up to 50 -> Object Storage + DB
//   bun run ingest:download -- --dry         # local download+transcode only
//   bun run ingest:download -- --limit 5
//   bun run ingest:download -- --keep-raw    # also upload the original mp4
//   bun run ingest:download -- --delay 2000

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const mib = (b: number) => `${(b / 1024 / 1024).toFixed(1)}MiB`;

async function main(): Promise<void> {
  const limit = Number(arg("--limit") ?? 50);
  const delayMs = Number(arg("--delay") ?? 1500);
  const persist = !process.argv.includes("--dry");
  const keepRaw = process.argv.includes("--keep-raw");

  console.log(
    `download: up to ${limit} candidate(s), delay=${delayMs}ms, ` +
      `${persist ? "UPLOAD+DB" : "DRY (local only)"}${keepRaw ? ", keep-raw" : ""}`,
  );

  const results = await runDownload({ limit, delayMs, persist, keepRaw });

  let ok = 0;
  let failed = 0;
  for (const r of results) {
    if (r.ok) {
      ok++;
      console.log(
        `  ${r.videoId}  mp4=${mib(r.mp4Bytes ?? 0)} poster=${mib(r.posterBytes ?? 0)}` +
          `${r.hasSub ? " +sub" : " (no sub)"}`,
      );
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
