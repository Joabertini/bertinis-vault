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

  test("a domain adds to the class list rather than replacing it", () => {
    const plain = pool();
    const light = pool({ subclassId: "light-domain" });

    // Every cleric spell is still there, and the domain's are on top.
    expect(light.length).toBeGreaterThan(plain.length);
    for (const name of names(plain)) expect(names(light)).toContain(name);
  });

  test("a domain whose whole list is already the class's changes the count by nothing", () => {
    // The Life domain grants bless, cure wounds, revivify and the rest —
    // every one of them already a cleric spell. Growing the pool here would
    // mean something had been double-counted.
    expect(pool({ subclassId: "life-domain" }).length).toBe(pool().length);
  });

  test("a domain spell that is not on the class list arrives with the domain", () => {
    // Spiritual Weapon is a cleric spell, so it proves nothing. Divine
    // Favour, on the Light domain's list, is a paladin spell.
    const plain = names(pool());
    const light = names(pool({ subclassId: "light-domain" }));

    for (const name of ["Burning Hands", "Scorching Ray"]) {
      expect(plain).not.toContain(name);
      expect(light).toContain(name);
    }
  });

  test("a domain's later spells wait for the level that grants them", () => {
    const early = names(pool({ subclassId: "light-domain", classLevel: 1 }));
    const later = names(pool({ subclassId: "light-domain", classLevel: 5 }));

    expect(early).not.toContain("Fireball");
    expect(later).toContain("Fireball");
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
