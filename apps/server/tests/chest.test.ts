import { describe, expect, test } from "bun:test";
import { rollDailyLoot, RARITY_GEMS, type ChestCosmetic } from "@barkly/zero";

const cosmetic = (
  id: string,
  rarity: string,
  owned: boolean,
): ChestCosmetic => ({
  id,
  name: `cosmetic-${id}`,
  rarity,
  color: "#abcdef",
  owned,
});

const CATALOG: ChestCosmetic[] = [
  cosmetic("a", "Обычное", false),
  cosmetic("b", "Редкое", false),
  cosmetic("c", "Легендарное", false),
];

describe("rollDailyLoot", () => {
  test("returns null on empty catalog", () => {
    expect(rollDailyLoot([], 123)).toBeNull();
  });

  test("same seed + catalog -> deep-equal loot (deterministic)", () => {
    const a = rollDailyLoot(CATALOG, 42);
    const b = rollDailyLoot(CATALOG, 42);
    expect(a).not.toBeNull();
    expect(a).toEqual(b);
  });

  test("prefers an unowned item when both owned and unowned exist", () => {
    const mixed: ChestCosmetic[] = [
      cosmetic("owned1", "Обычное", true),
      cosmetic("owned2", "Редкое", true),
      cosmetic("free", "Обычное", false),
    ];
    // Only one unowned item, so any seed must pick it.
    for (const seed of [1, 7, 99, 2024, 500000]) {
      const loot = rollDailyLoot(mixed, seed);
      expect(loot?.cosmeticId).toBe("free");
    }
  });

  test("gems derive from the chosen rarity", () => {
    // Single-item catalogs pin the rarity so we can assert the gem payout.
    const common = rollDailyLoot([cosmetic("x", "Обычное", false)], 5);
    expect(common?.gems).toBe(RARITY_GEMS["Обычное"]);

    const legendary = rollDailyLoot([cosmetic("y", "Легендарное", false)], 5);
    expect(legendary?.gems).toBe(RARITY_GEMS["Легендарное"]);

    // Unknown rarity falls back to 120 gems.
    const unknown = rollDailyLoot([cosmetic("z", "Мифическое", false)], 5);
    expect(unknown?.gems).toBe(120);
  });

  test("falls back to the full catalog when everything is owned", () => {
    const allOwned: ChestCosmetic[] = [
      cosmetic("a", "Обычное", true),
      cosmetic("b", "Редкое", true),
    ];
    const loot = rollDailyLoot(allOwned, 3);
    expect(loot).not.toBeNull();
    expect(["a", "b"]).toContain(loot!.cosmeticId);
  });
});
