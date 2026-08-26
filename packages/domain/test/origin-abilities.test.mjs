import test from "node:test";
import assert from "node:assert/strict";

import {
  describeOriginAbilityOption,
  originAbilityBonuses,
  unansweredOriginAbilities,
} from "../dist/index.js";

/** Every 2024 background has exactly this shape, over its own three abilities. */
const acolyte = [
  { options: ["int", "wis", "cha"], amounts: [2, 1] },
  { options: ["int", "wis", "cha"], amounts: [1, 1, 1] },
];

test("the +2/+1 alternative puts the two where the answer says", () => {
  const bonuses = originAbilityBonuses(acolyte, { optionIndex: 0, abilities: ["wis", "cha"] });

  assert.deepEqual(bonuses, { wis: 2, cha: 1 });
});

test("the order of the answer is the order of the amounts", () => {
  // Naming charisma first is a different character: +2 Charisma, not +2 Wisdom.
  const bonuses = originAbilityBonuses(acolyte, { optionIndex: 0, abilities: ["cha", "wis"] });

  assert.deepEqual(bonuses, { cha: 2, wis: 1 });
});

test("the spread alternative raises all three", () => {
  const bonuses = originAbilityBonuses(acolyte, {
    optionIndex: 1,
    abilities: ["int", "wis", "cha"],
  });

  assert.deepEqual(bonuses, { int: 1, wis: 1, cha: 1 });
});

test("a 2014 background grants nothing, which is the whole difference", () => {
  // 2014 puts the increase on the species. A builder that applies a background
  // bonus in 2014 as well hands the character three points too many.
  assert.deepEqual(originAbilityBonuses(null, { optionIndex: 0, abilities: ["wis", "cha"] }), {});
});

test("an unanswered choice grants nothing rather than guessing", () => {
  assert.deepEqual(originAbilityBonuses(acolyte, null), {});
  assert.equal(unansweredOriginAbilities(acolyte, null), 2);
});

test("half an answer is worth half, and the rest is reported", () => {
  // A player mid-pick has not chosen zero. What they have said counts, and
  // what they have not is named.
  const answer = { optionIndex: 0, abilities: ["wis"] };

  assert.deepEqual(originAbilityBonuses(acolyte, answer), { wis: 2 });
  assert.equal(unansweredOriginAbilities(acolyte, answer), 1);
});

test("an ability the background does not offer is dropped, not obeyed", () => {
  // The acolyte offers Intelligence, Wisdom and Charisma. A draft edited by
  // hand can name Strength, and it is not a bonus this background grants.
  const answer = { optionIndex: 0, abilities: ["str", "wis"] };

  assert.deepEqual(originAbilityBonuses(answer ? acolyte : null, answer), { wis: 1 });
  assert.equal(unansweredOriginAbilities(acolyte, answer), 1);
});

test("the same ability cannot take both halves", () => {
  // "+2 and +1 to Wisdom" is +3 to one ability, which no background grants.
  // The repeat counts as an empty slot rather than stacking.
  const answer = { optionIndex: 0, abilities: ["wis", "wis"] };

  assert.equal(unansweredOriginAbilities(acolyte, answer), 1);
});

test("an alternative index that does not exist grants nothing", () => {
  assert.deepEqual(originAbilityBonuses(acolyte, { optionIndex: 5, abilities: ["wis"] }), {});
});

test("the two alternatives read differently enough to choose between", () => {
  assert.equal(describeOriginAbilityOption(acolyte[0]), "+2 / +1");
  assert.equal(describeOriginAbilityOption(acolyte[1]), "+1 / +1 / +1");
});

test("both alternatives are worth the same three points", () => {
  // The rules give a 2024 character three points either way. If one path were
  // worth more, the choice would not be a choice.
  const spent = (option) => option.amounts.reduce((total, amount) => total + amount, 0);

  assert.equal(spent(acolyte[0]), 3);
  assert.equal(spent(acolyte[1]), 3);
});
