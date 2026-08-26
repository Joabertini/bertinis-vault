import { describe, expect, test } from "vitest";

import {
  buildCanonicalSnapshot,
  characterLevelFor,
  classesFor,
  coerceBuilderState,
  initialState,
} from "../src/builder";

const base = { ...initialState, abilityBonuses: {}, levelChoices: {} };

describe("a character made of more than one class", () => {
  test("the first class is not an entry in the list, and is still first", () => {
    // It keeps its own fields because the rules single it out: it alone grants
    // saving throws and starting equipment, and its die arrives at maximum.
    const state = {
      ...base,
      classId: "fighter",
      subclassId: "",
      level: 5,
      extraClasses: [{ classId: "wizard", subclassId: "", level: 2 }],
    };

    expect(classesFor(state).map((entry) => entry.classId)).toEqual(["fighter", "wizard"]);
    expect(characterLevelFor(state)).toBe(7);
  });

  test("a half-filled row is not a class the character has", () => {
    const state = {
      ...base,
      extraClasses: [
        { classId: "", subclassId: "", level: 1 },
        { classId: "wizard", subclassId: "", level: 0 },
      ],
    };

    expect(classesFor(state)).toHaveLength(1);
    expect(characterLevelFor(state)).toBe(base.level);
  });

  test("every class reaches the build, with the numbers the rules need", () => {
    const snapshot = buildCanonicalSnapshot({
      ...base,
      classId: "wizard",
      subclassId: "",
      level: 3,
      extraClasses: [{ classId: "cleric", subclassId: "", level: 2 }],
    });

    expect(snapshot.classing.classes).toHaveLength(2);
    expect(snapshot.classing.classes[0]?.classId).toBe("wizard");
    expect(snapshot.classing.classes[0]?.casterProgression).toBe("full");
    expect(snapshot.classing.classes[1]?.classId).toBe("cleric");
    expect(snapshot.classing.classes[1]?.casterProgression).toBe("full");
    expect(snapshot.classing.classes[1]?.hitDie).toBe(8);
  });

  test("the slots come from the combined caster level", () => {
    // A wizard 3 / cleric 2 is caster level 5. As a wizard 3 alone it was two
    // slots short and a whole spell level missing.
    const snapshot = buildCanonicalSnapshot({
      ...base,
      classId: "wizard",
      subclassId: "",
      level: 3,
      extraClasses: [{ classId: "cleric", subclassId: "", level: 2 }],
    });

    expect(snapshot.derived.spellcasting?.slots).toEqual({ 1: 4, 2: 3, 3: 2 });
  });

  test("a third-caster subclass carries its own progression", () => {
    // The fighter casts nothing. Reading only the class makes this build
    // caster level 1 instead of 5.
    const snapshot = buildCanonicalSnapshot({
      ...base,
      classId: "fighter",
      subclassId: "eldritch-knight",
      level: 12,
      extraClasses: [{ classId: "wizard", subclassId: "", level: 1 }],
    });

    expect(snapshot.classing.classes[0]?.subclassCasterProgression).toBe("1/3");
    expect(snapshot.derived.spellcasting?.slots).toEqual({ 1: 4, 2: 3, 3: 2 });
  });

  test("a single class build is untouched by any of this", () => {
    // The guard. Nothing about a one-class character may move.
    const before = buildCanonicalSnapshot({ ...base, extraClasses: [] });
    const after = buildCanonicalSnapshot({ ...base });

    expect(after.classing.classes).toHaveLength(1);
    expect(after.derived).toEqual(before.derived);
  });

  test("a draft saved before multiclassing existed simply has one class", () => {
    const restored = coerceBuilderState({ classId: "rogue", level: 4 });

    expect(restored.extraClasses).toEqual([]);
    expect(characterLevelFor(restored)).toBe(4);
  });

  test("junk in a hand-edited draft loses the junk, not the build", () => {
    const restored = coerceBuilderState({
      extraClasses: [
        { classId: "wizard", level: 99 },
        { classId: "", level: 3 },
        "nonsense",
        { level: 2 },
      ],
    });

    expect(restored.extraClasses).toEqual([{ classId: "wizard", subclassId: "", level: 20 }]);
  });
});
