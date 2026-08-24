import test from "node:test";
import assert from "node:assert/strict";

import {
  bonusesFromChoices,
  featsFromChoices,
  improvementLevels,
  improvementProblems,
  levelDecisions,
  pointsSpent,
  unansweredImprovementLevels,
} from "../dist/index.js";

const wizard2014 = { improvementLevels: [4, 8, 12, 16, 19], subclassLevel: 2 };
const fighter2014 = { improvementLevels: [4, 6, 8, 12, 14, 16, 19], subclassLevel: 3 };
const wizard2024 = { improvementLevels: [4, 8, 12, 16], subclassLevel: 3 };

test("a level 1 character has made no decision yet", () => {
  assert.deepEqual(levelDecisions(wizard2014, 1), []);
});

test("the subclass appears at the level its class unlocks it, not at 3", () => {
  // The 2014 wizard chooses at 2; assuming 3 would hide the choice from every
  // level 2 wizard the builder made.
  assert.deepEqual(levelDecisions(wizard2014, 2), [{ level: 2, kind: "subclass" }]);
  assert.deepEqual(levelDecisions(fighter2014, 2), []);
});

test("a fighter reaches more improvements than a wizard at the same level", () => {
  assert.deepEqual(improvementLevels(wizard2014, 14), [4, 8, 12]);
  assert.deepEqual(improvementLevels(fighter2014, 14), [4, 6, 8, 12, 14]);
});

test("2024 has no level 19 improvement", () => {
  assert.deepEqual(improvementLevels(wizard2024, 20), [4, 8, 12, 16]);
  assert.deepEqual(improvementLevels(wizard2014, 20), [4, 8, 12, 16, 19]);
});

test("decisions come back in level order", () => {
  const levels = levelDecisions(fighter2014, 8).map((decision) => decision.level);
  assert.deepEqual(levels, [3, 4, 6, 8]);
});

test("a level with no answer, or a half-spent one, is still waiting", () => {
  const choices = {
    4: { kind: "improvement", bonuses: { int: 2 } },
    8: { kind: "improvement", bonuses: { con: 1 } },
    12: { kind: "feat", featId: "" },
  };

  assert.deepEqual(unansweredImprovementLevels(wizard2014, 16, choices), [8, 12, 16]);
});

test("a feat answers a level as completely as an improvement", () => {
  const choices = { 4: { kind: "feat", featId: "alert" } };
  assert.deepEqual(unansweredImprovementLevels(wizard2014, 4, choices), []);
});

test("two points is the whole improvement, split however", () => {
  assert.equal(pointsSpent({ str: 2 }), 2);
  assert.equal(pointsSpent({ str: 1, dex: 1 }), 2);
  assert.equal(pointsSpent({}), 0);
});

test("an over-spent improvement is reported rather than clamped", () => {
  const problems = improvementProblems({ str: 2, dex: 1 });
  assert.deepEqual(problems, [{ reason: "too-many-points", spent: 3 }]);
});

test("three points in one score is caught even though it is the whole budget", () => {
  const problems = improvementProblems({ str: 3 });
  assert.ok(problems.some((problem) => problem.reason === "too-much-in-one"));
});

test("raising a score past twenty is caught when the score is known", () => {
  assert.deepEqual(improvementProblems({ str: 2 }, { str: 19 }), [
    { reason: "over-cap", ability: "str", total: 21 },
  ]);
  assert.deepEqual(improvementProblems({ str: 2 }, { str: 18 }), []);
});

test("a legal improvement has no problems", () => {
  assert.deepEqual(improvementProblems({ wis: 1, cha: 1 }, { wis: 12, cha: 8 }), []);
});

test("every level's raises add up, feats included", () => {
  const choices = {
    4: { kind: "improvement", bonuses: { int: 2 } },
    8: { kind: "feat", featId: "resilient", bonuses: { con: 1 } },
    12: { kind: "improvement", bonuses: { int: 1, con: 1 } },
  };

  assert.deepEqual(bonusesFromChoices(choices), { int: 3, con: 2 });
});

test("a feat with no half-feat bonus adds nothing", () => {
  assert.deepEqual(bonusesFromChoices({ 4: { kind: "feat", featId: "alert" } }), {});
});

test("feats come back in the order they were taken", () => {
  const choices = {
    12: { kind: "feat", featId: "lucky" },
    4: { kind: "feat", featId: "alert" },
    8: { kind: "improvement", bonuses: { int: 2 } },
  };

  assert.deepEqual(featsFromChoices(choices), ["alert", "lucky"]);
});

test("a level answered with an empty feat contributes no feat", () => {
  assert.deepEqual(featsFromChoices({ 4: { kind: "feat", featId: "" } }), []);
});
