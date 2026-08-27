import { describe, expect, test } from "vitest";

import {
  coerceBuilderState,
  initialState,
  masteryIsMeleeOnlyFor,
  masteryOptionsFor,
  masteryProblemsFor,
  weaponMasterySlotsFor,
} from "../src/lib/builder";

const base = { ...initialState, abilityBonuses: {}, levelChoices: {} };

const modern = (over = {}) => ({
  ...base,
  rulesVersion: "5e-2024" as const,
  classId: "fighter",
  subclassId: "",
  level: 1,
  extraClasses: [],
  weaponMasteryIds: [],
  ...over,
});

describe("how many weapons a character may master", () => {
  test("a 2024 fighter starts with three and reaches six", () => {
    expect(weaponMasterySlotsFor(modern())).toBe(3);
    expect(weaponMasterySlotsFor(modern({ level: 4 }))).toBe(4);
    expect(weaponMasterySlotsFor(modern({ level: 16 }))).toBe(6);
  });

  test("a 2014 fighter masters nothing, because the rule does not exist", () => {
    expect(weaponMasterySlotsFor({ ...base, classId: "fighter", level: 20 })).toBe(0);
    expect(masteryOptionsFor({ ...base, classId: "fighter", level: 20 })).toEqual([]);
  });

  test("a 2024 class that never learns it grants none", () => {
    expect(weaponMasterySlotsFor(modern({ classId: "wizard" }))).toBe(0);
  });

  test("two classes do not stack, and each reads its own table", () => {
    // A fighter 3 / rogue 2 is fifth level. The fighter's table at 3 says
    // three; reading it at 5 would say four, and summing would say five.
    const split = modern({
      classId: "fighter",
      level: 3,
      extraClasses: [{ classId: "rogue", subclassId: "", level: 2 }],
    });

    expect(weaponMasterySlotsFor(split)).toBe(3);
  });
});

describe("which weapons are on offer", () => {
  test("only weapons that carry a mastery property", () => {
    const options = masteryOptionsFor(modern());

    expect(options.length).toBeGreaterThan(80);
    for (const option of options) expect(option.property).not.toBe("");
  });

  test("a barbarian is held to melee weapons and a fighter is not", () => {
    const barbarian = modern({ classId: "barbarian" });

    expect(masteryIsMeleeOnlyFor(barbarian)).toBe(true);
    expect(masteryOptionsFor(barbarian).some((option) => option.id === "longbow")).toBe(false);
    expect(masteryOptionsFor(modern()).some((option) => option.id === "longbow")).toBe(true);
  });

  test("a barbarian/fighter may master a bow, because the fighter says so", () => {
    const both = modern({
      classId: "barbarian",
      level: 5,
      extraClasses: [{ classId: "fighter", subclassId: "", level: 1 }],
    });

    expect(masteryIsMeleeOnlyFor(both)).toBe(false);
    expect(masteryOptionsFor(both).some((option) => option.id === "longbow")).toBe(true);
  });

  test("a thrown dagger is a melee weapon and a rifle is not", () => {
    // The item type says which; the properties do not. The antimatter rifle
    // has no Ammunition property and is plainly not a melee weapon.
    const melee = masteryOptionsFor(modern({ classId: "barbarian" })).map((option) => option.id);

    expect(melee).toContain("dagger");
    expect(melee).not.toContain("antimatter-rifle");
  });
});

describe("what is wrong with the picks", () => {
  test("nothing, when there are fewer than allowed", () => {
    expect(masteryProblemsFor(modern({ weaponMasteryIds: ["greatsword", "longsword"] }))).toEqual([]);
  });

  test("picking a fourth at level one is reported with both numbers", () => {
    const problems = masteryProblemsFor(
      modern({ weaponMasteryIds: ["greatsword", "longsword", "dagger", "battleaxe"] }),
    );

    expect(problems).toEqual([{ kind: "over-limit", picked: 4, allowed: 3 }]);
  });

  test("a weapon with no mastery property is named rather than dropped", () => {
    const problems = masteryProblemsFor(modern({ weaponMasteryIds: ["net"] }));

    expect(problems).toEqual([{ kind: "no-property", itemId: "net" }]);
  });
});

describe("drafts saved before mastery was read", () => {
  test("open with no picks rather than failing", () => {
    expect(coerceBuilderState({ ...base, weaponMasteryIds: undefined }).weaponMasteryIds).toEqual([]);
  });

  test("keep real picks and drop what is not one", () => {
    expect(
      coerceBuilderState({ ...base, weaponMasteryIds: ["dagger", 7, "", "longsword"] }).weaponMasteryIds,
    ).toEqual(["dagger", "longsword"]);
  });
});
