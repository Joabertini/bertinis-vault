/**
 * Max hit points: the whole die at every level (D1, plan de reseñas 2026-11).
 *
 * The third method beside average and rolled. Measured on the case the plan
 * names: a fighter 5 with Constitution +2 takes 10 at every level, plus 2 each.
 */

import { describe, expect, it } from "vitest";

import { hitPointsFor } from "@bertinis-vault/domain";
import { buildCanonicalSnapshot, coerceBuilderState, initialState, type BuilderState } from "@/lib/builder";
import { readFoundryActor } from "@/lib/foundry-import";
import { hitPointsInputFor } from "@/lib/hit-points";

const draft = (over: Partial<BuilderState> = {}): BuilderState => ({
  ...initialState,
  classId: "fighter",
  subclassId: "",
  level: 5,
  extraClasses: [],
  hpMethod: "max",
  hpRolls: {},
  ...over,
});

describe("vida maxima", () => {
  it("gives a fighter 5 with Constitution +2 the whole die at every level", () => {
    expect(hitPointsFor({ dice: [10, 10, 10, 10, 10], constitutionModifier: 2, method: "max" })).toBe(10 + 4 * 10 + 5 * 2);
  });

  it("uses each level's own die when the character multiclasses", () => {
    // Fighter 1 (d10), wizard 2 (d6), Constitution +1.
    expect(hitPointsFor({ dice: [10, 6, 6], constitutionModifier: 1, method: "max" })).toBe(10 + 6 + 6 + 3);
  });

  it("ignores rolls left over from when the player was rolling", () => {
    expect(hitPointsFor({ dice: [10, 10], constitutionModifier: 0, method: "max", rolls: [3] })).toBe(20);
  });

  it("travels to the build as the rule, with nothing to ask the player", () => {
    expect(hitPointsInputFor(draft({ hpRolls: { "2": 4 } }))).toEqual({ method: "max", rolls: [] });
  });

  it("reaches the sheet", () => {
    const max = buildCanonicalSnapshot(draft());
    const average = buildCanonicalSnapshot(draft({ hpMethod: "average" }));
    expect(max.hitPoints?.method).toBe("max");
    // Four levels after the first, each a d10: 10 instead of the printed 6.
    expect(max.derived.hp - average.derived.hp).toBe(4 * (10 - 6));
  });

  it("survives a save and a reload", () => {
    expect(coerceBuilderState({ ...draft(), hpMethod: "max" }).hpMethod).toBe("max");
    expect(coerceBuilderState({ ...draft(), hpMethod: "whatever" }).hpMethod).toBe("average");
  });

  it("is read back from a Foundry actor whose levels are all at max", () => {
    const actor = {
      type: "character",
      name: "Siempre al maximo",
      items: [
        {
          type: "class",
          name: "Fighter",
          system: {
            identifier: "fighter",
            levels: 3,
            hd: { denomination: "d10" },
            advancement: [{ type: "HitPoints", value: { "1": "max", "2": "max", "3": "max" } }],
          },
        },
      ],
      system: { abilities: {}, details: {} },
    };
    const read = readFoundryActor(actor)!;
    expect(read.state.hpMethod).toBe("max");
    expect(read.state.hpRolls).toEqual({});
  });
});
