import { describe, expect, test } from "vitest";

import { optionById, optionsFor, slugOf, spellInfoFor } from "../src/lib/index-options";

describe("what a player can choose", () => {
  test("races come from the index, not the two dozen hand-written ones", () => {
    const all = optionsFor({ prop: "race", rulesVersion: "2014", search: "", limit: 500 });

    expect(all.length).toBeGreaterThan(100);
  });

  test("feats come from the index, not the seven hand-written ones", () => {
    const all = optionsFor({ prop: "feat", rulesVersion: "2014", search: "", limit: 500 });

    expect(all.length).toBeGreaterThan(100);
  });

  test("the weapons a bard could not reach are all there", () => {
    const weapons = optionsFor({
      prop: "item",
      rulesVersion: "2014",
      search: "",
      limit: 500,
      weaponsOnly: true,
    });
    const names = weapons.map((option) => option.label);

    for (const missing of ["Rapier", "Shortsword", "Light Crossbow", "Longbow", "Greatsword"]) {
      expect(names).toContain(missing);
    }
  });

  test("a search ranks names that start with the query first", () => {
    const [first] = optionsFor({ prop: "item", rulesVersion: "2014", search: "longsword" });

    expect(first?.label).toBe("Longsword");
  });

  test("2024 content is not offered to a 2014 character", () => {
    const legal = optionsFor({ prop: "race", rulesVersion: "2014", search: "", limit: 500 });

    expect(legal.every((option) => option.source !== "XPHB")).toBe(true);
  });
});

describe("names that appear in more than one book", () => {
  test("are flagged so the picker can show which book each row is", () => {
    const rows = optionsFor({ prop: "race", rulesVersion: "2014", search: "aarakocra" });

    expect(rows.length).toBeGreaterThan(1);
    expect(rows.every((option) => option.shared)).toBe(true);
    expect(rows.map((option) => option.source)).toContain("MPMM");
  });

  test("resolve to the book that was picked", () => {
    const option = optionById("race", "2014", slugOf("Aarakocra"), "MPMM");

    expect(option?.source).toBe("MPMM");
  });
});

describe("spell detail", () => {
  test("comes from the bundled index rather than a server", () => {
    const info = spellInfoFor("Fire Bolt", "2014");

    expect(info?.school).toBe("Evocacion");
    expect(info?.level).toBe(0);
    expect(info?.componentsLabel).toBe("verbal, somatico");
  });

  test("knows concentration and ritual", () => {
    expect(spellInfoFor("Bless", "2014")?.concentration).toBe(true);
    expect(spellInfoFor("Detect Magic", "2014")?.ritual).toBe(true);
  });

  test("is null for a spell that is not legal for the ruleset", () => {
    expect(spellInfoFor("Not A Real Spell", "2014")).toBeNull();
  });
});

describe("switching ruleset", () => {
  test("changes which books a race can come from", () => {
    const legacy = optionsFor({ prop: "race", rulesVersion: "2014", search: "", limit: 500 });
    const modern = optionsFor({ prop: "race", rulesVersion: "2024", search: "", limit: 500 });

    expect(legacy.some((option) => option.source === "PHB")).toBe(true);
    expect(modern.some((option) => option.source === "XPHB")).toBe(true);
    expect(modern.some((option) => option.source === "PHB")).toBe(false);
  });

  test("changes which document a name resolves to", () => {
    expect(optionById("background", "2014", slugOf("Acolyte"))?.source).toBe("PHB");
    expect(optionById("background", "2024", slugOf("Acolyte"))?.source).toBe("XPHB");
  });
});

describe("a list the player is meant to read, not guess at", () => {
  /*
   * The feat picker capped at 24. The catalog holds far more than that in both
   * editions, so a feat outside the first 24 by name existed only for the
   * player who already knew to type it — and a player scrolling the list read
   * it as the whole list, because that is what a list looks like.
   */
  test("no limit means every feat the ruleset allows", () => {
    for (const rulesVersion of ["2014", "2024"] as const) {
      const capped = optionsFor({ prop: "feat", rulesVersion, search: "", limit: 24 });
      const whole = optionsFor({ prop: "feat", rulesVersion, search: "", limit: null });

      expect(capped).toHaveLength(24);
      expect(whole.length).toBeGreaterThan(100);
    }
  });

  test("the whole list is more than four times what the picker used to show", () => {
    const whole = optionsFor({ prop: "feat", rulesVersion: "2024", search: "", limit: null });

    expect(whole.length).toBeGreaterThan(24 * 4);
  });

  test("a capped picker is unchanged, so the item search keeps its ceiling", () => {
    // Removing the cap everywhere would be the other mistake: nobody scrolls
    // the whole item catalog looking for a longsword.
    expect(
      optionsFor({ prop: "item", rulesVersion: "2014", search: "", limit: 30 }),
    ).toHaveLength(30);
  });
});
