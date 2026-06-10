// Shared helpers for the ingestion CLIs and stage runners.

/** Value following a CLI flag (e.g. `--limit 50`), or undefined. */
export function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** Whether a boolean CLI flag is present (e.g. `--dry`). */
export function has(flag: string): boolean {
  return process.argv.includes(flag);
}

/** Politeness/rate-limit delay used between items in the batch stages. */
export const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));
