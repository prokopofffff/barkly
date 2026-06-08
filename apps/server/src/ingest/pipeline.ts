import { config } from "@/lib/config";
import { runClassify } from "@/ingest/classify";
import { runDifficulty } from "@/ingest/difficulty";
import { discoverAll } from "@/ingest/discover";
import { runFeatures } from "@/ingest/features";
import { runLesson } from "@/ingest/lesson";
import { runPrefilter } from "@/ingest/prefilter";
import { runPromote } from "@/ingest/promote";
import { runTranscribe } from "@/ingest/transcribe";

// Pipeline orchestrator (bk-z5t.11). The per-stage runners are already a
// resumable state machine over ingest_video.status — each stage queries the
// rows in its inbound status and advances them. This driver simply runs the
// stages in order, in bounded batches, round after round, until a full pass
// moves nothing (the pipeline has drained). Re-running resumes wherever the
// statuses left off, so a top-up or a crashed batch just continues.
//
// Concurrency is intentionally simple (sequential stages, sequential rows): the
// binding constraints are yt-dlp politeness and the LLM, not CPU. A pg-boss
// fan-out can layer on later for parallelism without changing the state machine.

export type PipelineOptions = {
  batch: number; // max rows per stage per round
  delayMs: number; // politeness delay for the yt-dlp/LLM stages
  rounds: number; // safety cap on total rounds
  discover: boolean; // run channel discovery first
  discoverLimit: number; // max Shorts per channel when discovering
};

type Stage = { name: string; run: () => Promise<number> };

const log = (m: string) => console.log(m);

export async function runPipeline(
  opts: PipelineOptions,
): Promise<Record<string, number>> {
  if (opts.discover) {
    const res = await discoverAll({
      limit: opts.discoverLimit,
      persist: true,
      delayMs: opts.delayMs,
    });
    const inserted = res.reduce((s, r) => s + r.inserted, 0);
    const failed = res.filter((r) => r.error).length;
    log(`discover: +${inserted} new candidates (${failed} channel(s) failed)`);
  }

  const hasKey = Boolean(config.ANTHROPIC_API_KEY);
  const stages: Stage[] = [
    {
      name: "prefilter",
      run: async () =>
        (await runPrefilter({ limit: opts.batch, delayMs: opts.delayMs, persist: true }))
          .length,
    },
    {
      name: "transcribe",
      run: async () =>
        (await runTranscribe({ limit: opts.batch, delayMs: opts.delayMs, persist: true }))
          .length,
    },
    {
      name: "features",
      run: async () => (await runFeatures({ limit: opts.batch, persist: true })).length,
    },
  ];
  if (hasKey) {
    stages.push({
      name: "classify",
      run: async () =>
        (await runClassify({ limit: opts.batch, delayMs: opts.delayMs, persist: true }))
          .length,
    });
    stages.push({
      name: "difficulty",
      run: async () => (await runDifficulty({ limit: opts.batch, persist: true })).length,
    });
    stages.push({
      name: "lesson",
      run: async () =>
        (await runLesson({ limit: opts.batch, delayMs: opts.delayMs, persist: true }))
          .length,
    });
  } else {
    log("ANTHROPIC_API_KEY not set — skipping classify + difficulty + lesson");
  }
  // Promote needs no key; it runs last so quizzed clips land in `video`.
  stages.push({
    name: "promote",
    run: async () => (await runPromote({ limit: opts.batch, persist: true })).length,
  });

  const totals: Record<string, number> = {};
  for (let round = 1; round <= opts.rounds; round++) {
    let moved = 0;
    for (const stage of stages) {
      const n = await stage.run();
      if (n > 0) {
        totals[stage.name] = (totals[stage.name] ?? 0) + n;
        log(`round ${round}: ${stage.name} +${n}`);
      }
      moved += n;
    }
    if (moved === 0) {
      log(`round ${round}: no work left — drained`);
      break;
    }
  }

  return totals;
}
