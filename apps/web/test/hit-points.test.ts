/**
 * The hit points question the Forge asks.
 *
 * The rule is measured in the domain package. What matters here is that the
 * question is asked about the right levels with the right dice, and that the
 * answer reaches the snapshot — a panel that collects rolls nobody reads is
 * the failure this file exists to catch.
 */

import { describe, expect, it } from "vitest";

import { buildCanonicalSnapshot, initialState, type BuilderState } from "@/lib/builder";
import { hitPointLevelsFor, hitPointsInputFor } from "@/lib/hit-points";

const draft = (over: Partial<BuilderState> = {}): BuilderState => ({
  ...initialState,
  classId: "fighter",
  subclassId: "",
  level: 3,
  extraClasses: [],
  hpMethod: "average",
  hpRolls: {},
  ...over,
});

describe("which levels are asked about", () => {
  it("leaves out the first level, which is the die at maximum", () => {
    const levels = hitPointLevelsFor(draft({ level: 3 }));

    expect(levels.map((row) => row.level)).toEqual([2, 3]);
  });

  it("carries each level's own die, so a multiclass character is asked honestly", () => {
    // A barbarian 1 / wizard 4 rolls four d6s. Asking for four d12s would
    // invite a number the character cannot have.
    const levels = hitPointLevelsFor(
      draft({
        classId: "barbarian",
        level: 1,
        extraClasses: [{ classId: "wizard", subclassId: "", level: 4 }],
      }),
    );

    expect(levels.map((row) => row.die)).toEqual([6, 6, 6, 6]);
    expect(levels.map((row) => row.classId)).toEqual(["wizard", "wizard", "wizard", "wizard"]);
  });

  it("states what the average would be, so the choice is made by looking", () => {
    const [level2] = hitPointLevelsFor(draft({ classId: "fighter", level: 2 }));

    expect(level2?.die).toBe(10);
    expect(level2?.average).toBe(6);
  });

  it("asks nothing of a level 1 character", () => {
    expect(hitPointLevelsFor(draft({ level: 1 }))).toEqual([]);
  });
});

describe("what travels to the rules layer", () => {
  it("sends nothing at all while the table takes the average", () => {
    // Which is what every character made before this field existed did.
    expect(hitPointsInputFor(draft({ hpMethod: "average", hpRolls: { "2": 9 } }))).toBeNull();
  });

  it("sends the rolls indexed from the second level", () => {
    const input = hitPointsInputFor(
      draft({ level: 4, hpMethod: "rolled", hpRolls: { "2": 9, "3": 4, "4": 7 } }),
    );

    expect(input).toEqual({ method: "rolled", rolls: [9, 4, 7] });
  });

  it("keeps a gap as a gap rather than closing it", () => {
    // Dropping the missing level would move level 4's roll onto level 3 and
    // put hit points on the sheet from a die that was never thrown for it.
    const input = hitPointsInputFor(
      draft({ level: 4, hpMethod: "rolled", hpRolls: { "2": 9, "4": 7 } }),
    );

    expect(input).toEqual({ method: "rolled", rolls: [9, null, 7] });
  });

  it("drops a number the level's die cannot produce", () => {
    // A draft is a value the player could have edited by hand.
    const input = hitPointsInputFor(
      draft({
        classId: "wizard",
        level: 2,
        hpMethod: "rolled",
        hpRolls: { "2": 12 },
      }),
    );

    expect(input).toEqual({ method: "rolled", rolls: [null] });
  });
});

describe("the snapshot", () => {
  it("derives the average when nothing was rolled", () => {
    // A d10 fighter of 3 with Constitution 13: 11 + 7 + 7.
    const build = buildCanonicalSnapshot(draft({ con: 13, abilityBonuses: {} }));

    expect(build.derived.hp).toBe(11 + 7 + 7);
  });

  it("derives what the player rolled", () => {
    const build = buildCanonicalSnapshot(
      draft({ con: 13, abilityBonuses: {}, hpMethod: "rolled", hpRolls: { "2": 10, "3": 1 } }),
    );

    expect(build.derived.hp).toBe(11 + 11 + 2);
  });
});
