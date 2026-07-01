// Shared daily-chest loot logic used by both the mobile app (showing the daily
// reward) and the server (granting it authoritatively). Pure + deterministic —
// no DB, no schema imports — so the same seed + catalog always yields identical
// loot on client and server. A tiny inline Park-Miller LCG keeps the roll
// reproducible without pulling in the mobile app's prng.

export type ChestCosmetic = {
  id: string;
  name: string;
  rarity: string;
  color: string;
  owned: boolean;
};

export type DailyLoot = {
  cosmeticId: string;
  name: string;
  rarity: string;
  color: string;
  gems: number;
};

// Relative draw weights per rarity — rarer cosmetics roll less often. Unknown
// rarities fall back to the "Редкое" weight (3) in the picker below.
export const RARITY_WEIGHT: Record<string, number> = {
  Обычное: 6,
  Редкое: 3,
  Легендарное: 1,
};

// Gem payout per rarity. Unknown rarities fall back to 120 (see rollDailyLoot).
export const RARITY_GEMS: Record<string, number> = {
  Обычное: 60,
  Редкое: 120,
  Легендарное: 300,
};

/**
 * Roll one day's chest loot from the cosmetic catalog, deterministically from
 * `seed`. Not-yet-owned cosmetics are preferred (we filter `owned === false`);
 * if the player already owns everything we roll across the full catalog. An
 * empty catalog returns null. The pick is rarity-weighted (unknown rarity ->
 * weight 3) using an inline Park-Miller LCG so the same seed + catalog always
 * produces the same loot. Gems derive from the chosen rarity (unknown -> 120).
 */
export function rollDailyLoot(
  cosmetics: readonly ChestCosmetic[],
  seed: number,
): DailyLoot | null {
  if (cosmetics.length === 0) return null;

  const unowned = cosmetics.filter((c) => c.owned === false);
  const pool = unowned.length > 0 ? unowned : cosmetics;

  // Park-Miller minimal-standard LCG — deterministic float in [0, 1).
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  const next = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };

  const weights = pool.map((c) => RARITY_WEIGHT[c.rarity] ?? 3);
  const total = weights.reduce((a, w) => a + w, 0);
  let target = next() * total;
  let picked = pool[pool.length - 1] as ChestCosmetic;
  for (let i = 0; i < pool.length; i++) {
    target -= weights[i] as number;
    if (target < 0) {
      picked = pool[i] as ChestCosmetic;
      break;
    }
  }

  return {
    cosmeticId: picked.id,
    name: picked.name,
    rarity: picked.rarity,
    color: picked.color,
    gems: RARITY_GEMS[picked.rarity] ?? 120,
  };
}
