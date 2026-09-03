import { describe, expect, test } from "vitest";

import { attributeSpells, spellPlan, spellPlansFor } from "../src/lib/spells";
import type { CharacterBuild } from "@bertinis-vault/contracts";

/**
 * Just enough of a build for the picker: the slots decide which spell levels
 * are open, and the Intelligence decides how many a 2014 wizard prepares.
 */
const snapshotWith = (slots: Record<string, number>, intelligence = 16) =>
  ({
    derived: { spellcasting: { ability: "int", slots } },
    abilities: { final: { str: 10, dex: 10, con: 10, int: intelligence, wis: 10, cha: 10 } },
  }) as unknown as CharacterBuild;

const wizard = (level: number, spellbook: string[], slots: Record<string, number>) =>
  spellPlan({
    classId: "wizard",
    className: "Wizard",
    classSource: "PHB",
    subclassId: "",
    level,
    rulesVersion: "2014",
    snapshot: snapshotWith(slots),
    spellbook,
  });

describe("the wizard's two tracks", () => {
  test("the book offers the wizard list, sized by the class and not by the slots", () => {
    const plan = wizard(1, [], { spell1: 2 });

    expect(plan.book?.limit).toBe(6);
    expect(plan.book?.options.flatMap((entry) => entry.names).length).toBeGreaterThan(6);
  });

  test("the book only offers levels the wizard has slots for", () => {
    // "Each of these spells must be of a level for which you have spell
    // slots" — so a level 3 wizard writes down 1st and 2nd level spells.
    const plan = wizard(3, [], { spell1: 4, spell2: 2 });

    expect(plan.book?.options.map((entry) => entry.level)).toEqual([1, 2]);
  });

  test("what can be prepared comes out of the book, not out of the wizard list", () => {
    const plan = wizard(1, ["Nv1: Shield", "Nv1: Magic Missile"], { spell1: 2 });

    expect(plan.spellsByLevel).toEqual([{ level: 1, names: ["Magic Missile", "Shield"] }]);
  });

  test("an empty book prepares nothing, rather than the whole class list", () => {
    // This is the bug the book replaces: a wizard used to be handed every
    // wizard spell to prepare from, book or no book.
    const plan = wizard(1, [], { spell1: 2 });

    expect(plan.spellsByLevel).toEqual([]);
    expect(plan.picker?.spellLimit).toBe(0);
  });

  test("preparing is still capped by the class, not by the size of the book", () => {
    // A level 1 wizard with Intelligence 16 prepares 1 + 3 = 4. Six written
    // down does not make six prepared.
    const plan = wizard(1, [
      "Nv1: Shield",
      "Nv1: Magic Missile",
      "Nv1: Burning Hands",
      "Nv1: Sleep",
      "Nv1: Mage Armor",
      "Nv1: Detect Magic",
    ], { spell1: 2 });

    expect(plan.picker?.spellLimit).toBe(4);
  });

  test("nobody else has a book", () => {
    const plan = spellPlan({
      classId: "cleric",
      className: "Cleric",
      classSource: "PHB",
      subclassId: "",
      level: 3,
      rulesVersion: "2014",
      snapshot: snapshotWith({ spell1: 4, spell2: 2 }),
    });

    expect(plan.book).toBeNull();
    // And nothing narrowed: a cleric still prepares from the whole class list.
    expect(plan.spellsByLevel.flatMap((entry) => entry.names).length).toBeGreaterThan(10);
  });
});

