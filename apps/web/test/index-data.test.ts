import { RefResolver, collections, forRulesVersion } from "@bertinis-vault/vetools-index";
import { describe, expect, test } from "vitest";

import {
  armorFormulaOf,
  featChoiceForBackground,
  featOptionLabel,
  itemInfoFor,
  levellingFor,
  optionsFor,
  slugOf,
  speciesBonusFromIndex,
  spellInfoFor,
  spellOptionsForClass,
} from "../src/index-options";

describe("subclasses", () => {
  test("resolve at all, which they never did", () => {
    const result = new RefResolver("2014", collections).resolve("subclass", "school of evocation");

    expect(result.ok).toBe(true);
  });

  test("belong to their class and their edition", () => {
    const legacy = optionsFor({ prop: "subclass", rulesVersion: "2014", search: "", limit: 100, parentName: "Wizard" });
    const modern = optionsFor({ prop: "subclass", rulesVersion: "2024", search: "", limit: 100, parentName: "Wizard" });

    expect(legacy.map((option) => option.label)).toContain("School of Evocation");
    expect(modern.map((option) => option.label)).toContain("Evoker");
    expect(modern.map((option) => option.label)).not.toContain("School of Evocation");
  });

  test("are not offered from another class", () => {
    const wizard = optionsFor({ prop: "subclass", rulesVersion: "2014", search: "", limit: 100, parentName: "Wizard" });

    expect(wizard.map((option) => option.label)).not.toContain("College of Lore");
  });
});

describe("spells by class", () => {
  test("come from the whole index rather than a hand-written hundred", () => {
    const wizard = spellOptionsForClass("Wizard", "PHB", "2014", 9);

    expect(wizard.length).toBeGreaterThan(300);
  });

  test("are the class's own list", () => {
    const wizard = spellOptionsForClass("Wizard", "PHB", "2014", 9).map((row) => row.name);

    expect(wizard).toContain("Fire Bolt");
    expect(wizard).not.toContain("Cure Wounds");
  });

  test("stop at the level asked for", () => {
    const low = spellOptionsForClass("Wizard", "PHB", "2014", 3);

    expect(low.every((row) => row.level <= 3)).toBe(true);
  });
});

describe("spell detail", () => {
  test("carries a real distance now, not the shape of the area", () => {
    expect(spellInfoFor("Fire Bolt", "2014")?.rangeLabel).toBe("120 feet");
    expect(spellInfoFor("Cure Wounds", "2014")?.rangeLabel).toBe("touch");
  });
});

describe("armour", () => {
  test("comes from the index with the class it grants", () => {
    const plate = itemInfoFor(slugOf("Plate Armor"), "2014", "PHB");

    expect(plate?.ac).toBe(18);
    expect(plate?.strength).toBe("15");
    expect(plate?.stealthDisadvantage).toBe(1);
  });

  test("computes the formula the rules layer reads", () => {
    expect(armorFormulaOf(itemInfoFor(slugOf("Plate Armor"), "2014", "PHB")!)).toEqual({ formula: "18" });
    expect(armorFormulaOf(itemInfoFor(slugOf("Leather Armor"), "2014", "PHB")!)).toEqual({ formula: "11+DEX" });
    expect(armorFormulaOf(itemInfoFor(slugOf("Half Plate Armor"), "2014")!)).toEqual({ formula: "15+DEX2" });
    expect(armorFormulaOf(itemInfoFor(slugOf("Shield"), "2014", "PHB")!)).toEqual({ shield: true });
  });
});

describe("weapons", () => {
  test("carry their damage and properties again", () => {
    const longsword = itemInfoFor(slugOf("Longsword"), "2014", "PHB");

    expect(longsword?.damage).toBe("1d8");
    expect(longsword?.damageType).toBe("S");
    expect(longsword?.properties).toContain("V");
  });

  test("carry 2024 mastery, which the repo had nothing of", () => {
    const battleaxe = itemInfoFor(slugOf("Battleaxe"), "2024", "XPHB");

    expect(battleaxe?.mastery).toEqual(["Topple"]);
  });
});

