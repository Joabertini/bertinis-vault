/**
 * The domain's armour and weapon table, checked against the index.
 *
 * The domain cannot read the index — nothing in `packages/domain` may, or the
 * rules would drag 1.3 MB of book behind them — so the table is written out by
 * hand there and measured here. Both halves are covered: what a class grants
 * as a character's first, and what it grants as their second. A hand-written
 * table beside a measured one drifts, and this is the file that notices.
 *
 * Only this package can run the comparison. The domain does not depend on the
 * index and the exporter does not either; the Forge depends on both.
 */

import { collections } from "@bertinis-vault/vetools-index";
import {
  classProficienciesFor,
  firstClassProficiencyGrant,
  laterClassProficiencyGrant,
} from "@bertinis-vault/domain";
import { describe, expect, test } from "vitest";

import { gearProficienciesFor, weaponsMatchingClause } from "../src/lib/gear-proficiencies";
import { FOUNDRY_WEAPON_IDS } from "../src/lib/weapon-mastery";

type ClassRow = {
  name: string;
  source: string;
  startingProficiencies: {
    armor: string[];
    weapons: string[];
    weaponItems: string[];
    weaponClauses: string[];
  } | null;
  multiclassGrants: { armor: string[]; weapons: string[] } | null;
};

/** dnd5e's keys, from the words 5etools uses. */
const ARMOR_KEY: Record<string, string> = {
  light: "lgt",
  medium: "med",
  heavy: "hvy",
  shield: "shl",
};

const WEAPON_KEY: Record<string, string> = {
  simple: "sim",
  martial: "mar",
};

/** "hand crossbows" and "shortswords" name the same base items as `handcrossbow`. */
function baseItemId(name: string): string {
  return name
    .toLowerCase()
    .replace(/s$/, "")
    .replace(/[^a-z]/g, "");
}

const rows = (collections.class ?? []) as unknown as ClassRow[];

/**
 * Which base weapons are simple and which are martial, off the item table.
 *
 * The domain keeps its own short list for the same question. It is short on
 * purpose — it only has to cover the weapons a class block names — so this
 * reads the whole table instead of copying that list, and the two agreeing is
 * the point of the comparison below.
 */
const WEAPON_CATEGORY = new Map<string, string>();
for (const item of (collections.item ?? []) as unknown as {
  name: string;
  weaponCategory: string | null;
}[]) {
  const id = baseItemId(item.name);
  if (item.weaponCategory && !WEAPON_CATEGORY.has(id)) WEAPON_CATEGORY.set(id, item.weaponCategory);
}

function covers(categories: string[], id: string): boolean {
  const category = WEAPON_CATEGORY.get(id);
  return (
    (category === "simple" && categories.includes("sim")) ||
    (category === "martial" && categories.includes("mar"))
  );
}

/** The classes the builder offers, by the id it uses for them. */
const OFFERED = new Set([
  "artificer",
  "barbarian",
  "bard",
  "cleric",
  "druid",
  "fighter",
  "monk",
  "paladin",
  "ranger",
  "rogue",
  "sorcerer",
  "warlock",
  "wizard",
]);

describe("the first-class table against the index", () => {
  for (const row of rows) {
    const classId = row.name.toLowerCase();
    if (!OFFERED.has(classId)) continue;
    if (row.source === "EFA") continue;

    // The artificer has no 2024 printing, so its 2014 block is what a 2024
    // artificer gets. There is no measured row to check that against.
    const rulesVersion = row.source === "XPHB" ? "5e-2024" : "5e-2014";

    test(`${row.name} (${row.source})`, () => {
      const grant = firstClassProficiencyGrant(classId, rulesVersion);
      const measured = row.startingProficiencies;
      expect(measured).not.toBeNull();
      if (!measured) return;

      expect(grant.armor).toEqual(measured.armor.map((entry) => ARMOR_KEY[entry] ?? entry));
      expect(grant.weaponCategories).toEqual(
        measured.weapons.map((entry) => WEAPON_KEY[entry] ?? entry),
      );
      expect(grant.weaponClauses).toEqual(measured.weaponClauses);

      // The table drops a named weapon a category already covers, so it is
      // the measured list filtered the same way — never a shorter one for a
      // reason nothing states.
      const named = measured.weaponItems.map(baseItemId);
      expect(named.filter((id) => !covers(grant.weaponCategories, id))).toEqual(grant.weaponItems);
    });
  }
});

describe("the multiclass table against the index", () => {
  for (const row of rows) {
    const classId = row.name.toLowerCase();
    if (!OFFERED.has(classId)) continue;
    // TCE and EFA print the same artificer twice; one comparison is enough.
    if (row.source === "EFA") continue;

    const rulesVersion = row.source === "XPHB" ? "5e-2024" : "5e-2014";

    test(`${row.name} (${row.source})`, () => {
      const grant = laterClassProficiencyGrant(classId, rulesVersion);
      const measured = row.multiclassGrants;

      // A class that prints no multiclass block grants nothing. The 2024 monk,
      // sorcerer and wizard each do exactly that.
      if (!measured) {
        expect(grant.armor).toEqual([]);
        expect(grant.weaponCategories).toEqual([]);
        expect(grant.weaponItems).toEqual([]);
        return;
      }

      expect(grant.armor).toEqual(measured.armor.map((entry) => ARMOR_KEY[entry] ?? entry));

      const categories = measured.weapons.filter((entry) => entry in WEAPON_KEY);
      const named = measured.weapons.filter((entry) => !(entry in WEAPON_KEY));

      expect(grant.weaponCategories).toEqual(categories.map((entry) => WEAPON_KEY[entry]));
      expect(grant.weaponItems).toEqual(named.map(baseItemId));
    });
  }
});

