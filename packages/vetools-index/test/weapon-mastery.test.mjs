/**
 * Weapon mastery, 2024's answer to "why would anyone pick a maul".
 *
 * Two halves have to line up. Every 2024 weapon carries one mastery property,
 * and five classes let a character use some of them — and the number is stated
 * two different ways, in a level table for the two classes whose count grows
 * and in the feature's own text for the three whose does not. Reading only the
 * table loses three classes; reading only the prose freezes the fighter at
 * three when the rules take them to six.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "data");
const classes = JSON.parse(fs.readFileSync(path.join(DATA, "class.json"), "utf8"));
const items = JSON.parse(fs.readFileSync(path.join(DATA, "item.json"), "utf8"));

const findClass = (name, source) => classes.find((r) => r.name === name && r.source === source);

/** The eight the 2024 books define, and no ninth. */
const PROPERTIES = ["Cleave", "Graze", "Nick", "Push", "Sap", "Slow", "Topple", "Vex"];

test("exactly five classes grant it, and all five are 2024", () => {
  const granting = classes.filter((row) => row.weaponMastery);

  assert.deepEqual(
    granting.map((row) => row.name).sort(),
    ["Barbarian", "Fighter", "Paladin", "Ranger", "Rogue"],
  );
  for (const row of granting) {
    assert.equal(row.source, "XPHB", row.name);
  }
});

test("a count that grows comes from the class's own table", () => {
  // The fighter reaches six and the barbarian four. A flat number read out of
  // the feature text would have frozen both at their level-one value.
  assert.deepEqual(
    findClass("Fighter", "XPHB").weaponMastery.countByLevel,
    [3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6],
  );
  assert.deepEqual(
    findClass("Barbarian", "XPHB").weaponMastery.countByLevel,
    [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  );
});

test("a count that never grows is read out of the feature's own words", () => {
  // "the mastery properties of two kinds of weapons". Three classes state it
  // this way and have no table column at all.
  for (const name of ["Paladin", "Ranger", "Rogue"]) {
    const counts = findClass(name, "XPHB").weaponMastery.countByLevel;
    assert.deepEqual(counts, Array(20).fill(2), name);
  }
});

test("the barbarian's mastery is melee only, and nobody else's is", () => {
  // It is in the filter tag rather than in a field of its own, so it is easy
  // to lose — and losing it lets a barbarian master a longbow.
  assert.equal(findClass("Barbarian", "XPHB").weaponMastery.meleeOnly, true);

  for (const name of ["Fighter", "Paladin", "Ranger", "Rogue"]) {
    assert.equal(findClass(name, "XPHB").weaponMastery.meleeOnly, false, name);
  }
});

test("no 2014 class grants it, because the rule did not exist", () => {
  const legacy = classes.filter((row) => row.source === "PHB");

  assert.ok(legacy.length >= 12);
  for (const row of legacy) {
    assert.equal(row.weaponMastery, null, row.name);
  }
});

test("every mastery name on every weapon is one of the eight", () => {
  // The previous version of this ran every entry through `String()`, and one
  // weapon carries an object rather than a string — so the index shipped the
  // literal text "[object Object]" as a mastery property.
  const seen = new Set();

  for (const row of items) {
    for (const name of row.mastery ?? []) {
      assert.ok(PROPERTIES.includes(name), `${row.name} (${row.source}): "${name}"`);
      seen.add(name);
    }
  }

  assert.deepEqual([...seen].sort(), PROPERTIES);
});

test("the one weapon whose property is free says so", () => {
  // The Psychic Blade's Vex does not count against the number of properties a
  // character may use. That is a rule, and it was a note attached to a string.
  const free = items.filter((row) => row.masteryFree);

  assert.equal(free.length, 1);
  assert.equal(free[0].name, "Psychic Blade");
  assert.deepEqual(free[0].masteryFree, ["Vex"]);
  assert.deepEqual(free[0].mastery, ["Vex"]);
});

test("a weapon carries at most one mastery property", () => {
  // The whole system rests on it: a mastery pick is a weapon, and if a weapon
  // could bring two properties the count would mean something else.
  for (const row of items) {
    if (!row.mastery) continue;
    assert.equal(row.mastery.length, 1, `${row.name} (${row.source})`);
  }
});

test("enough weapons have one for the choice to be worth making", () => {
  const withMastery = items.filter((row) => row.mastery);

  assert.ok(withMastery.length > 80, `only ${withMastery.length} weapons carry a property`);
});
