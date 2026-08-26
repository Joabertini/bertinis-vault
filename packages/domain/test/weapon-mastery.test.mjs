import test from "node:test";
import assert from "node:assert/strict";

import {
  masteryCountFor,
  masteryIsMeleeOnly,
  masteryProblems,
  weaponMasterySlots,
} from "../dist/index.js";

/** The real tables, as the index reads them out of the 2024 books. */
const fighter = {
  countByLevel: [3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6],
  meleeOnly: false,
};
const barbarian = {
  countByLevel: [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  meleeOnly: true,
};
const rogue = { countByLevel: Array(20).fill(2), meleeOnly: false };

const entry = (classId, level, mastery) => ({ classId, level, mastery });

test("the count grows with the class level, not the character level", () => {
  assert.equal(masteryCountFor(fighter, 1), 3);
  assert.equal(masteryCountFor(fighter, 4), 4);
  assert.equal(masteryCountFor(fighter, 16), 6);
  assert.equal(masteryCountFor(fighter, 20), 6);
});

test("a class that never learns it grants none", () => {
  assert.equal(masteryCountFor(null, 20), 0);
  assert.equal(weaponMasterySlots([entry("wizard", 20, null)]), 0);
});

test("a level outside the table is clamped rather than read past the end", () => {
  // Reading index 20 of a 20-entry table hands back undefined, and the whole
  // count becomes NaN — a number that compares false against everything.
  assert.equal(masteryCountFor(fighter, 25), 6);
  assert.equal(masteryCountFor(fighter, 0), 3);
  assert.equal(masteryCountFor(fighter, -4), 3);
});

test("two classes do not stack, the larger wins", () => {
  // The books say nothing about this case, and name only Extra Attack,
  // Spellcasting and Armor Class as features with special multiclass rules.
  // Summing would tell a fighter 3 / rogue 2 they may master five weapons
  // when neither table ever says more than three at those levels.
  const slots = weaponMasterySlots([entry("fighter", 3, fighter), entry("rogue", 2, rogue)]);

  assert.equal(slots, 3);
});

test("each class reads its own table at its own level", () => {
  // A fighter 3 / rogue 2 is a fifth-level character, and the fighter's table
  // is read at 3. Reading it at 5 would grant four.
  assert.equal(weaponMasterySlots([entry("fighter", 3, fighter), entry("rogue", 2, rogue)]), 3);
  assert.equal(weaponMasterySlots([entry("fighter", 5, fighter)]), 4);
});

test("the melee restriction only binds when every source has it", () => {
  // A barbarian may master melee weapons only. A barbarian/fighter may master
  // a longbow, because the fighter's own feature says so.
  assert.equal(masteryIsMeleeOnly([entry("barbarian", 5, barbarian)]), true);
  assert.equal(
    masteryIsMeleeOnly([entry("barbarian", 5, barbarian), entry("fighter", 1, fighter)]),
    false,
  );
  assert.equal(masteryIsMeleeOnly([entry("wizard", 5, null)]), false);
});

test("picking more weapons than allowed is reported, with both numbers", () => {
  const picks = [
    { itemId: "greatsword", property: "Graze" },
    { itemId: "longsword", property: "Sap" },
    { itemId: "dagger", property: "Nick" },
  ];

  assert.deepEqual(masteryProblems(picks, 2), [{ kind: "over-limit", picked: 3, allowed: 2 }]);
  assert.deepEqual(masteryProblems(picks, 3), []);
});

test("a weapon with no mastery property cannot be mastered, and is said so", () => {
  // A 2014 weapon in a 2024 character's hands is a legal weapon and an illegal
  // pick. Dropping it silently would leave the player wondering where it went.
  const problems = masteryProblems(
    [{ itemId: "rapier", property: "Vex" }, { itemId: "whip", property: null }],
    2,
  );

  assert.deepEqual(problems, [{ kind: "no-property", itemId: "whip" }]);
});

test("a weapon that costs no slot does not count against the limit", () => {
  // The Psychic Blade is the only one, and its Vex is free.
  const picks = [
    { itemId: "greatsword", property: "Graze" },
    { itemId: "longsword", property: "Sap" },
    { itemId: "psychic-blade", property: "Vex", free: true },
  ];

  assert.deepEqual(masteryProblems(picks, 2), []);
});

test("the same weapon twice is one pick and one complaint", () => {
  const problems = masteryProblems(
    [{ itemId: "dagger", property: "Nick" }, { itemId: "dagger", property: "Nick" }],
    1,
  );

  assert.deepEqual(problems, [{ kind: "duplicate", itemId: "dagger" }]);
});

test("no picks is no problem, which is not the same as no slots", () => {
  assert.deepEqual(masteryProblems([], 3), []);
});
