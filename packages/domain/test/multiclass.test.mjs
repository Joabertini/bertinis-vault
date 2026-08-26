import test from "node:test";
import assert from "node:assert/strict";

import {
  casterLevelContribution,
  multiclassCasterLevel,
  multiclassHitPoints,
  multiclassSpellSlots,
  pactSlotsOf,
  progressionOf,
} from "../dist/index.js";

const cls = (classId, level, over = {}) => ({ classId, level, ...over });

const wizard = (level) => cls("wizard", level, { casterProgression: "full", hitDie: 6 });
const cleric = (level) => cls("cleric", level, { casterProgression: "full", hitDie: 8 });
/** The 2014 ranger, which casts nothing at level 1. */
const ranger = (level) => cls("ranger", level, { casterProgression: "1/2", hitDie: 10 });
/** The 2024 paladin, which 5etools files under the artificer's progression. */
const paladin2024 = (level) => cls("paladin", level, { casterProgression: "artificer", hitDie: 10 });
const artificer = (level) => cls("artificer", level, { casterProgression: "artificer", hitDie: 8 });
const warlock = (level) => cls("warlock", level, { casterProgression: "pact", hitDie: 8 });
const barbarian = (level) => cls("barbarian", level, { casterProgression: null, hitDie: 12 });
const eldritchKnight = (level) =>
  cls("fighter", level, { casterProgression: null, subclassCasterProgression: "1/3", hitDie: 10 });

test("a subclass's progression is the one that governs", () => {
  // The fighter casts nothing; the eldritch knight casts a third. Without the
  // subclass field a fighter 12 / wizard 1 reads as one caster level.
  assert.equal(progressionOf(eldritchKnight(12)), "1/3");
  assert.equal(progressionOf(barbarian(5)), null);
  assert.equal(progressionOf(wizard(3)), "full");
});

test("a full caster contributes every level", () => {
  assert.equal(casterLevelContribution(wizard(7)), 7);
});

test("the half-caster rounding is down for the shared table, not up", () => {
  // This is the trap. A ranger 5 alone reads its own table at 3 — four first
  // and two second. A ranger 5 multiclassing contributes 2. Rounding up here
  // would hand out slots the character does not have.
  assert.equal(casterLevelContribution(ranger(5)), 2);
  assert.equal(casterLevelContribution(ranger(1)), 0);
  assert.equal(casterLevelContribution(ranger(20)), 10);
});

test("the artificer rounds up, because Tasha's says so in as many words", () => {
  assert.equal(casterLevelContribution(artificer(1)), 1);
  assert.equal(casterLevelContribution(artificer(5)), 3);

  // 2024 moved the paladin and the ranger onto the same footing, which 5etools
  // records by giving them the artificer's progression code. A 2024 paladin 5
  // contributes 3 where a 2014 paladin 5 contributes 2.
  assert.equal(casterLevelContribution(paladin2024(5)), 3);
});

test("a third-caster rounds down, on a third of that class's levels", () => {
  assert.equal(casterLevelContribution(eldritchKnight(2)), 0);
  assert.equal(casterLevelContribution(eldritchKnight(3)), 1);
  assert.equal(casterLevelContribution(eldritchKnight(11)), 3);
});

test("a warlock contributes nothing to the shared level", () => {
  // Pact magic recharges on a short rest and is tracked separately. Adding it
  // to the table would give the character its slots twice.
  assert.equal(casterLevelContribution(warlock(5)), 0);
  assert.equal(multiclassCasterLevel([warlock(5)]), 0);
});

test("a single full caster gets exactly what it always got", () => {
  // The guard on the change: nothing about a one-class character may move.
  const { slots, pactLevel } = multiclassSpellSlots([wizard(5)]);

  assert.deepEqual(slots, { 1: 4, 2: 3, 3: 2 });
  assert.equal(pactLevel, undefined);
});

test("the slots come from the combined level, not from each class's own table", () => {
  // A wizard 3 / cleric 2 is caster level 5: four first, three second, two
  // third. Read as a wizard 3 alone it was four first and two second — two
  // slots short and one level of spells missing entirely.
  const { slots } = multiclassSpellSlots([wizard(3), cleric(2)]);

  assert.deepEqual(slots, { 1: 4, 2: 3, 3: 2 });
});

test("a martial with a caster dip reads the table where the dip puts it", () => {
  // Barbarian 5 / wizard 1 is caster level 1, not 6.
  assert.deepEqual(multiclassSpellSlots([barbarian(5), wizard(1)]).slots, { 1: 2 });
});

test("a fighter 12 eldritch knight with a wizard level is caster level 5", () => {
  assert.equal(multiclassCasterLevel([eldritchKnight(12), wizard(1)]), 5);
});

test("pact slots travel beside the others, under their own key", () => {
  // A warlock 2 / sorcerer 3 has a sorcerer 3's slots and two pact slots that
  // come back on a short rest. Adding them together would make five.
  const result = multiclassSpellSlots([warlock(2), cls("sorcerer", 3, { casterProgression: "full" })]);

  assert.deepEqual(result.slots, { 1: 4, 2: 2, pact: 2 });
  assert.equal(result.pactLevel, 1);
});

test("a warlock's pact slots are read at their warlock level alone", () => {
  assert.deepEqual(pactSlotsOf([warlock(5), wizard(10)]), { count: 2, level: 3 });
  assert.equal(pactSlotsOf([wizard(10)]), null);
});

test("a character with no caster level has no slots, not an empty table row", () => {
  assert.deepEqual(multiclassSpellSlots([barbarian(5), cls("rogue", 3, {})]), { slots: {} });
});

test("caster level stops at the table, not at twenty separate classes", () => {
  // Not reachable in play, but a build with more levels than the table has
  // rows must read the last row rather than undefined.
  assert.deepEqual(multiclassSpellSlots([wizard(20), cleric(20)]).slots["9"], 1);
});

test("hit points use the die of the class each level was taken in", () => {
  // Barbarian 1 / wizard 4 at Constitution +2: 12 + 2, then four d6 levels at
  // 4 + 2. Read as five barbarian levels it was 12 + four times 9 — sixteen
  // hit points the character does not have.
  assert.equal(
    multiclassHitPoints({ entries: [barbarian(1), wizard(4)], constitutionModifier: 2 }),
    38,
  );
});

test("only the very first level gets its die at maximum", () => {
  // Taking a second class does not hand out a second maximised die.
  const straight = multiclassHitPoints({ entries: [wizard(5)], constitutionModifier: 0 });
  const split = multiclassHitPoints({
    entries: [wizard(1), cls("sorcerer", 4, { hitDie: 6 })],
    constitutionModifier: 0,
  });

  assert.equal(straight, split);
});

test("a terrible Constitution still leaves one hit point per level", () => {
  assert.equal(
    multiclassHitPoints({ entries: [wizard(3)], constitutionModifier: -5 }),
    3,
  );
});
