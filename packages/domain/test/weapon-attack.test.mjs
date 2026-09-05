import test from "node:test";
import assert from "node:assert/strict";

import { isRangedWeapon, weaponAbilityFor, weaponAttackFor } from "../dist/index.js";

/*
 * Rows copied from the shipped index rather than invented, so the shapes are
 * the ones the catalogue actually writes -- including the `|XPHB` suffix on
 * the 2024 rows, which is the part a naive `type === "M"` gets wrong.
 */
const greatsword = { type: "M", properties: ["H", "2H"], damage: "2d6", damageType: "S" };
const longbow = { type: "R", properties: ["A", "H", "2H"], damage: "1d8", damageType: "P" };
const rapier2024 = { type: "M|XPHB", properties: ["F"], damage: "1d8", damageType: "P" };
const dagger = { type: "M", properties: ["F", "L", "T"], damage: "1d4", damageType: "P" };
const handaxe = { type: "M", properties: ["L", "T"], damage: "1d6", damageType: "S" };
const quarterstaff = {
  type: "M",
  properties: ["V"],
  damage: "1d6",
  versatileDamage: "1d8",
  damageType: "B",
};
/** One of the 26 magic staves the catalogue gives no type at all. */
const staffOfCharming = { type: null, properties: [], damage: "1d6", damageType: "B" };

const strong = { str: 18, dex: 12 };
const quick = { str: 10, dex: 18 };

test("melee uses Strength and ranged uses Dexterity", () => {
  assert.equal(weaponAbilityFor(greatsword, { str: 4, dex: 1 }).ability, "str");
  assert.equal(weaponAbilityFor(longbow, { str: 4, dex: 1 }).ability, "dex");
});

test("the 2024 rows are melee too, suffix and all", () => {
  /*
   * `type` is "M|XPHB" on all 73 of them. Testing for "M" would have called
   * every 2024 melee weapon ranged, and handed a greatsword to Dexterity.
   */
  assert.equal(isRangedWeapon(rapier2024), false);
  assert.equal(isRangedWeapon({ type: "R|XPHB" }), true);
});

test("a weapon with no type at all is melee", () => {
  // The 26 rows without one are staves, rods and wands: swung by hand.
  assert.equal(isRangedWeapon(staffOfCharming), false);
  assert.equal(weaponAbilityFor(staffOfCharming, { str: 3, dex: 1 }).ability, "str");
});

test("finesse takes the better of the two, either way round", () => {
  assert.equal(weaponAbilityFor(rapier2024, { str: 4, dex: 1 }).ability, "str");
  assert.equal(weaponAbilityFor(rapier2024, { str: 1, dex: 4 }).ability, "dex");
  // And it says it was a choice, so a sheet can show the other half.
  assert.equal(weaponAbilityFor(rapier2024, { str: 4, dex: 1 }).chosen, true);
  assert.equal(weaponAbilityFor(greatsword, { str: 4, dex: 1 }).chosen, false);
});

test("thrown does not move the ability", () => {
  // A thrown handaxe is still Strength; a thrown dagger is still Finesse.
  assert.equal(weaponAbilityFor(handaxe, { str: 4, dex: 1 }).ability, "str");
  assert.equal(weaponAbilityFor(dagger, { str: 1, dex: 4 }).ability, "dex");
});

test("proficiency is counted only when it is there", () => {
  const armed = weaponAttackFor({
    weapon: greatsword,
    scores: strong,
    proficiencyBonus: 3,
    proficient: true,
  });
  const untrained = weaponAttackFor({
    weapon: greatsword,
    scores: strong,
    proficiencyBonus: 3,
    proficient: false,
  });

  // +4 Strength, +3 proficiency.
  assert.equal(armed.attackBonus, 7);
  // The bonus goes, the modifier stays: damage never counts proficiency.
  assert.equal(untrained.attackBonus, 4);
  assert.equal(untrained.damageModifier, 4);
});

test("damage carries the modifier, and versatile carries both dice", () => {
  const swing = weaponAttackFor({
    weapon: quarterstaff,
    scores: strong,
    proficiencyBonus: 2,
    proficient: true,
  });

  assert.equal(swing.damage, "1d6 + 4");
  assert.equal(swing.versatileDamage, "1d8 + 4");
});

test("a negative modifier reads as a subtraction, and a zero reads as nothing", () => {
  // "1d4 + -1" is not what a sheet prints, and neither is "1d4 + 0".
  const weak = weaponAttackFor({
    weapon: dagger,
    scores: { str: 8, dex: 8 },
    proficiencyBonus: 2,
    proficient: true,
  });
  const flat = weaponAttackFor({
    weapon: dagger,
    scores: { str: 10, dex: 10 },
    proficiencyBonus: 2,
    proficient: true,
  });

  assert.equal(weak.damage, "1d4 - 1");
  assert.equal(weak.attackBonus, 1);
  assert.equal(flat.damage, "1d4");
});

test("a rogue's rapier and a barbarian's greatsword land where they should", () => {
  const rogue = weaponAttackFor({
    weapon: rapier2024,
    scores: quick,
    proficiencyBonus: 3,
    proficient: true,
  });
  const barbarian = weaponAttackFor({
    weapon: greatsword,
    scores: strong,
    proficiencyBonus: 3,
    proficient: true,
  });

  assert.equal(rogue.ability, "dex");
  assert.equal(rogue.attackBonus, 7);
  assert.equal(rogue.damage, "1d8 + 4");
  assert.equal(barbarian.ability, "str");
  assert.equal(barbarian.damage, "2d6 + 4");
});

test("a weapon that states no damage says so instead of inventing a die", () => {
  const nothing = weaponAttackFor({
    weapon: { type: "M", properties: [], damage: null },
    scores: strong,
    proficiencyBonus: 2,
    proficient: true,
  });

  assert.equal(nothing.damage, null);
  assert.equal(nothing.versatileDamage, null);
  // The attack still exists: not knowing the die is not not knowing the swing.
  assert.equal(nothing.attackBonus, 6);
});
