import { RefResolver, buildToPayload, collections } from "@bertinis-vault/vetools-index";
import { describe, expect, test } from "vitest";

import {
  backgroundFeatIdsFor,
  buildCanonicalSnapshot,
  coerceBuilderState,
  initialState,
} from "../src/lib/builder";

import { scoresBefore } from "../src/lib/improvements";

const resolver = new RefResolver("2014", collections);

const noBonuses = { ...initialState, abilityBonuses: {}, levelChoices: {} };

describe("the scores the sheet uses", () => {
  test("carry the species bonus, which used to be dropped", () => {
    const snapshot = buildCanonicalSnapshot({
      ...noBonuses,
      str: 15,
      abilityBonuses: { str: 2, con: 1 },
    });

    expect(snapshot.abilities.base.str).toBe(15);
    expect(snapshot.abilities.final.str).toBe(17);
    expect(snapshot.abilities.final.con).toBe(noBonuses.con + 1);
  });

  test("carry the improvement taken at a level", () => {
    const snapshot = buildCanonicalSnapshot({
      ...noBonuses,
      int: 16,
      levelChoices: { 4: { kind: "improvement", bonuses: { int: 2 } } },
    });

    expect(snapshot.abilities.final.int).toBe(18);
  });

  test("carry a half-feat's bonus, and the feat itself", () => {
    // The raise lives under the feat, not under the level that took it: a
    // background's feat and the variant human's have no level slot to keep it
    // in, and one home is what makes it impossible to count a point twice.
    const snapshot = buildCanonicalSnapshot({
      ...noBonuses,
      featId: "",
      con: 13,
      levelChoices: { 4: { kind: "feat", featId: "resilient" } },
      featAbilityChoices: { resilient: { con: 1 } },
    });

    expect(snapshot.abilities.final.con).toBe(14);
    expect(snapshot.choices.feats).toContain("resilient");
  });

  test("carry a half-feat granted by a background, which has no level to hang on", () => {
    const snapshot = buildCanonicalSnapshot({
      ...noBonuses,
      featId: "resilient",
      con: 13,
      featAbilityChoices: { resilient: { con: 1 } },
    });

    expect(snapshot.abilities.final.con).toBe(14);
  });

  test("a half-feat whose raise was never chosen does not invent one", () => {
    const snapshot = buildCanonicalSnapshot({
      ...noBonuses,
      featId: "resilient",
      con: 13,
    });

    expect(snapshot.abilities.final.con).toBe(13);
  });

  test("a draft written when the raise lived on the level keeps it", () => {
    // Migrated by `coerceBuilderState` rather than dropped. Losing a player's
    // pick because the shape moved would be the same silent loss in reverse.
    const migrated = coerceBuilderState({
      ...noBonuses,
      featId: "",
      con: 13,
      levelChoices: { 4: { kind: "feat", featId: "resilient", bonuses: { con: 1 } } },
    });

    expect(migrated.featAbilityChoices.resilient).toEqual({ con: 1 });
    expect(buildCanonicalSnapshot(migrated).abilities.final.con).toBe(14);
  });

  test("change the numbers the payload carries", () => {
    const plain = buildCanonicalSnapshot({ ...noBonuses, con: 14 });
    const tough = buildCanonicalSnapshot({ ...noBonuses, con: 14, abilityBonuses: { con: 2 } });

    expect(tough.derived.hp).toBeGreaterThan(plain.derived.hp);
  });

  test("change the spell save DC", () => {
    const plain = buildCanonicalSnapshot({ ...noBonuses, classId: "wizard", int: 16 });
    const sharper = buildCanonicalSnapshot({
      ...noBonuses,
      classId: "wizard",
      int: 16,
      levelChoices: { 4: { kind: "improvement", bonuses: { int: 2 } } },
    });

    expect(sharper.derived.spellcasting?.saveDC).toBe((plain.derived.spellcasting?.saveDC ?? 0) + 1);
  });
});

describe("how the scores were generated", () => {
  test("is recorded rather than always claiming they were typed by hand", () => {
    expect(buildCanonicalSnapshot({ ...noBonuses, statMethod: "pointbuy" }).abilities.generationMethod).toBe("point-buy");
    expect(buildCanonicalSnapshot({ ...noBonuses, statMethod: "array" }).abilities.generationMethod).toBe("standard-array");
    expect(buildCanonicalSnapshot({ ...noBonuses, statMethod: "roll" }).abilities.generationMethod).toBe("roll");
    expect(buildCanonicalSnapshot({ ...noBonuses, statMethod: "manual" }).abilities.generationMethod).toBe("manual");
  });
});

