import test from "node:test";
import assert from "node:assert/strict";

import {
  abilityImprovementPointsForLevel,
  applyAbilityBonuses,
  savingThrowsForClass,
  suggestedAbilityBonuses,
} from "../dist/index.js";

const base = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };

/* ------------------------------------------------------- species bonus -- */

test("a species bonus raises the scores the sheet uses", () => {
  const final = applyAbilityBonuses(base, { str: 2, con: 1 });

  assert.equal(final.str, 17);
  assert.equal(final.con, 14);
  assert.equal(final.dex, 14);
});

test("a subspecies bonus stacks on the species bonus", () => {
  assert.deepEqual(suggestedAbilityBonuses("dwarf", "hill-dwarf"), { con: 2, wis: 1 });
  assert.deepEqual(suggestedAbilityBonuses("dwarf", "mountain-dwarf"), { con: 2, str: 2 });
});

test("a species the table does not describe suggests nothing rather than guessing", () => {
  assert.deepEqual(suggestedAbilityBonuses("aarakocra"), {});
});

test("the base scores are left alone", () => {
  const copy = { ...base };
  applyAbilityBonuses(base, { str: 2 });

  assert.deepEqual(base, copy);
});

/* --------------------------------------------------------- improvements -- */

test("improvement points are earned at 4, 8, 12, 16 and 19", () => {
  assert.equal(abilityImprovementPointsForLevel(1), 0);
  assert.equal(abilityImprovementPointsForLevel(3), 0);
  assert.equal(abilityImprovementPointsForLevel(4), 2);
  assert.equal(abilityImprovementPointsForLevel(8), 4);
  assert.equal(abilityImprovementPointsForLevel(12), 6);
  assert.equal(abilityImprovementPointsForLevel(16), 8);
  assert.equal(abilityImprovementPointsForLevel(19), 10);
  assert.equal(abilityImprovementPointsForLevel(20), 10);
});

test("an improvement stops at twenty", () => {
  const final = applyAbilityBonuses({ ...base, str: 19 }, { str: 2 }, { str: 4 });

  assert.equal(final.str, 20);
});

test("species bonus and improvements add together", () => {
  const final = applyAbilityBonuses(base, { str: 2 }, { str: 2, con: 2 });

  assert.equal(final.str, 19);
  assert.equal(final.con, 15);
});

/* -------------------------------------------------------- saving throws -- */

test("every class grants two saving throws", () => {
  for (const classId of [
    "barbarian", "bard", "cleric", "druid", "fighter", "monk",
    "paladin", "ranger", "rogue", "sorcerer", "warlock", "wizard",
  ]) {
    assert.equal(savingThrowsForClass(classId).length, 2, classId);
  }
});

test("the saves are the ones the class actually grants", () => {
  assert.deepEqual(savingThrowsForClass("wizard"), ["int", "wis"]);
  assert.deepEqual(savingThrowsForClass("barbarian"), ["str", "con"]);
  assert.deepEqual(savingThrowsForClass("rogue"), ["dex", "int"]);
});

test("a class nobody has heard of grants none rather than throwing", () => {
  assert.deepEqual(savingThrowsForClass("not-a-class"), []);
});
