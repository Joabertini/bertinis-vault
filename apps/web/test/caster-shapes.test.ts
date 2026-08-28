import { describe, expect, test } from "vitest";

import { buildCanonicalSnapshot, initialState } from "../src/lib/builder";
import { spellPlan } from "../src/lib/spells";
import { slugOf } from "../src/lib/index-options";

/**
 * Every caster in the game, through the one path the Forge actually uses.
 *
 * They do not share a rule. Two start casting at a different level in each
 * edition, one prepares out of a book, one keeps its slots under a different
 * key, and two are not classes at all. A table of counts hides all of that;
 * running each of them through the picker does not.
 */
const plan = (over: {
  classId: string;
  className: string;
  classSource?: string;
  subclassId?: string;
  level: number;
  rulesVersion?: "2014" | "2024";
  ability?: number;
}) => {
  const rulesVersion = over.rulesVersion ?? "2014";
  const snapshot = buildCanonicalSnapshot({
    ...initialState,
    rulesVersion: rulesVersion === "2024" ? "5e-2024" : "5e-2014",
    raceId: slugOf("Human"),
    sourceBooks: { [`race:${slugOf("Human")}`]: "PHB" },
    classId: over.classId,
    subclassId: over.subclassId ?? "",
    level: over.level,
    cantripsText: "",
    spellsText: "",
    spellbookText: "",
    int: over.ability ?? 16,
    wis: over.ability ?? 16,
    cha: over.ability ?? 16,
  });

  return spellPlan({
    classId: over.classId,
    className: over.className,
    classSource: over.classSource ?? (rulesVersion === "2024" ? "XPHB" : "PHB"),
    subclassId: over.subclassId ?? "",
    level: over.level,
    rulesVersion,
    snapshot,
  });
};

const options = (found: ReturnType<typeof plan>) =>
  found.spellsByLevel.reduce((total, entry) => total + entry.names.length, 0);

describe("a warlock casts out of pact slots", () => {
  const warlock = (level: number) => plan({ classId: "warlock", className: "Warlock", level });

  test("a warlock may pick levelled spells at all", () => {
    /*
     * Pact magic is kept under its own key — `{ pact: 2 }` is two slots and
     * not a second-level one — so the level is not in the slot map. Read as
     * one it gave `NaN`, which left every warlock at a maximum spell level of
     * zero: cantrips arrived and not one levelled spell, at any level.
     */
    const found = warlock(5);

    expect(found.picker?.spellLimit).toBe(6);
    expect(options(found)).toBeGreaterThan(0);
  });

  test("the ceiling is what the pact slots are worth, not the class level", () => {
    // A level 5 warlock casts at 3rd level; a level 11 warlock at 5th. Neither
    // number is anywhere in the slot map.
    expect(warlock(5).picker?.maxSpellLevel).toBe(3);
    expect(warlock(11).picker?.maxSpellLevel).toBe(5);
  });

  test("cantrips were never the broken half", () => {
    expect(warlock(5).picker?.availableCantripCount).toBe(3);
  });
});

describe("two subclasses are the whole reason their character casts", () => {
  const knight = (level: number, rulesVersion: "2014" | "2024" = "2014") =>
    plan({
      classId: "fighter",
      className: "Fighter",
      subclassId: "eldritch-knight",
      level,
      rulesVersion,
    });

  test("an eldritch knight has a picker at all", () => {
    /*
     * The fighter's progression is "none", which ended the plan before it
     * started. The character had spell slots on the sheet and nowhere to
     * choose a spell — which is worse than having neither.
     */
    const found = knight(7);

    expect(found.caster).toBe(true);
    expect(options(found)).toBeGreaterThan(0);
  });

  test("its counts come off the subclass, because the class has no table", () => {
    // An eldritch knight of 7 knows five spells and two cantrips. Neither
    // number is any row of the fighter's table, because the fighter has none.
    const found = knight(7);

    expect(found.picker?.spellLimit).toBe(5);
    expect(found.picker?.availableCantripCount).toBe(2);
  });

  test("nothing before level 3, which is where the subclass starts casting", () => {
    // The table states it as a run of zeroes rather than as a rule.
    expect(knight(2).picker?.spellLimit).toBe(0);
    expect(knight(3).picker?.spellLimit).toBe(3);
  });

  test("2024 renamed the column and the count survives the rename", () => {
    // "Spells Known" became "Spells Prepared" here as it did everywhere else,
    // and 2024 states it in a table group rather than as a bare array.
    expect(knight(7, "2024").picker?.spellLimit).toBe(5);
  });

  test("an arcane trickster is the same rule on another class", () => {
    const found = plan({
      classId: "rogue",
      className: "Rogue",
      subclassId: "arcane-trickster",
      level: 7,
    });

    expect(found.picker?.spellLimit).toBe(5);
  });

  test("a fighter without the subclass still casts nothing", () => {
    expect(plan({ classId: "fighter", className: "Fighter", level: 7 }).caster).toBe(false);
  });
});

describe("the rest of the casters, each by its own rule", () => {
  test("a 2014 paladin waits until level 2 and a 2024 paladin does not", () => {
    expect(plan({ classId: "paladin", className: "Paladin", level: 1 }).picker?.spellLimit).toBe(0);
    expect(
      plan({ classId: "paladin", className: "Paladin", level: 1, rulesVersion: "2024" }).picker
        ?.spellLimit,
    ).toBe(2);
  });

  test("a 2014 half-caster's count is a formula and rounds down", () => {
    // "Charisma modifier + half your paladin level, rounded down". At 5 with
    // Charisma 16 that is 2 + 3.
    expect(plan({ classId: "paladin", className: "Paladin", level: 5 }).picker?.spellLimit).toBe(5);
  });

  test("the artificer rounds its prepared count down and its slots up", () => {
    // Two different roundings in one class, and both are printed. Level 3
    // with Intelligence 16: one prepared spell from half of 3, plus 3.
    const found = plan({
      classId: "artificer",
      className: "Artificer",
      classSource: "TCE",
      level: 3,
    });

    expect(found.picker?.spellLimit).toBe(4);
    // Slots read the full-caster table at ceil(3 / 2) = 2, which is 3 slots.
    expect(found.picker?.maxSpellLevel).toBe(1);
  });

  test("a 2014 ranger knows nothing at level 1 and two at level 2", () => {
    expect(plan({ classId: "ranger", className: "Ranger", level: 1 }).picker?.spellLimit).toBe(0);
    expect(plan({ classId: "ranger", className: "Ranger", level: 2 }).picker?.spellLimit).toBe(2);
  });

  test("neither half-caster ever gets a cantrip, in either edition", () => {
    for (const rulesVersion of ["2014", "2024"] as const) {
      for (const [classId, className] of [
        ["paladin", "Paladin"],
        ["ranger", "Ranger"],
      ] as const) {
        const found = plan({ classId, className, level: 5, rulesVersion });
        expect(found.picker?.availableCantripCount).toBe(0);
      }
    }
  });

  test("a wizard prepares from a book and everyone else from the class list", () => {
    // The book is empty here, so there is nothing to prepare — which is the
    // rule, and not a bug that looks like one.
    expect(plan({ classId: "wizard", className: "Wizard", level: 3 }).book?.limit).toBe(10);
    expect(plan({ classId: "cleric", className: "Cleric", level: 3 }).book).toBeNull();
  });
});
