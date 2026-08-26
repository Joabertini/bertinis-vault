import { describe, expect, test } from "vitest";

import {
  featCandidateFor,
  featPrerequisiteProblemsFor,
  initialState,
  unmetFeatPrerequisitesFor,
} from "../src/builder";

const base = { ...initialState, abilityBonuses: {}, levelChoices: {} };

const wizard = (over = {}) => ({
  ...base,
  classId: "wizard",
  subclassId: "",
  level: 4,
  extraClasses: [],
  featId: "",
  backgroundFeatId: "",
  ...over,
});

const reasons = (problems: ReturnType<typeof featPrerequisiteProblemsFor>) =>
  problems.filter((problem) => problem.kind === "unmet").flatMap((problem) => problem.reasons);

describe("what the character looks like to a prerequisite", () => {
  test("its scores are the final ones, raises included", () => {
    // A feat is checked against the character who takes it, not the one who
    // was rolled: a half-feat's own +1 is part of the score by then.
    const raised = featCandidateFor(wizard({ abilityBonuses: { int: 2 } })).abilities.int ?? 0;
    const plain = featCandidateFor(wizard()).abilities.int ?? 0;

    expect(raised).toBe(plain + 2);
  });

  test("it knows its classes by name, and whether it casts", () => {
    const candidate = featCandidateFor(wizard());

    expect(candidate.classes).toEqual([{ name: "Wizard", level: 4 }]);
    expect(candidate.casts).toBe(true);
    expect(featCandidateFor(wizard({ classId: "fighter" })).casts).toBe(false);
  });
});

describe("whether a feat is legal for this character", () => {
  test("a wizard is told Heavily Armored needs medium armour proficiency", () => {
    // The failure this replaces: the builder offered it, and it reached the
    // sheet as a feat the character could not legally have.
    const problems = featPrerequisiteProblemsFor(wizard(), "heavily-armored");

    expect(reasons(problems)).toEqual(["competencia con medium"]);
  });

  test("and a character who has that proficiency is not", () => {
    const armored = wizard({ proficienciesText: "Medium\nHeavy" });

    expect(featPrerequisiteProblemsFor(armored, "heavily-armored")).toEqual([]);
  });

  test("a caster passes Elemental Adept and a barbarian does not", () => {
    expect(featPrerequisiteProblemsFor(wizard(), "elemental-adept")).toEqual([]);
    expect(reasons(featPrerequisiteProblemsFor(wizard({ classId: "barbarian" }), "elemental-adept"))).toEqual([
      "lanzar conjuros",
    ]);
  });

  test("a feat with no prerequisite is open to anyone", () => {
    // Alert asks nothing in 2014, and nothing should be reported for it.
    expect(featPrerequisiteProblemsFor(wizard(), "alert")).toEqual([]);
  });

  test("an ability minimum reads the character's own score", () => {
    // Bountiful Luck wants a halfling; Actor wants Charisma 13.
    const charming = wizard({ rulesVersion: "5e-2024" as const, abilityBonuses: { cha: 6 } });

    expect(featPrerequisiteProblemsFor(charming, "actor")).toEqual([]);
    expect(reasons(featPrerequisiteProblemsFor(wizard({ rulesVersion: "5e-2024" as const }), "actor"))).toContain(
      "CHA 13",
    );
  });

  test("a species requirement is checked against the species", () => {
    expect(reasons(featPrerequisiteProblemsFor(wizard({ raceId: "human" }), "bountiful-luck"))).toEqual([
      "halfling",
    ]);
    expect(featPrerequisiteProblemsFor(wizard({ raceId: "halfling" }), "bountiful-luck")).toEqual([]);
  });

  test("what a build cannot answer is shown as the table's call, not as a failure", () => {
    const problems = featPrerequisiteProblemsFor(wizard(), "aberrant-dragonmark");

    expect(problems).toEqual([{ kind: "unverifiable", notes: ["No other dragonmark"] }]);
    expect(reasons(problems)).toEqual([]);
  });

  test("an empty feat id asks nothing", () => {
    expect(featPrerequisiteProblemsFor(wizard(), "")).toEqual([]);
  });
});

describe("the feats a character has already taken", () => {
  test("an illegal one is reported rather than removed", () => {
    // Reported, never enforced. A table may allow anything, and a builder that
    // refuses is a builder people work around.
    const armored = wizard({ featId: "heavily-armored" });
    const unmet = unmetFeatPrerequisitesFor(armored);

    expect(unmet.map((entry) => entry.featId)).toEqual(["heavily-armored"]);
    expect(armored.featId).toBe("heavily-armored");
  });

  test("a legal one is not reported", () => {
    expect(unmetFeatPrerequisitesFor(wizard({ featId: "elemental-adept" }))).toEqual([]);
  });

  test("a character with no feats has nothing to report", () => {
    expect(unmetFeatPrerequisitesFor(wizard())).toEqual([]);
  });
});