describe("species bonuses", () => {
  test("come from the index for the species that fix them", () => {
    expect(speciesBonusFromIndex(slugOf("Dwarf"), "2014", "PHB")).toEqual({ con: 2 });
    expect(speciesBonusFromIndex(slugOf("Half-Orc"), "2014", "PHB")).toEqual({ str: 2, con: 1 });
  });

  test("are null when the species leaves the choice to the player", () => {
    const legal = forRulesVersion(collections.race ?? [], "2024");

    expect(legal.every((row) => (row as { ability?: unknown }).ability == null)).toBe(true);
  });
});

describe("when a class asks its questions", () => {
  test("the subclass level follows the class, not a rule of thumb", () => {
    // The three shapes 2014 has. Assuming 3 across the board hid the choice
    // from every wizard and druid below level 3, and showed it two levels
    // late to every cleric.
    expect(levellingFor("cleric", "2014").subclassLevel).toBe(1);
    expect(levellingFor("wizard", "2014").subclassLevel).toBe(2);
    expect(levellingFor("fighter", "2014").subclassLevel).toBe(3);
  });

  test("2024 moved every class to level 3", () => {
    for (const classId of ["cleric", "wizard", "fighter", "sorcerer", "druid", "warlock"]) {
      expect(levellingFor(classId, "2024").subclassLevel).toBe(3);
    }
  });

  test("the fighter and the rogue improve at levels the others do not", () => {
    expect(levellingFor("fighter", "2014").improvementLevels).toEqual([4, 6, 8, 12, 14, 16, 19]);
    expect(levellingFor("rogue", "2014").improvementLevels).toEqual([4, 8, 10, 12, 16, 19]);
    expect(levellingFor("wizard", "2014").improvementLevels).toEqual([4, 8, 12, 16, 19]);
  });

  test("2024 traded the level 19 improvement for an epic boon", () => {
    expect(levellingFor("fighter", "2024").improvementLevels).toEqual([4, 6, 8, 12, 14, 16]);
    expect(levellingFor("wizard", "2024").improvementLevels).not.toContain(19);
  });

  test("an unknown class falls back rather than losing the improvements", () => {
    expect(levellingFor("", "2014").improvementLevels.length).toBeGreaterThan(0);
  });
});

describe("the feat a background grants", () => {
  test("a background offering a choice offers all of it, not the first one", () => {
    // Ruined reads "the Alert, Skilled, or Tough feat (your choice)". The data
    // lists those as three entries, and reading them as three grants would
    // hand out all three.
    const choice = featChoiceForBackground("ruined", "2014");

    expect(choice?.options.map((option) => option.name)).toEqual(["Alert", "Skilled", "Tough"]);
    expect(choice?.isOpen).toBeUndefined();
  });

  test("a background naming one feat needs no answer", () => {
    const choice = featChoiceForBackground("farmer", "2024");

    expect(choice?.options).toHaveLength(1);
    expect(choice?.options[0]?.name).toBe("Tough");
  });

  test("a background allowing an unnamed feat is marked open", () => {
    // Haunted One: "Survivor or a Dark Gift feat of your choice". The Ravenloft
    // reprint is a 2024 book; the 2014 Van Richten's version grants no feat.
    const choice = featChoiceForBackground("haunted-one", "2024", "RHW");

    expect(choice?.options.map((option) => option.name)).toEqual(["Survivor"]);
    expect(choice?.isOpen).toBe(true);
  });

  test("the 2014 core backgrounds grant nothing, and say so", () => {
    expect(featChoiceForBackground("acolyte", "2014")).toBeNull();
    expect(featChoiceForBackground("sage", "2014")).toBeNull();
  });

  test("every 2024 background grants an origin feat", () => {
    const twentyFourCore = ["acolyte", "artisan", "charlatan", "criminal", "entertainer",
      "farmer", "guard", "guide", "hermit", "merchant", "noble", "sage", "sailor", "scribe",
      "soldier", "wayfarer"];

    for (const backgroundId of twentyFourCore) {
      expect(featChoiceForBackground(backgroundId, "2024")?.options.length ?? 0).toBeGreaterThan(0);
    }
  });

  test("a sub-choice the background already made shows in the label", () => {
    // The 2024 Acolyte grants Magic Initiate with the cleric list, not a bare
    // Magic Initiate the player still has to aim.
    const choice = featChoiceForBackground("acolyte", "2024");

    expect(featOptionLabel(choice?.options[0] ?? { name: "" })).toBe("Magic Initiate (Cleric)");
  });
});
