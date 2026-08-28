import { describe, expect, test } from "vitest";

import { spellPlan } from "../src/lib/spells";
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
