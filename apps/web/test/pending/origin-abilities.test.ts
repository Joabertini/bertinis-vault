import { describe, expect, test } from "vitest";

import {
  buildCanonicalSnapshot,
  coerceBuilderState,
  initialState,
  originAbilityBonusesFor,
  originAbilityChoiceForBuild,
  pendingOriginAbilitiesFor,
} from "../src/lib/builder";

const base = { ...initialState, abilityBonuses: {}, levelChoices: {} };

const modern = {
  ...base,
  rulesVersion: "5e-2024" as const,
  raceId: "human",
  backgroundId: "acolyte",
  sourceBooks: { background: "XPHB", race: "XPHB" },
};

describe("where the level-one ability increase comes from", () => {
  test("a 2024 background offers it", () => {
    expect(originAbilityChoiceForBuild(modern)).toEqual([
      { options: ["int", "wis", "cha"], amounts: [2, 1] },
      { options: ["int", "wis", "cha"], amounts: [1, 1, 1] },
    ]);
  });

  test("a 2014 background offers nothing, because the species carries it", () => {
    expect(originAbilityChoiceForBuild({ ...base, backgroundId: "acolyte" })).toBeNull();
    expect(pendingOriginAbilitiesFor({ ...base, backgroundId: "acolyte" })).toBe(0);
  });

  test("an unanswered 2024 increase is reported rather than assumed", () => {
    // The failure this replaces is silent: a 16 where the rules say 18 looks
    // like a perfectly ordinary score.
    expect(pendingOriginAbilitiesFor(modern)).toBe(2);
    expect(originAbilityBonusesFor(modern)).toEqual({});
  });

  test("answering it raises the abilities named, in the order named", () => {
    const wise = { ...modern, originAbilityChoice: { optionIndex: 0, abilities: ["wis", "cha"] } };

    expect(originAbilityBonusesFor(wise)).toEqual({ wis: 2, cha: 1 });
    expect(pendingOriginAbilitiesFor(wise)).toBe(0);
  });

  test("the spread alternative raises all three by one", () => {
    const spread = {
      ...modern,
      originAbilityChoice: { optionIndex: 1, abilities: ["int", "wis", "cha"] },
    };

    expect(originAbilityBonusesFor(spread)).toEqual({ int: 1, wis: 1, cha: 1 });
  });
});

describe("what reaches the exported character", () => {
  test("the increase lands on the final scores, not only on the draft", () => {
    // Everything downstream reads `final`: hit points, armour class, the spell
    // save DC. An increase that stopped at the draft would show on the wizard
    // and nowhere else.
    const before = buildCanonicalSnapshot(modern);
    const after = buildCanonicalSnapshot({
      ...modern,
      originAbilityChoice: { optionIndex: 0, abilities: ["wis", "cha"] },
    });

    expect(after.abilities.final.wis).toBe(before.abilities.final.wis + 2);
    expect(after.abilities.final.cha).toBe(before.abilities.final.cha + 1);
    expect(after.abilities.base).toEqual(before.abilities.base);
  });

  test("a 2014 build is untouched by an answer it should never have", () => {
    // A character switched from 2024 back to 2014 keeps the stored answer, and
    // it must stop counting: 2014 grants the increase through the species.
    const legacy = {
      ...base,
      backgroundId: "acolyte",
      originAbilityChoice: { optionIndex: 0, abilities: ["wis", "cha"] },
    };

    expect(originAbilityBonusesFor(legacy)).toEqual({});
    expect(buildCanonicalSnapshot(legacy).abilities.final.wis).toBe(
      buildCanonicalSnapshot({ ...base, backgroundId: "acolyte" }).abilities.final.wis,
    );
  });

  test("the manual species bonus still applies on top", () => {
    // `abilityBonuses` is the species field and stays what it was. The two are
    // different rules and a character can legitimately have both in 2014.
    const both = {
      ...modern,
      abilityBonuses: { con: 2 },
      originAbilityChoice: { optionIndex: 0, abilities: ["wis", "cha"] },
    };
    const snapshot = buildCanonicalSnapshot(both);

    expect(snapshot.abilities.final.con).toBe(snapshot.abilities.base.con + 2);
    expect(snapshot.abilities.final.wis).toBe(snapshot.abilities.base.wis + 2);
  });
});

describe("drafts saved before the rule was read", () => {
  test("open with no answer rather than failing", () => {
    expect(coerceBuilderState({ ...base, originAbilityChoice: undefined }).originAbilityChoice).toBeNull();
  });

  test("keep a real answer and drop what is not one", () => {
    expect(
      coerceBuilderState({ ...base, originAbilityChoice: { optionIndex: 1, abilities: ["wis", 7, "cha"] } })
        .originAbilityChoice,
    ).toEqual({ optionIndex: 1, abilities: ["wis", "cha"] });

    expect(
      coerceBuilderState({ ...base, originAbilityChoice: { optionIndex: "first" } }).originAbilityChoice,
    ).toBeNull();
  });
});
