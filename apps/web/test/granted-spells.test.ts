import { describe, expect, test } from "vitest";

import { grantedSpellsFor, spellGrantsFor, unansweredVariants } from "../src/lib/granted-spells";
import { initialState } from "../src/lib/builder";
import { slugOf } from "../src/lib/index-options";

const draft = (over: Record<string, unknown> = {}) => ({
  ...initialState,
  rulesVersion: "5e-2024" as const,
  raceId: slugOf("Elf"),
  // Four books print an Elf legal in 2024 and they grant different spells.
  // A draft records the book, so the test does too.
  sourceBooks: { [`race:${slugOf("Elf")}`]: "XPHB" },
  subraceId: "",
  classId: "fighter",
  subclassId: "",
  level: 3,
  spellVariantChoices: {},
  cantripsText: "",
  spellsText: "",
  spellbookText: "",
  ...over,
});

describe("what a species grants without being asked", () => {
  test("a 2024 elf is asked its lineage, because nothing else in the data asks", () => {
    /*
     * XPHB ships zero subraces. The elf's Drow, High Elf and Wood Elf exist
     * only as the names on its spell blocks, so before this the choice could
     * not be made at all.
     */
    const [species] = spellGrantsFor(draft(), "2024");

    expect(species?.variants).toEqual(["Drow", "High Elf", "Wood Elf"]);
    expect(species?.chamber).toBe("species");
    expect(unansweredVariants(draft(), "2024").map((source) => source.key)).toEqual(["race"]);
  });

  test("an unanswered lineage grants nothing, rather than all three", () => {
    expect(grantedSpellsFor(draft(), "2024")).toEqual([]);
  });

  test("the chosen lineage brings its cantrip and its daily spell", () => {
    const spells = grantedSpellsFor(draft({ spellVariantChoices: { race: "Drow" } }), "2024");

    expect(spells.map((entry) => entry.label)).toEqual(["dancing lights", "faerie fire"]);
    expect(unansweredVariants(draft({ spellVariantChoices: { race: "Drow" } }), "2024")).toEqual([]);
  });

  test("a granted daily spell is cast innately, not out of a slot", () => {
    // A level 1 slot for something the species hands over free would be the
    // fighter paying for magic they do not have.
    const spells = grantedSpellsFor(draft({ spellVariantChoices: { race: "Drow" } }), "2024");
    const faerieFire = spells.find((entry) => entry.label === "faerie fire");

    expect(faerieFire?.method).toBe("innate");
    expect(faerieFire?.uses).toEqual({ max: 1, period: "day" });
    // Innate or not, it is castable, which is what `prepared` means.
    expect(faerieFire?.preparation).toBe("prepared");
  });

  test("the species gate counts the character's level and not a class's", () => {
    // The drow's Faerie Fire arrives at character level 3 whatever they took
    // those levels in.
    const atOne = grantedSpellsFor(
      draft({ level: 1, spellVariantChoices: { race: "Drow" } }),
      "2024",
    );

    expect(atOne.map((entry) => entry.label)).toEqual(["dancing lights"]);
  });

  test("a grant with no alternatives simply applies", () => {
    // The 2014 tiefling has one list and no lineage question.
    const spells = grantedSpellsFor(
      draft({
        rulesVersion: "5e-2014",
        raceId: slugOf("Tiefling"),
        sourceBooks: { [`race:${slugOf("Tiefling")}`]: "PHB" },
        level: 5,
      }),
      "2014",
    );

    expect(spells.map((entry) => entry.label)).toContain("thaumaturgy");
    expect(spells.every((entry) => entry.grantedBy === "Tiefling")).toBe(true);
  });

  test("a filter is not a grant: nothing is chosen for the player", () => {
    /*
     * The high elf's level 1 grant is "any wizard cantrip", and choosing one
     * would put a spell on the sheet the player never picked. Its level 3
     * spell is named outright and does arrive — the same lineage states both
     * ways, which is why the difference is read rather than assumed.
     */
    const spells = grantedSpellsFor(draft({ spellVariantChoices: { race: "High Elf" } }), "2024");

    expect(spells.map((entry) => entry.label)).toEqual(["detect magic"]);
  });
});

describe("what a subclass grants, as opposed to offers", () => {
  const cleric = (over: Record<string, unknown> = {}) =>
    draft({
      rulesVersion: "5e-2014" as const,
      raceId: slugOf("Human"),
      sourceBooks: { [`race:${slugOf("Human")}`]: "PHB" },
      classId: "cleric",
      subclassId: "life-domain",
      level: 3,
      ...over,
    });

  test("a domain's spells are always prepared, and do not cost a preparation", () => {
    /*
     * This is what dnd5e's third preparation state is for. Before, the domain
     * only widened the picker, so a Life Domain cleric spent one of the day's
     * preparations on a Bless the domain hands over.
     */
    const spells = grantedSpellsFor(cleric(), "2014");

    expect(spells.map((entry) => entry.label)).toEqual([
      "bless",
      "cure wounds",
      "lesser restoration",
      "spiritual weapon",
    ]);
    expect(spells.every((entry) => entry.preparation === "always")).toBe(true);
  });

  test("a domain's later spells wait for the class level that grants them", () => {
    // And it is the *class* level, which is the gate a subclass states.
    expect(grantedSpellsFor(cleric({ level: 1 }), "2014").map((entry) => entry.label)).toEqual([
      "bless",
      "cure wounds",
    ]);
  });

  test("the subclass question is asked in the class chamber, not beside the spells", () => {
    // Circle of the Land picks a terrain, and a druid looks for that where
    // they picked the circle.
    const land = spellGrantsFor(
      cleric({ classId: "druid", subclassId: "circle-of-the-land", level: 3 }),
      "2014",
    ).find((source) => source.chamber === "class");

    expect(land?.chamber).toBe("class");
    expect(land?.variants).toContain("Arctic");
  });
});
