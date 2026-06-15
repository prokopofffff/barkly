import { runPipeline } from "@/ingest/pipeline";

// Best-effort, single-flight drain of the ingest queue (bk-jaz.9.2). Triggered
// fire-and-forget after a curator submission so the queued candidate flows
// through the pipeline to the feed without waiting for a cron. The guard means
// concurrent submissions never stack pipeline passes — a pass already running
// will pick up rows queued while it runs (or the next trigger starts one).
//
// This couples submission to processing for MVP convenience; production can set
// CURATOR_AUTOPROCESS=false and run a dedicated worker instead (bk-jaz.10).

let running = false;

export async function drainPipelineOnce(): Promise<void> {
  if (running) return;
  running = true;
  try {
    await runPipeline({
      batch: 5,
      delayMs: 1500, // stay polite to yt-dlp / the LLM
      rounds: 20,
      discover: false, // curator submissions ARE the discovery
      discoverLimit: 0,
    });
  } finally {
    running = false;
  }
}
