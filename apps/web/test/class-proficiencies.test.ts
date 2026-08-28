/**
 * The domain's armour and weapon table, checked against the index.
 *
 * The table is hand-written because the index does not carry a class's
 * *starting* proficiencies — only what a class grants as a second one. That
 * half the index does carry, so that half is checked here rather than trusted:
 * a hand-written table beside a measured one drifts, and this is the file that
 * notices when it does.
 *
 * Only this package can run the comparison. The domain does not depend on the
 * index and the exporter does not either; the Forge depends on both.
 */

import { collections } from "@bertinis-vault/vetools-index";
import { classProficienciesFor, laterClassProficiencyGrant } from "@bertinis-vault/domain";
import { describe, expect, test } from "vitest";

type ClassRow = {
  name: string;
  source: string;
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