describe("saving throws", () => {
  test("reach the payload, which used to export none at all", () => {
    const snapshot = buildCanonicalSnapshot({ ...noBonuses, classId: "wizard" });
    const { payload } = buildToPayload(snapshot, resolver);

    expect(payload?.proficiencies.savingThrows).toEqual(["int", "wis"]);
  });

  test("follow the class", () => {
    const snapshot = buildCanonicalSnapshot({ ...noBonuses, classId: "barbarian" });
    const { payload } = buildToPayload(snapshot, resolver);

    expect(payload?.proficiencies.savingThrows).toEqual(["str", "con"]);
  });
});

describe("the feat a background grants", () => {
  const base = { ...initialState, featId: "", levelChoices: {} };

  test("reaches the payload when the background names it", () => {
    const snapshot = buildCanonicalSnapshot({ ...base, backgroundId: "farmer", rulesVersion: "5e-2024" });

    expect(snapshot.background.grantedFeatIds).toEqual(["tough"]);
  });

  test("waits for an answer when the background offers a choice", () => {
    const undecided = { ...base, backgroundId: "ruined", backgroundFeatId: "" };
    expect(backgroundFeatIdsFor(undecided)).toEqual([]);

    const decided = { ...undecided, backgroundFeatId: "skilled" };
    expect(buildCanonicalSnapshot(decided).background.grantedFeatIds).toEqual(["skilled"]);
  });

  test("the granted feat resolves to a real reference, not just an id", () => {
    const snapshot = buildCanonicalSnapshot({ ...base, backgroundId: "ruined", backgroundFeatId: "tough" });
    const { payload, failures } = buildToPayload(snapshot, resolver);

    expect(failures.filter((failure) => failure.prop === "feat")).toEqual([]);
    expect(payload?.feats.map((entry) => entry.ref.hash)).toContain("tough_phb");
  });

  test("a background that grants nothing grants nothing", () => {
    const snapshot = buildCanonicalSnapshot({ ...base, backgroundId: "sage" });

    expect(snapshot.background.grantedFeatIds).toEqual([]);
  });

  test("the granted feat is not counted again as a chosen one", () => {
    const snapshot = buildCanonicalSnapshot({
      ...base,
      backgroundId: "farmer",
      rulesVersion: "5e-2024",
      featId: "tough",
    });

    expect(snapshot.choices.feats).not.toContain("tough");
    expect(snapshot.background.grantedFeatIds).toEqual(["tough"]);
  });
});

describe("the scores an improvement is applied on top of", () => {
  test("this level's own points are not counted twice", () => {
    // The beta report: a character with an 18 placed one point, was told they
    // had 19, and had the second refused for reaching 20. 18 + 2 = 20 is legal.
    // `before` was shared across every level and included the very points the
    // editor was holding.
    const state = {
      ...noBonuses,
      str: 18,
      level: 4,
      levelChoices: { 4: { kind: "improvement" as const, bonuses: { str: 1 } } },
    };

    expect(scoresBefore(state, 4).str).toBe(18);
    // Without the exception it is the doubled number the player was shown.
    expect(scoresBefore(state).str).toBe(19);
  });

  test("an earlier level's points do count", () => {
    // Level 8 is applied on top of what level 4 already did.
    const state = {
      ...noBonuses,
      str: 14,
      level: 8,
      levelChoices: {
        4: { kind: "improvement" as const, bonuses: { str: 2 } },
        8: { kind: "improvement" as const, bonuses: { str: 1 } },
      },
    };

    expect(scoresBefore(state, 8).str).toBe(16);
  });

  test("a feat's increase raises the floor too", () => {
    // Omitting feats let a stepper push a score past 20: the same cap failing
    // in the other direction.
    const withFeat = {
      ...noBonuses,
      con: 17,
      level: 8,
      levelChoices: { 4: { kind: "feat" as const, featId: "tough" } },
    };

    const plain = { ...noBonuses, con: 17, level: 8, levelChoices: {} };

    expect(scoresBefore(withFeat, 8).con).toBeGreaterThanOrEqual(scoresBefore(plain, 8).con);
  });
});
