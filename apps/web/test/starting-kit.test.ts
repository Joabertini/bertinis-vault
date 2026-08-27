import { describe, expect, test } from "vitest";

import { collections, forRulesVersion } from "@bertinis-vault/vetools-index";
import { slugOf } from "../src/lib/index-options";
import { coinLabel, kitItemIds, startingKitFor } from "../src/lib/starting-kit";

const kit = (classId: string, rulesVersion: "2014" | "2024", backgroundId = "") =>
  startingKitFor(classId, backgroundId, rulesVersion);

describe("the two editions ask different questions", () => {
  test("2024 asks one: the whole kit, or the gold", () => {
    // A 2024 barbarian takes a greataxe, four handaxes, a pack and 15 gp — or
    // 75 gp and nothing else. One row, two letters.
    const rows = kit("barbarian", "2024");
    const [row] = rows.filter((entry) => entry.source === "class");

    expect(row!.granted).toBe(false);
    expect(row!.options).toHaveLength(2);

    const [gear, gold] = row!.options;
    expect(gear!.items.map((item) => item.id)).toContain("greataxe");
    expect(gear!.copper).toBe(1500);
    expect(gold!.items).toEqual([]);
    expect(gold!.copper).toBe(7500);
  });

  test("2014 asks several small ones, and grants the rest outright", () => {
    const rows = kit("barbarian", "2014").filter((entry) => entry.source === "class");

    expect(rows.length).toBeGreaterThan(1);
    expect(rows.some((row) => row.granted)).toBe(true);
    expect(rows.some((row) => !row.granted)).toBe(true);
  });

  test("a category is an open pick, not an item", () => {
    // "any martial melee weapon" cannot become a bag line on its own; the
    // player still has to name one.
    const rows = kit("barbarian", "2014").filter((entry) => entry.source === "class");
    const open = rows.flatMap((row) => row.options).flatMap((option) => option.openPicks);

    expect(open.some((pick) => pick.category === "weaponMartialMelee")).toBe(true);
    // Said in words, not as a code — the player reads this on a button.
    expect(open[0]!.label).not.toBe(open[0]!.category);
  });

  test("the background contributes its own rows, after the class", () => {
    const rows = kit("barbarian", "2024", "acolyte");
    const sources = rows.map((row) => row.source);

    expect(sources).toContain("background");
    expect(sources.indexOf("class")).toBeLessThan(sources.indexOf("background"));
  });
});

describe("what an answer is worth", () => {
  test("a quantity becomes repeated lines, because that is what the bag stores", () => {
    const [row] = kit("barbarian", "2024").filter((entry) => entry.source === "class");
    const ids = kitItemIds(row!.options[0]!);

    expect(ids.filter((id) => id === "handaxe")).toHaveLength(4);
  });

  test("copper reads as a table says it", () => {
    expect(coinLabel(7500)).toBe("75 po");
    expect(coinLabel(1505)).toBe("15 po 5 pc");
    expect(coinLabel(50)).toBe("50 pc");
    expect(coinLabel(0)).toBe("");
  });
});

describe("a name the item list does not carry becomes a question", () => {
  test("2024 writes 'holy symbol' as an item; nobody owns one of those", () => {
    // 2014 states the same thing as a category. The cleric ends up with an
    // Amulet or an Emblem either way, and neither edition should put
    // `holy-symbol` in the bag.
    const rows = startingKitFor("cleric", "", "2024");
    const picks = rows.flatMap((row) => row.options).flatMap((option) => option.openPicks);
    const items = rows.flatMap((row) => row.options).flatMap((option) => option.items);

    expect(picks.some((pick) => /holy symbol/i.test(pick.label))).toBe(true);
    expect(items.map((item) => item.id)).not.toContain("holy-symbol");
  });

  test("2014 has none of them, because it states its categories properly", () => {
    const unresolved = startingKitFor("cleric", "", "2014")
      .flatMap((row) => row.options)
      .flatMap((option) => option.openPicks)
      .filter((pick) => pick.category === "unresolved");

    expect(unresolved).toEqual([]);
  });
});

describe("conformance: every id the kits produce is a real item", () => {
  for (const rulesVersion of ["2014", "2024"] as const) {
    test(`${rulesVersion}`, () => {
      const itemIds = new Set(
        (forRulesVersion(collections.item ?? [], rulesVersion) as { name: string }[]).map((row) =>
          slugOf(row.name),
        ),
      );
      const classes = forRulesVersion(collections.class ?? [], rulesVersion) as { name: string }[];

      const unresolved = classes.flatMap((row) =>
        startingKitFor(slugOf(row.name), "", rulesVersion)
          .flatMap((kitRow) => kitRow.options)
          .flatMap((option) => option.items)
          .filter((item) => !itemIds.has(item.id))
          .map((item) => `${row.name} -> ${item.id}`),
      );

      // A kit line that resolves to nothing would put a dead reference in the
      // bag, which is exactly the failure the Foundry export was built to
      // avoid. Those names become open picks instead, so none survives here.
      expect(unresolved).toEqual([]);
    });
  }
});