describe("a character who casts with more than one class", () => {
  const build = (intelligence = 16, wisdom = 16) =>
    ({
      derived: { spellcasting: { ability: "int", slots: { "1": 4, "2": 3 } } },
      abilities: {
        final: { str: 10, dex: 10, con: 10, int: intelligence, wis: wisdom, cha: 10 },
      },
    }) as unknown as CharacterBuild;

  const label = (classId: string) => ({
    label: classId.charAt(0).toUpperCase() + classId.slice(1),
    source: "PHB",
  });

  test("a martial who dipped into a caster gets a plan at all", () => {
    // The beta report: a fighter who took a level of wizard saw no Spells
    // chamber. The plan was built from the first class, the fighter casts
    // nothing, and the wizard was never asked.
    const plans = spellPlansFor({
      entries: [
        { classId: "fighter", level: 5, casterProgression: null },
        { classId: "wizard", level: 3, casterProgression: "full", spellcastingAbility: "int" },
      ] as never,
      labelFor: label,
      rulesVersion: "2014",
      snapshot: build(),
      spellbook: ["Nv1: Shield", "Nv1: Magic Missile"],
    });

    expect(plans.map((plan) => plan.classId)).toEqual(["wizard"]);
    expect(plans[0]?.classLevel).toBe(3);
  });

  test("two casters are two plans, each with its own count", () => {
    const plans = spellPlansFor({
      entries: [
        { classId: "wizard", level: 3, casterProgression: "full", spellcastingAbility: "int" },
        { classId: "cleric", level: 3, casterProgression: "full", spellcastingAbility: "wis" },
      ] as never,
      labelFor: label,
      rulesVersion: "2014",
      snapshot: build(),
      spellbook: ["Nv1: Shield"],
    });

    expect(plans.map((plan) => plan.classId)).toEqual(["wizard", "cleric"]);
    // Not one merged budget: preparing six wizard spells and no cleric ones is
    // what a single picker over both lists would have allowed.
    expect(plans[0]?.picker?.spellLimit).toBeGreaterThan(0);
    expect(plans[1]?.picker?.spellLimit).toBeGreaterThan(0);
  });

  test("a class is capped by its own table, not by the shared slots", () => {
    // Spells known and prepared are settled "as if you were a single-classed
    // member of that class", and the books add that you may hold slots of a
    // higher level than any spell you know.
    //
    // Wizard 5 / cleric 5 is the measured case: caster level 10 gives slots to
    // 5th, and each class prepares to 3rd. Feeding the picker the shared table
    // offered five levels of spells to a character who can prepare three.
    const shared = {
      derived: {
        spellcasting: { ability: "int", slots: { "1": 4, "2": 3, "3": 3, "4": 3, "5": 2 } },
      },
      abilities: { final: { str: 10, dex: 10, con: 10, int: 16, wis: 16, cha: 10 } },
    } as unknown as CharacterBuild;

    const plans = spellPlansFor({
      entries: [
        { classId: "wizard", level: 5, casterProgression: "full", spellcastingAbility: "int" },
        { classId: "cleric", level: 5, casterProgression: "full", spellcastingAbility: "wis" },
      ] as never,
      labelFor: label,
      rulesVersion: "2014",
      snapshot: shared,
      spellbook: ["Nv1: Shield", "Nv2: Misty Step", "Nv3: Fireball"],
    });

    expect(plans[0]?.picker?.maxSpellLevel).toBe(3);
    expect(plans[1]?.picker?.maxSpellLevel).toBe(3);
  });

  test("a plain fighter contributes nothing, so a dip has no gap to close", () => {
    // Worth pinning because it is where this was first got wrong: only the
    // Eldritch Knight and the Arcane Trickster add a third of their levels. A
    // fighter 17 / wizard 1 is a first level caster, not a ninth.
    const plans = spellPlansFor({
      entries: [
        { classId: "fighter", level: 17, casterProgression: null },
        { classId: "wizard", level: 1, casterProgression: "full", spellcastingAbility: "int" },
      ] as never,
      labelFor: label,
      rulesVersion: "2014",
      snapshot: build(),
      spellbook: ["Nv1: Shield"],
    });

    expect(plans).toHaveLength(1);
    expect(plans[0]?.picker?.maxSpellLevel).toBe(1);
  });

  test("an eldritch knight casts, and its wizard dip is still capped at first", () => {
    // The other half of the same rule. A third-caster subclass is the only way
    // a fighter contributes at all, and its own spell table is printed on the
    // subclass because the fighter has none. Caster level 6 here, slots to 3rd,
    // and the one wizard level still prepares nothing above 1st.
    const shared = {
      derived: { spellcasting: { ability: "int", slots: { "1": 4, "2": 3, "3": 3 } } },
      abilities: { final: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 } },
    } as unknown as CharacterBuild;

    const plans = spellPlansFor({
      entries: [
        {
          classId: "fighter",
          subclassId: "eldritch-knight",
          level: 17,
          casterProgression: null,
          subclassCasterProgression: "1/3",
          spellcastingAbility: "int",
        },
        { classId: "wizard", level: 1, casterProgression: "full", spellcastingAbility: "int" },
      ] as never,
      labelFor: label,
      rulesVersion: "2014",
      snapshot: shared,
      spellbook: ["Nv1: Shield"],
    });

    expect(plans.map((plan) => plan.classId)).toEqual(["fighter", "wizard"]);
    expect(plans[1]?.picker?.maxSpellLevel).toBe(1);
  });

  test("a chosen spell is charged to one class, not to every list that has it", () => {
    const plans = spellPlansFor({
      entries: [
        { classId: "wizard", level: 3, casterProgression: "full", spellcastingAbility: "int" },
        { classId: "cleric", level: 3, casterProgression: "full", spellcastingAbility: "wis" },
      ] as never,
      labelFor: label,
      rulesVersion: "2014",
      snapshot: build(),
    });

    const owned = attributeSpells(["Nv1: Bless"], plans, (plan) => plan.spellsByLevel);
    const charged = [...owned.entries()].filter(([, lines]) => lines.length > 0);

    expect(charged).toHaveLength(1);
  });
});

