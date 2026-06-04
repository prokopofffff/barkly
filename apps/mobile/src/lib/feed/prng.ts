/**
 * Tiny deterministic PRNG. React's purity rules forbid `Math.random()` during
 * render, so anything computed in render/`useMemo` (confetti layout, quiz word
 * shuffling) uses a seeded generator instead — same seed → same result.
 */

/** Park–Miller LCG. Returns a function yielding floats in [0, 1). */
export function seeded(seed: number): () => number {
  let s = Math.floor(seed) % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Deterministic Fisher–Yates shuffle (does not mutate the input). */
export function seededShuffle<T>(arr: readonly T[], seed: number): T[] {
  const rng = seeded(seed);
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