describe("a character's own proficiencies", () => {
  test("read the starting block for the first class and the dip block for the rest", () => {
    // A wizard who dipped fighter gets light and medium armour and shields —
    // never heavy, which only the fighter's *starting* block grants.
    const build = classProficienciesFor(
      [{ classId: "wizard" }, { classId: "fighter" }],
      "5e-2014",
    );

    expect(build.armor).toEqual(["lgt", "med", "shl"]);
    expect(build.weaponCategories).toEqual(["sim", "mar"]);
    expect(build.armor).not.toContain("hvy");
  });

  test("say which class granted each one", () => {
    const build = classProficienciesFor(
      [{ classId: "wizard" }, { classId: "cleric" }],
      "5e-2014",
    );

    // The player asked the question the other way round: the shield is on the
    // sheet, and nothing on the wizard's page explains it.
    expect(build.grantedBy["shl"]).toEqual(["cleric"]);
    expect(build.grantedBy["dagger"]).toEqual(["wizard"]);
  });

  test("do not repeat a weapon the category already covers", () => {
    // A 2014 bard is proficient with every simple weapon and with four martial
    // ones. Listing the four beside "simple" would be right; listing a dagger
    // beside it would be noise.
    const bard = classProficienciesFor([{ classId: "bard" }], "5e-2014");
    expect(bard.weaponCategories).toEqual(["sim"]);
    expect(bard.weaponItems).toEqual(["handcrossbow", "longsword", "rapier", "shortsword"]);

    // The same bard who then dipped fighter has martial weapons outright, so
    // the four named ones stop being worth saying.
    const dipped = classProficienciesFor(
      [{ classId: "bard" }, { classId: "fighter" }],
      "5e-2014",
    );
    expect(dipped.weaponCategories).toEqual(["sim", "mar"]);
    expect(dipped.weaponItems).toEqual([]);
  });

  test("keep a 2024 clause as the rule the book prints", () => {
    const rogue = classProficienciesFor([{ classId: "rogue" }], "5e-2024");

    expect(rogue.weaponCategories).toEqual(["sim"]);
    expect(rogue.weaponClauses).toEqual([
      "Martial weapons that have the Finesse or Light property",
    ]);
  });

  test("a class the table has never heard of grants nothing rather than throwing", () => {
    const nobody = classProficienciesFor([{ classId: "mystic" }], "5e-2014");

    expect(nobody.armor).toEqual([]);
    expect(nobody.weaponCategories).toEqual([]);
  });
});

describe("a rule expanded into weapons", () => {
  test("the 2024 monk's Light clause names the weapons the book names", () => {
    // Martial, Light, and a base item dnd5e knows. The Hoopak is martial and
    // Light too, and is not a dnd5e base item — offering it would put an id in
    // a set Foundry checks with `has(item.type.baseItem)` and matches nothing.
    expect(weaponsMatchingClause("Martial weapons that have the Light property", "2024")).toEqual([
      "handcrossbow",
      "scimitar",
      "shortsword",
    ]);
  });

  test("the rogue's clause is wider by exactly the Finesse weapons", () => {
    const rogue = weaponsMatchingClause(
      "Martial weapons that have the Finesse or Light property",
      "2024",
    );

    expect(rogue).toEqual(["handcrossbow", "rapier", "scimitar", "shortsword", "whip"]);
  });

  test("every weapon a clause names is one Foundry has an id for", () => {
    for (const clause of [
      "Martial weapons that have the Light property",
      "Martial weapons that have the Finesse or Light property",
    ]) {
      for (const id of weaponsMatchingClause(clause, "2024")) {
        expect(FOUNDRY_WEAPON_IDS.has(id)).toBe(true);
      }
    }
  });

  test("a sentence naming no category expands to nothing rather than to a guess", () => {
    expect(weaponsMatchingClause("Weapons you are trained with", "2024")).toEqual([]);
    expect(weaponsMatchingClause("Martial weapons", "2024")).toEqual([]);
  });

  test("the panel shows the rule and what it comes to", () => {
    const rogue = gearProficienciesFor([{ classId: "rogue" }], "2024");
    const clause = rogue.weapons.find((line) => line.detail);

    expect(clause?.label).toBe("Armas marciales sutiles o ligeras");
    expect(clause?.detail).toContain("Scimitar");
    expect(rogue.clauseWeaponIds).toContain("scimitar");
  });

  test("a 2014 character has no rule to expand", () => {
    const rogue = gearProficienciesFor([{ classId: "rogue" }], "2014");

    expect(rogue.clauseWeaponIds).toEqual([]);
    expect(rogue.weapons.map((line) => line.label)).toEqual([
      "Armas simples",
      "Hand Crossbow",
      "Longsword",
      "Rapier",
      "Shortsword",
    ]);
  });

  test("a character with no armour proficiency says so rather than showing a gap", () => {
    const wizard = gearProficienciesFor([{ classId: "wizard" }], "2024");

    expect(wizard.armor).toEqual([]);
    expect(wizard.weapons.map((line) => line.label)).toEqual(["Armas simples"]);
  });
});
