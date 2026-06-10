import { arg } from "@/ingest/util";
import { classifyOne } from "@/ingest/classify";
import { computeDifficultyPrior } from "@/ingest/difficulty";
import { computeFeatures } from "@/ingest/features";
import { config } from "@/lib/config";

// Stability harness for the difficulty prior (bk-z5t.16). Runs classify on the
// SAME transcript N times with the deterministic features held fixed, so the
// only varying inputs are the LLM's 1-5 rubric ratings. Prints each run + the
// spread of the resulting prior — the empirical "how reproducible is it" check.
//
//   bun run ingest:difficulty-check -- --runs 5
//   bun run ingest:difficulty-check -- --runs 8 --duration 35 --transcript "..."

const SAMPLE =
  "So here's the thing about saving money. You don't have to give up everything you love. " +
  "Just cut back on the small stuff that adds up over time, and put that cash into an account " +
  "you can't easily touch. Before you know it, you've pulled together a real cushion.";


async function main(): Promise<void> {
  const runs = Number(arg("--runs") ?? 5);
  const transcript = arg("--transcript") ?? SAMPLE;
  const durationS = Number(arg("--duration") ?? 40);

  const f = computeFeatures(transcript, durationS);
  console.log(
    `stability: ${runs} runs, provider=${config.LLM_PROVIDER}, model=${config.ANTHROPIC_MODEL}`,
  );
  console.log(
    `fixed features: wpm=${f.wpm.toFixed(0)}, rare=${(f.rareWordRatio * 100).toFixed(1)}%, ` +
      `avgSentLen=${f.avgSentenceLen.toFixed(1)}`,
  );

  const priors: number[] = [];
  for (let i = 1; i <= runs; i++) {
    const { classification: c } = await classifyOne({
      title: "sample clip",
      description: "",
      tags: [],
      transcript,
    });
    const prior = computeDifficultyPrior({
      wpm: f.wpm,
      rareWordRatio: f.rareWordRatio,
      avgSentenceLen: f.avgSentenceLen,
      speechClarity: c.speech_clarity,
      idiomDensity: c.idiom_density,
      slangDensity: c.slang_density,
      syntaxComplexity: c.syntax_complexity,
      abstractness: c.abstractness,
    });
    priors.push(prior);
    console.log(
      `  run ${i}: idiom=${c.idiom_density} slang=${c.slang_density} ` +
        `syntax=${c.syntax_complexity} abstract=${c.abstractness} clarity=${c.speech_clarity} -> prior ${prior}`,
    );
  }

  const min = Math.min(...priors);
  const max = Math.max(...priors);
  const mean = priors.reduce((a, b) => a + b, 0) / priors.length;
  console.log(
    `\nprior over ${runs} runs: min ${min}, max ${max}, range ${max - min}, mean ${mean.toFixed(0)}`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
