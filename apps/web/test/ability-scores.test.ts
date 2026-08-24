import { RefResolver, buildToPayload, collections } from "@bertinis-vault/vetools-index";
import { describe, expect, test } from "vitest";

import { buildCanonicalSnapshot, initialState } from "../src/builder";

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
    const snapshot = buildCanonicalSnapshot({
      ...noBonuses,
      featId: "",
      con: 13,
      levelChoices: { 4: { kind: "feat", featId: "resilient", bonuses: { con: 1 } } },
    });

    expect(snapshot.abilities.final.con).toBe(14);
    expect(snapshot.choices.feats).toContain("resilient");
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
