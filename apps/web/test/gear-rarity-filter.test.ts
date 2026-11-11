/**
 * The bag's list: browsable, mundane by default, narrowed by rarity.
 */

import { describe, expect, it } from "vitest";

import { optionsFor, rarityOfRow } from "@/lib/index-options";

const names = (rarities: string[], search = "") =>
  optionsFor({ prop: "item", rulesVersion: "2014", search, rarities, limit: null }).map((entry) => entry.label);

describe("the bag's rarity filter", () => {
  it("offers the gear a character buys when nothing is typed", () => {
    const mundane = names(["none"]);

    // The things the owner named when this section offered only what was searched.
    // By word: the index writes sizes and quantities around the name.
    for (const wanted of [/Caltrops/, /Bell/, /Rope/, /Tent/, /Pole/]) {
      expect(mundane.some((name) => wanted.test(name)), String(wanted)).toBe(true);
    }
  });

  it("keeps magic items out of the mundane list and out of the way", () => {
    const mundane = names(["none"]);

    expect(mundane).not.toContain("Bag of Holding");
    expect(names(["uncommon"])).toContain("Bag of Holding");
  });

  it("lists alphabetically when browsing", () => {
    const list = names(["none"]);

    expect(list).toEqual([...list].sort((a, b) => a.localeCompare(b)));
  });

  it("narrows a typed search too, and no filter means every rarity", () => {
    expect(names(["none"], "bag of holding")).toEqual([]);
    expect(names([], "bag of holding")).toContain("Bag of Holding");
  });

  it("spells 'no rarity' one way", () => {
    expect(rarityOfRow({ rarity: null })).toBe("none");
    expect(rarityOfRow({ rarity: "none" })).toBe("none");
    expect(rarityOfRow({ rarity: "rare" })).toBe("rare");
  });
});