describe("the table a class reads on its own", () => {
  const label = (classId: string) => ({
    label: classId.charAt(0).toUpperCase() + classId.slice(1),
    source: "PHB",
  });

  const snapshot = (slots: Record<string, number>) =>
    ({
      derived: { spellcasting: { ability: "wis", slots } },
      abilities: { final: { str: 10, dex: 10, con: 10, int: 16, wis: 16, cha: 16 } },
    }) as unknown as CharacterBuild;

  test("a half-caster reads its own table, not its contribution to the shared one", () => {
    // The two are different numbers and confusing them is a real bug: a class
    // contributes floor(level / 2) to the shared caster level and reads its own
    // table at ceil(level / 2). Measured, a paladin 5 asked the wrong way came
    // back with three 1st level slots where the published table gives four 1st
    // and two 2nd — so every 2nd level paladin spell was refused.
    const plans = spellPlansFor({
      entries: [
        { classId: "paladin", level: 5, casterProgression: "1/2", spellcastingAbility: "cha" },
        { classId: "ranger", level: 5, casterProgression: "1/2", spellcastingAbility: "wis" },
      ] as never,
      labelFor: label,
      rulesVersion: "2014",
      snapshot: snapshot({ "1": 4, "2": 3 }),
    });

    expect(plans.map((plan) => plan.picker?.maxSpellLevel)).toEqual([2, 2]);
  });

  test("the editions differ at a half-caster's first level, and only there", () => {
    const of = (rulesVersion: "2014" | "2024") =>
      spellPlansFor({
        entries: [
          { classId: "paladin", level: 1, casterProgression: "1/2", spellcastingAbility: "cha" },
          { classId: "wizard", level: 3, casterProgression: "full", spellcastingAbility: "int" },
        ] as never,
        labelFor: label,
        rulesVersion,
        snapshot: snapshot({ "1": 4, "2": 2 }),
      });

    // Both editions show the paladin. A class that will cast and does not yet
    // is not the same as a class that never will, and `spellPlan` says so
    // deliberately - the section reads "todavia sin espacios de conjuro"
    // rather than vanishing and leaving the player wondering.
    expect(of("2014").map((plan) => plan.classId)).toEqual(["paladin", "wizard"]);
    expect(of("2024").map((plan) => plan.classId)).toEqual(["paladin", "wizard"]);

    // The difference is what the paladin can reach: nothing in 2014, first
    // level spells in 2024. That is the one row where the tables differ.
    expect(of("2014")[0]?.picker?.maxSpellLevel).toBe(0);
    expect(of("2024")[0]?.picker?.maxSpellLevel).toBe(1);
  });
});

describe("a third caster before it casts", () => {
  test("a fighter of 2 gets no slots from a subclass that starts at 3", () => {
    // All four third-caster subclasses in the data start at 3rd level, and the
    // ceil(level / 3) reading would otherwise give a 1st level fighter two.
    const plans = spellPlansFor({
      entries: [
        {
          classId: "fighter",
          subclassId: "eldritch-knight",
          level: 2,
          casterProgression: null,
          subclassCasterProgression: "1/3",
          spellcastingAbility: "int",
        },
      ] as never,
      labelFor: (classId) => ({ label: classId, source: "PHB" }),
      rulesVersion: "2014",
      snapshot: {
        derived: { spellcasting: { ability: "int", slots: {} } },
        abilities: { final: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 } },
      } as unknown as CharacterBuild,
    });

    expect(plans[0]?.picker?.maxSpellLevel ?? 0).toBe(0);
  });
});
