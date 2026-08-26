import test from "node:test";
import assert from "node:assert/strict";

import { featPrerequisiteProblems, meetsFeatPrerequisites } from "../dist/index.js";

const character = (over = {}) => ({
  abilities: { str: 10, dex: 14, con: 12, int: 16, wis: 10, cha: 8 },
  level: 4,
  classes: [{ name: "Wizard", level: 4 }],
  raceName: "Human",
  backgroundName: "Sage",
  featNames: [],
  featureNames: ["Arcane Recovery"],
  armorProficiencies: [],
  weaponProficiencies: ["simple"],
  casts: true,
  ...over,
});

const reasons = (problems) =>
  problems.filter((problem) => problem.kind === "unmet").flatMap((problem) => problem.reasons);

test("a feat that states nothing is open to anyone", () => {
  assert.deepEqual(featPrerequisiteProblems([], character()), []);
  assert.deepEqual(featPrerequisiteProblems(null, character()), []);
  assert.equal(meetsFeatPrerequisites(undefined, character()), true);
});

test("an ability minimum is checked against the character's own scores", () => {
  // Actor wants Charisma 13. This wizard has 8.
  const actor = [{ abilities: [{ cha: 13 }], level: 4 }];

  assert.deepEqual(reasons(featPrerequisiteProblems(actor, character())), ["CHA 13"]);
  assert.equal(meetsFeatPrerequisites(actor, character({ abilities: { cha: 13 } })), true);
});

test("\"Intelligence or Wisdom\" is satisfied by either", () => {
  const either = [{ abilities: [{ int: 13 }, { wis: 13 }] }];

  assert.equal(meetsFeatPrerequisites(either, character()), true);
  assert.equal(meetsFeatPrerequisites(either, character({ abilities: { wis: 15 } })), true);
  assert.equal(meetsFeatPrerequisites(either, character({ abilities: { cha: 20 } })), false);
});

test("a level in a named class is not the character's level", () => {
  // Without this, a level 3 wizard passes a requirement that wants a fighter.
  const fighterOne = [{ classLevel: { className: "Fighter", level: 1 } }];

  assert.deepEqual(reasons(featPrerequisiteProblems(fighterOne, character())), ["Fighter nivel 1"]);
  assert.equal(
    meetsFeatPrerequisites(
      fighterOne,
      character({ classes: [{ name: "Wizard", level: 3 }, { name: "Fighter", level: 1 }] }),
    ),
    true,
  );
});

test("armour proficiency is checked, which is the whole point of the armour feats", () => {
  // Heavily Armored wants proficiency with medium armour. A wizard has none,
  // and the builder used to offer it anyway.
  const heavilyArmored = [{ proficiencies: [{ kind: "armor", value: "medium" }] }];

  assert.deepEqual(
    reasons(featPrerequisiteProblems(heavilyArmored, character())),
    ["competencia con medium"],
  );
  assert.equal(
    meetsFeatPrerequisites(heavilyArmored, character({ armorProficiencies: ["light", "medium"] })),
    true,
  );
});

test("a spellcasting requirement is checked against whether the character casts", () => {
  const elementalAdept = [{ spellcasting: true }];

  assert.equal(meetsFeatPrerequisites(elementalAdept, character()), true);
  assert.deepEqual(
    reasons(featPrerequisiteProblems(elementalAdept, character({ casts: false }))),
    ["lanzar conjuros"],
  );
});

test("a species requirement matches the species, and a subrace narrows it", () => {
  const halfling = [{ races: [{ name: "halfling" }] }];
  const drow = [{ races: [{ name: "elf", subrace: "drow" }] }];

  assert.equal(meetsFeatPrerequisites(halfling, character({ raceName: "Halfling" })), true);
  assert.equal(meetsFeatPrerequisites(halfling, character()), false);

  assert.equal(
    meetsFeatPrerequisites(drow, character({ raceName: "Elf", subraceName: "Drow" })),
    true,
  );
  assert.equal(
    meetsFeatPrerequisites(drow, character({ raceName: "Elf", subraceName: "High" })),
    false,
  );
});

test("a feature is matched loosely, because the build stores it as free text", () => {
  // "Fighting Style: Archery" is the Fighting Style feature.
  const needsStyle = [{ features: ["Fighting Style"] }];

  assert.equal(
    meetsFeatPrerequisites(needsStyle, character({ featureNames: ["Fighting Style: Archery"] })),
    true,
  );
  assert.equal(meetsFeatPrerequisites(needsStyle, character()), false);
});

test("a feat that requires another feat looks for it by name", () => {
  const chain = [{ feats: ["initiate of high sorcery"] }];

  assert.equal(
    meetsFeatPrerequisites(chain, character({ featNames: ["Initiate of High Sorcery"] })),
    true,
  );
  assert.equal(meetsFeatPrerequisites(chain, character()), false);
});

test("any one alternative holding is enough", () => {
  const either = [{ races: [{ name: "dwarf" }] }, { abilities: [{ int: 13 }] }];

  assert.deepEqual(featPrerequisiteProblems(either, character()), []);
});

test("the alternative closest to holding is the one reported", () => {
  // Telling a player they are missing five things when they are one away from
  // a legal path is worse than saying nothing.
  const problems = featPrerequisiteProblems(
    [
      { abilities: [{ cha: 13 }], level: 20, races: [{ name: "dwarf" }] },
      { abilities: [{ cha: 13 }] },
    ],
    character(),
  );

  assert.deepEqual(reasons(problems), ["CHA 13"]);
});

test("what a build cannot answer is reported as unchecked, not as met", () => {
  // "No other dragonmark" is a table's business. A silent pass would be a
  // claim this module has no standing to make.
  const problems = featPrerequisiteProblems([{ other: ["No other dragonmark"] }], character());

  assert.deepEqual(problems, [{ kind: "unverifiable", notes: ["No other dragonmark"] }]);
  // It is not an "unmet" problem, so it does not make the feat illegal.
  assert.equal(meetsFeatPrerequisites([{ other: ["No other dragonmark"] }], character()), true);
});

test("an unverifiable note travels beside a real failure rather than replacing it", () => {
  const problems = featPrerequisiteProblems(
    [{ abilities: [{ cha: 13 }], other: ["Campaign: Ravenloft"] }],
    character(),
  );

  assert.deepEqual(problems, [
    { kind: "unmet", reasons: ["CHA 13"] },
    { kind: "unverifiable", notes: ["Campaign: Ravenloft"] },
  ]);
});

test("everything in one alternative must hold at once", () => {
  // Actor is Charisma 13 *and* level 4 in 2024, not either.
  const actor = [{ abilities: [{ cha: 13 }], level: 4 }];
  const low = character({ abilities: { cha: 20 }, level: 1 });

  assert.deepEqual(reasons(featPrerequisiteProblems(actor, low)), ["nivel 4"]);
});
