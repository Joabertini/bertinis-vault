import { describe, expect, test } from "vitest";

import { spellOptionsForClass, spellPoolFor } from "../src/lib/index-options";

const pool = (over: Partial<Parameters<typeof spellPoolFor>[0]> = {}) =>
  spellPoolFor({
    className: "Cleric",
    classSource: "PHB",
    classId: "cleric",
    subclassId: "",
    classLevel: 5,
    pactSlotLevel: 0,
    rulesVersion: "2014",
    maxLevel: 9,
    ...over,
  });

const names = (rows: { name: string }[]) => rows.map((row) => row.name);

describe("the spells a character may take", () => {
  test("an Eldritch Knight had none at all, and now has the wizard's", () => {
    // Neither the fighter nor the rogue appears on a single spell's class
    // list, so the class list alone leaves the picker empty. The subclass is
    // the only place that says the list is the wizard's.
    expect(spellOptionsForClass("Fighter", "PHB", "2014", 9)).toEqual([]);

    const knight = pool({
      className: "Fighter",
      classSource: "PHB",
      classId: "fighter",
      subclassId: "eldritch-knight",
      classLevel: 3,
    });

    expect(knight.length).toBeGreaterThan(50);
    expect(names(knight)).toContain("Shield");
    expect(names(knight)).toContain("Mage Hand");
  });

  test("and only up to the spell level the subclass has reached", () => {
    // The Eldritch Knight's filter opens level by level: cantrips and first
    // level at 3, second at 7. A level 3 knight has no second-level spells.
    const early = pool({
      className: "Fighter",
      classSource: "PHB",
      classId: "fighter",
      subclassId: "eldritch-knight",
      classLevel: 3,
    });

    expect(early.some((row) => row.level >= 2)).toBe(false);

    const later = pool({
      className: "Fighter",
      classSource: "PHB",
      classId: "fighter",
      subclassId: "eldritch-knight",
      classLevel: 7,
    });

    expect(later.some((row) => row.level === 2)).toBe(true);
  });

  test("a domain does not enlarge the list the cleric prepares from", () => {
    /*
     * It used to, and that was the double charge: a Light Domain cleric has
     * Burning Hands *always prepared*, and offering it in the picker as well
     * spent one of the day's preparations on a spell the domain hands over
     * free. The domain's spells are granted now — `grantedSpellsFor` — and the
     * pool is the class list plus what a subclass genuinely *offers*.
     */
    expect(pool({ subclassId: "light-domain" }).length).toBe(pool().length);
    expect(pool({ subclassId: "life-domain" }).length).toBe(pool().length);
  });

  test("a warlock's expanded list is an offer, and does enlarge it", () => {
    // The other rule, and it really is an offer: an Archfey warlock *may*
    // learn Faerie Fire, and nothing says they have.
    const plain = pool({
      className: "Warlock",
      classSource: "PHB",
      classId: "warlock",
      classLevel: 3,
      pactSlotLevel: 2,
    });
    const archfey = pool({
      className: "Warlock",
      classSource: "PHB",
      classId: "warlock",
      subclassId: "the-archfey",
      classLevel: 3,
      pactSlotLevel: 2,
    });

    expect(archfey.length).toBeGreaterThan(plain.length);
    expect(names(archfey)).toContain("Faerie Fire");
    for (const name of names(plain)) expect(names(archfey)).toContain(name);
  });

  test("a warlock patron waits on the pact slot level, not the class level", () => {
    // The patrons key their list by spell level. A level 3 warlock's slots are
    // second-level, so their third-level patron spells have not arrived.
    const shallow = names(
      pool({
        className: "Warlock",
        classSource: "PHB",
        classId: "warlock",
        subclassId: "the-archfey",
        classLevel: 3,
        pactSlotLevel: 2,
      }),
    );
    const deep = names(
      pool({
        className: "Warlock",
        classSource: "PHB",
        classId: "warlock",
        subclassId: "the-archfey",
        classLevel: 5,
        pactSlotLevel: 3,
      }),
    );

    expect(shallow).toContain("Calm Emotions");
    expect(shallow).not.toContain("Plant Growth");
    expect(deep).toContain("Plant Growth");
  });

  test("a subclass that adds nothing changes nothing", () => {
    expect(pool({ subclassId: "life-domain" }).length).toBeGreaterThan(0);
    expect(names(pool({ subclassId: "" }))).toEqual(names(pool()));
  });

  test("a class with no name has no spells rather than every spell", () => {
    expect(pool({ className: "", classId: "" })).toEqual([]);
  });

  test("the pool stops at the level asked for", () => {
    const capped = pool({ maxLevel: 2 });

    expect(capped.length).toBeGreaterThan(0);
    for (const row of capped) expect(row.level).toBeLessThanOrEqual(2);
  });
});
