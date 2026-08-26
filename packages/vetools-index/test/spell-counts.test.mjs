/**
 * How many cantrips and spells each casting class has, per level.
 *
 * Both editions print this in the class's own table, and nothing read it: the
 * builder carried a hand-written switch over eight classes with the 2014
 * numbers and served both editions from it. These tests pin that the tables
 * were read, that the editions were kept apart, and that the two classes whose
 * magic moved between editions moved with it.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "data");
const classes = JSON.parse(fs.readFileSync(path.join(DATA, "class.json"), "utf8"));

const find = (name, source) => classes.find((r) => r.name === name && r.source === source);

test("2014 counts what a class knows and 2024 counts what it prepares", () => {
  // The rename is the rule change: 2024 made every caster a prepare-caster.
  const legacy = find("Bard", "PHB").spellTable;
  const modern = find("Bard", "XPHB").spellTable;

  assert.ok(legacy.known, "2014 bard should have a Spells Known column");
  assert.equal(legacy.prepared, null);

  assert.ok(modern.prepared, "2024 bard should have a Prepared Spells column");
  assert.equal(modern.known, null);
});

test("and the numbers differ, which one switch could not express", () => {
  // A 2024 bard prepares nine at level 5 where a 2014 bard knows eight. The
  // hand-written table gave both the 2014 number.
  assert.equal(find("Bard", "PHB").spellTable.known[4], 8);
  assert.equal(find("Bard", "XPHB").spellTable.prepared[4], 9);
});

test("a 2014 prepare-caster carries a formula instead, because a table cannot know a modifier", () => {
  const cleric = find("Cleric", "PHB");

  assert.equal(cleric.spellTable.prepared, null);
  assert.equal(cleric.spellTable.known, null);
  assert.equal(cleric.preparedSpells, "<$level$> + <$wis_mod$>");

  // 2024 replaced the formula with a column, so the modern row carries none.
  assert.equal(find("Cleric", "XPHB").preparedSpells, null);
  assert.ok(find("Cleric", "XPHB").spellTable.prepared);
});

test("2024 moved the paladin's and the ranger's magic to level 1", () => {
  // A constant "half casters start at level 2" is wrong for exactly the two
  // classes it was written for.
  assert.equal(find("Paladin", "PHB").spellcastingLevel, 2);
  assert.equal(find("Paladin", "XPHB").spellcastingLevel, 1);
  assert.equal(find("Ranger", "PHB").spellcastingLevel, 2);
  assert.equal(find("Ranger", "XPHB").spellcastingLevel, 1);
});

test("the warlock's Pact Magic counts as spellcasting", () => {
  // It is the one class whose feature is not called Spellcasting, and matching
  // only that name leaves it with no answer at all.
  assert.equal(find("Warlock", "PHB").spellcastingLevel, 1);
  assert.equal(find("Warlock", "XPHB").spellcastingLevel, 1);
});

test("every caster but one unreleased prestige class knows where its magic starts", () => {
  const casters = classes.filter((row) => row.casterProgression);
  const without = casters.filter((row) => row.spellcastingLevel === null);

  assert.deepEqual(
    without.map((row) => row.name),
    ["Prestige Class: Rune Scribe"],
  );
});

test("a class with no cantrips has no cantrip column, in either edition", () => {
  // The paladin and the ranger have never had cantrips. An empty column and a
  // column of zeroes are different claims, and only one of them is true.
  for (const source of ["PHB", "XPHB"]) {
    assert.equal(find("Paladin", source).spellTable?.cantrips ?? null, null, source);
  }
});

test("every column that exists covers all twenty levels", () => {
  // A short column read at a high level hands back undefined, and the count
  // becomes NaN.
  for (const row of classes) {
    if (!row.spellTable) continue;
    const where = `${row.name} (${row.source})`;

    for (const key of ["cantrips", "known", "prepared"]) {
      const counts = row.spellTable[key];
      if (!counts) continue;
      assert.equal(counts.length, 20, `${where}: ${key}`);
      for (const value of counts) {
        assert.ok(Number.isInteger(value) && value >= 0, `${where}: ${key} has ${value}`);
      }
    }
  }
});

test("a non-caster has no table at all", () => {
  for (const name of ["Fighter", "Barbarian", "Monk", "Rogue"]) {
    assert.equal(find(name, "PHB").spellTable, null, name);
  }
});

test("every caster has either a table or a formula to count by", () => {
  // If one had neither, its player would be told they may prepare nothing.
  // The Rune Scribe is the single exception in the whole dataset: an
  // unreleased UA prestige class that prints no table and states no formula,
  // and it is named here rather than hidden behind a weaker assertion.
  const countless = classes.filter(
    (row) =>
      row.casterProgression &&
      row.casterProgression !== "pact" &&
      !row.spellTable &&
      !row.preparedSpells,
  );

  assert.deepEqual(
    countless.map((row) => row.name),
    ["Prestige Class: Rune Scribe"],
  );
});
