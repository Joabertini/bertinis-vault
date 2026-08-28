/**
 * Where a character's hit points come from.
 *
 * Both editions print two ways on the class page and a table picks one. The
 * builder could only ever say "average", so a character at a table that rolls
 * had a number on their sheet that nobody at that table had ever rolled.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  averageHitPointsPerLevel,
  calculateEstimatedHitPoints,
  deriveCharacterBuild,
  hitDiceByLevel,
  hitPointsFor,
  multiclassHitPoints,
} from "../dist/index.js";

test("the first level is the die at maximum and is never rolled", () => {
  // A level 1 character has no roll to record, in either edition.
  assert.equal(hitPointsFor({ dice: [10], constitutionModifier: 2 }), 12);
  assert.equal(
    hitPointsFor({ dice: [10], constitutionModifier: 2, method: "rolled", rolls: [1] }),
    12,
  );
});

test("the average is half the die plus one, which is what the class prints", () => {
  assert.deepEqual([6, 8, 10, 12].map(averageHitPointsPerLevel), [4, 5, 6, 7]);
});

test("a rolled level uses the roll instead of the average", () => {
  // A d8 wizard of 3 with +1 Con: 8+1 at first, then two levels the player
  // rolled a 7 and a 2 on.
  const rolled = hitPointsFor({
    dice: [8, 8, 8],
    constitutionModifier: 1,
    method: "rolled",
    rolls: [7, 2],
  });

  assert.equal(rolled, 9 + 8 + 3);
  assert.equal(hitPointsFor({ dice: [8, 8, 8], constitutionModifier: 1 }), 9 + 6 + 6);
});

test("a level with no roll yet takes the average rather than nothing", () => {
  // A sheet filled in as far as level 3 is four honest numbers at level 5, not
  // a total that collapsed because the last two rows are empty.
  const partial = hitPointsFor({
    dice: [8, 8, 8, 8, 8],
    constitutionModifier: 0,
    method: "rolled",
    rolls: [8, 8],
  });

  assert.equal(partial, 8 + 8 + 8 + 5 + 5);
});

test("a number the die cannot produce is not a roll", () => {
  // A draft is a value the player could have typed. Trusting a 12 on a d6
  // would put six hit points on the sheet that no die gave.
  const impossible = hitPointsFor({
    dice: [6, 6],
    constitutionModifier: 0,
    method: "rolled",
    rolls: [12],
  });

  assert.equal(impossible, 6 + averageHitPointsPerLevel(6));
});

test("rolls are ignored entirely while the method says average", () => {
  // Switching back to the average must not leave the rolled numbers acting.
  assert.equal(
    hitPointsFor({ dice: [8, 8], constitutionModifier: 0, method: "average", rolls: [8] }),
    8 + 5,
  );
});

test("every level gives at least one hit point, however bad the Constitution", () => {
  // A d6 at -4 gains nothing per level after the first, and the rule floors
  // each level at one rather than the total: 2 + four levels of 1.
  assert.equal(hitPointsFor({ dice: [6, 6, 6, 6, 6], constitutionModifier: -4 }), 2 + 4);
});

test("a multiclass level uses the die of the class it was taken in", () => {
  // Barbarian 1 / wizard 4 is a d12 at maximum plus four d6 levels.
  assert.deepEqual(
    hitDiceByLevel([
      { classId: "barbarian", level: 1, hitDie: 12 },
      { classId: "wizard", level: 4, hitDie: 6 },
    ]),
    [12, 6, 6, 6, 6],
  );
  assert.equal(
    multiclassHitPoints({
      entries: [
        { classId: "barbarian", level: 1, hitDie: 12 },
        { classId: "wizard", level: 4, hitDie: 6 },
      ],
      constitutionModifier: 0,
    }),
    12 + 4 * 4,
  );
});

test("the maximum is the character's first level and not each class's", () => {
  // The multiclassing rule in as many words: a wizard who takes a level of
  // fighter rolls for it like any other level.
  const rolls = multiclassHitPoints({
    entries: [
      { classId: "wizard", level: 1, hitDie: 6 },
      { classId: "fighter", level: 1, hitDie: 10 },
    ],
    constitutionModifier: 0,
    method: "rolled",
    rolls: [3],
  });

  assert.equal(rolls, 6 + 3);
});

test("the single-class helper is the same rule", () => {
  assert.equal(
    calculateEstimatedHitPoints({ hitDie: 10, level: 3, constitutionModifier: 2 }),
    12 + 8 + 8,
  );
  assert.equal(
    calculateEstimatedHitPoints({
      hitDie: 10,
      level: 3,
      constitutionModifier: 2,
      method: "rolled",
      rolls: [10, 1],
    }),
    12 + 12 + 3,
  );
});

const draft = (hitPoints) => ({
  meta: {
    rulesVersion: "5e-2014",
    sourceProfile: "vault-v1",
    createdAt: "2026-03-22T00:00:00.000Z",
    updatedAt: "2026-03-22T00:00:00.000Z",
  },
  identity: { characterName: "Probe", alignment: "Neutral" },
  ancestry: { raceId: "human" },
  classing: { classes: [{ classId: "fighter", level: 3, hitDie: 10 }] },
  background: { backgroundId: "soldier", grantedFeatIds: [] },
  abilities: {
    generationMethod: "manual",
    base: { str: 15, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
    final: { str: 15, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
  },
  choices: { feats: [], proficiencies: [], spells: [], equipment: [], features: [] },
  ...(hitPoints ? { hitPoints } : {}),
});

test("a build that says nothing still derives the average", () => {
  // Every build written before the field exists, which is all of them.
  assert.equal(deriveCharacterBuild(draft(null)).derived.hp, 12 + 8 + 8);
});

test("a build that rolled derives what it rolled", () => {
  const build = deriveCharacterBuild(draft({ method: "rolled", rolls: [9, 4] }));

  assert.equal(build.derived.hp, 12 + 11 + 6);
});
