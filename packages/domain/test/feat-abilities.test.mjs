import test from "node:test";
import assert from "node:assert/strict";

import {
  bonusesFromFeats,
  featAbilityProblems,
  featAbilityRequirement,
  isAbilityId,
  unansweredFeatAbilities,
} from "../dist/index.js";

/** Resilient: +1 to any one ability, alongside a saving throw proficiency. */
const resilient = [{ kind: "choice", from: ["str", "dex", "con", "int", "wis", "cha"], amount: 1, count: 1 }];

/** Fey Touched: +1 to Intelligence, Wisdom or Charisma. */
const feyTouched = [{ kind: "choice", from: ["int", "wis", "cha"], amount: 1, count: 1 }];

/** Athlete, whose pool is narrower still. */
const athlete = [{ kind: "choice", from: ["str", "dex"], amount: 1, count: 1 }];

/** Tough raises nothing; it gives hit points. */
const tough = [];

test("a feat that raises nothing asks nothing", () => {
  const requirement = featAbilityRequirement(tough);

  assert.equal(requirement.points, 0);
  assert.deepEqual(requirement.choices, []);
  assert.deepEqual(featAbilityProblems(tough, {}), []);
});

test("a half-feat is one point, spent on one ability from its pool", () => {
  const requirement = featAbilityRequirement(feyTouched);

  assert.equal(requirement.points, 1);
  assert.deepEqual(requirement.choices, [{ from: ["int", "wis", "cha"], amount: 1, count: 1 }]);
  assert.deepEqual(featAbilityProblems(feyTouched, { wis: 1 }), []);
});

test("an unanswered half-feat is reported rather than lost", () => {
  // This is the whole point. Until now the id was stored and the increase was
  // dropped, and nothing on the sheet said a point had gone missing.
  const problems = featAbilityProblems(resilient, {});

  assert.deepEqual(problems, [{ kind: "unspent", points: 1, spent: 0 }]);
});

test("raising an ability the feat does not offer is reported", () => {
  // Fey Touched offers the three mental abilities. Strength is not a typo the
  // sheet would show — it would simply be a Strength the character has not got.
  const problems = featAbilityProblems(feyTouched, { str: 1 });

  assert.deepEqual(problems, [{ kind: "not-offered", ability: "str" }]);
});

test("taking more than the feat grants is reported", () => {
  const problems = featAbilityProblems(athlete, { str: 1, dex: 1 });

  assert.deepEqual(problems, [
    { kind: "overspent", points: 1, spent: 2 },
    { kind: "too-many-abilities", allowed: 1, chosen: 2 },
  ]);
});

test("a fixed increase is applied, not asked", () => {
  // A handful of feats name the ability outright. There is no question to put
  // to the player, and nothing else was applying them either.
  const fixed = [{ kind: "fixed", bonuses: { con: 1 } }];

  assert.deepEqual(featAbilityRequirement(fixed).fixed, { con: 1 });
  assert.equal(featAbilityRequirement(fixed).points, 0);
  assert.deepEqual(featAbilityProblems(fixed, {}), []);
});

test("what the feats contribute is the chosen and the fixed together", () => {
  const total = bonusesFromFeats([
    { featId: "resilient", grants: resilient, bonuses: { con: 1 } },
    { featId: "fey-touched", grants: feyTouched, bonuses: { cha: 1 } },
    { featId: "some-fixed-feat", grants: [{ kind: "fixed", bonuses: { con: 1 } }], bonuses: {} },
    { featId: "tough", grants: tough, bonuses: {} },
  ]);

  assert.deepEqual(total, { con: 2, cha: 1 });
});

test("only the feats with something wrong are reported", () => {
  const unanswered = unansweredFeatAbilities([
    { featId: "tough", grants: tough, bonuses: {} },
    { featId: "resilient", grants: resilient, bonuses: { con: 1 } },
    { featId: "fey-touched", grants: feyTouched, bonuses: {} },
  ]);

  assert.deepEqual(
    unanswered.map((entry) => entry.featId),
    ["fey-touched"],
  );
});

test("a pool naming something that is not an ability is dropped, not carried", () => {
  assert.equal(isAbilityId("cha"), true);
  assert.equal(isAbilityId("luck"), false);

  const total = bonusesFromFeats([
    { featId: "odd", grants: [{ kind: "fixed", bonuses: { luck: 1, con: 1 } }], bonuses: {} },
  ]);

  assert.deepEqual(total, { con: 1 });
});
