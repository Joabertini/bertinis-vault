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
} from "../src/lib/index-options";

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

/*
 * The size the index carries is the offer, not an answer.
 *
 * It used to be `r.size?.[0]`, one letter, and thirty species print two. Every
 * one of them came out Small — the 2024 human included, which is a Small
 * square and half the carrying capacity on a character nobody built that way.
 * Pinned here rather than in the front, because the front cannot ask a
 * question the data has already answered for it.
 */
describe("the sizes a species offers", () => {
  const races = (collections.race ?? []) as { name: string; source: string; sizes?: unknown }[];

  test("arrive as a list, never as a bare letter", () => {
    const bare = races.filter((row) => row.sizes != null && !Array.isArray(row.sizes));

    expect(bare).toEqual([]);
  });

  test("are two for the thirty species that ask, and always Small or Medium", () => {
    const asking = races.filter((row) => Array.isArray(row.sizes) && row.sizes.length > 1);

    expect(asking).toHaveLength(30);
    expect(asking.every((row) => (row.sizes as string[]).join() === "S,M")).toBe(true);
  });

  test("include the three 2024 species a player meets first", () => {
    const named = ["Human", "Aasimar", "Tiefling"].map((name) =>
      races.find((row) => row.name === name && row.source === "XPHB"),
    );

    expect(named.map((row) => row?.sizes)).toEqual([
      ["S", "M"],
      ["S", "M"],
      ["S", "M"],
    ]);
  });

  test("are null rather than empty when a species states none", () => {
    // `raceInfoFor` merges a subrace over its race by skipping nulls. An empty
    // array is a value: it would erase the race's own sizes on the way past.
    const silent = races.filter((row) => row.sizes == null);

    expect(silent.length).toBeGreaterThan(0);
    expect(silent.every((row) => row.sizes === null)).toBe(true);
  });
});

/*
 * Una propiedad de arma es un codigo, nunca un objeto stringificado.
 *
 * 5etools escribe `property` de dos formas: casi siempre `"2H|XPHB"`, y como
 * `{uid, note}` cuando la propiedad vale solo bajo una condicion. El
 * generador hacia `String(entry)`, asi que la unica que es objeto -- la Lanza
 * de 2024, Two-Handed *unless mounted* -- viajaba al indice como el texto
 * literal `"[object Object]"`. `masteryOf` ya habia aprendido esta leccion en
 * el campo de al lado; `property` no. Ver [[parser-fuente-ajena-dos-muestras]].
 */
describe("las propiedades de un arma", () => {
  const weapons = (collections.item ?? []) as {
    name: string;
    source: string;
    weaponCategory?: unknown;
    properties?: unknown;
  }[];

  test("son siempre codigos cortos, en las 325 armas", () => {
    const armed = weapons.filter((row) => row.weaponCategory);
    const bad = armed.filter((row) =>
      ((row.properties as unknown[]) ?? []).some(
        (code) => typeof code !== "string" || !/^[A-Za-z0-9]{1,4}$/.test(code),
      ),
    );

    expect(armed.length).toBeGreaterThan(300);
    expect(bad.map((row) => `${row.name}/${row.source}`)).toEqual([]);
  });

  test("la Lanza de 2024 llega con las tres que imprime", () => {
    // La unica del catalogo cuya `property` trae un objeto.
    const lance = weapons.find((row) => row.name === "Lance" && row.source === "XPHB");

    expect(lance?.properties).toEqual(["H", "R", "2H"]);
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

describe("what the web builder actually sends", () => {
  test("its skill picks reach the payload as dnd5e keys", async () => {
    const { buildCanonicalSnapshot, initialState } = await import("../src/lib/builder");
    const { buildToPayload, RefResolver, collections } = await import("@bertinis-vault/vetools-index");

    const snapshot = buildCanonicalSnapshot({
      ...initialState,
      proficienciesText: "Arcana\nSleight of Hand\nHistory",
    });
    const { payload } = buildToPayload(snapshot, new RefResolver("2014", collections));

    expect(payload?.proficiencies.skills).toEqual(["arc", "slt", "his"]);
  });

  test("its armour and weapon reach the payload marked worn", async () => {
    const { buildCanonicalSnapshot, initialState } = await import("../src/lib/builder");
    const { buildToPayload, RefResolver, collections } = await import("@bertinis-vault/vetools-index");

    // The ids a pick from the index produces. The hand-written catalog's own
    // `leather` does not resolve to anything — see the audit's finding I.
    const snapshot = buildCanonicalSnapshot({
      ...initialState,
      armorId: "leather-armor",
      weaponId: "dagger",
    });
    const { payload } = buildToPayload(snapshot, new RefResolver("2014", collections));

    const worn = payload?.equipment.filter((entry) => entry.equipped).map((entry) => entry.ref.hash);
    expect(worn).toContain("leather%20armor_phb");
    expect(worn).toContain("dagger_phb");
  });

  test("five of the hand-written equipment ids resolve to nothing", async () => {
    const { RefResolver, collections } = await import("@bertinis-vault/vetools-index");
    const resolver = new RefResolver("2014", collections);

    // Recorded rather than fixed here: it belongs with the equipment work.
    // `unarmored` and `mage-armor` are states rather than items and are
    // expected to miss; the rest are names the catalog and the index spell
    // differently, and each one silently drops the item from the character.
    const unresolved = ["leather", "arcane-focus", "holy-symbol", "rope-hempen", "rations"];

    for (const id of unresolved) {
      expect(resolver.resolve("item", id).ok, id).toBe(false);
    }
  });
});
