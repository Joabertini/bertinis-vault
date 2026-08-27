import { describe, expect, test } from "vitest";

import { spellCountsFor } from "../src/lib/index-options";

const counts = (classId: string, level: number, rulesVersion: "2014" | "2024", abilityModifier = 0) =>
  spellCountsFor({ classId, level, rulesVersion, abilityModifier });

describe("how many spells a caster gets", () => {
  test("a 2024 bard prepares more than a 2014 bard knows", () => {
    // The hand-written switch this replaces served both editions from the 2014
    // numbers, so a 2024 bard was one spell short from level 5 upward.
    expect(counts("bard", 5, "2014")?.spells).toBe(8);
    expect(counts("bard", 5, "2024")?.spells).toBe(9);
  });

  test("a 2014 cleric's count depends on its Wisdom, and a 2024 cleric's does not", () => {
    // 2014 states a formula because a table cannot know a modifier. 2024
    // replaced the formula with a column, so the score stops mattering.
    expect(counts("cleric", 5, "2014", 3)?.spells).toBe(8);
    expect(counts("cleric", 5, "2014", 0)?.spells).toBe(5);

    expect(counts("cleric", 5, "2024", 3)?.spells).toEqual(counts("cleric", 5, "2024", 0)?.spells);
  });

  test("2024 moved the paladin's magic to level 1", () => {
    expect(counts("paladin", 1, "2014", 3)?.spells).toBe(0);
    expect(counts("paladin", 1, "2024")?.spells).toBe(2);
  });

  test("the ranger moved with it", () => {
    expect(counts("ranger", 1, "2014")?.spells).toBe(0);
    expect(counts("ranger", 1, "2024")?.spells).toBeGreaterThan(0);
  });

  test("a paladin has no cantrips in either edition", () => {
    expect(counts("paladin", 20, "2014")?.cantrips).toBe(0);
    expect(counts("paladin", 20, "2024")?.cantrips).toBe(0);
  });

  test("cantrips come off the table and grow at the levels the books say", () => {
    expect(counts("wizard", 3, "2014")?.cantrips).toBe(3);
    expect(counts("wizard", 4, "2014")?.cantrips).toBe(4);
    expect(counts("wizard", 10, "2014")?.cantrips).toBe(5);
  });

  test("a non-caster counts nothing", () => {
    expect(counts("fighter", 20, "2024")).toEqual({ cantrips: 0, spells: 0 });
  });

  test("a class the index has never heard of returns null rather than zero", () => {
    // Null lets the caller fall back. Zero would be a claim that this caster
    // knows no spells, which is a different and wrong thing to say.
    expect(counts("not-a-class", 5, "2014")).toBeNull();
  });
});
