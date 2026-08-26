/**
 * How each class advances spellcasting, against what the books say.
 *
 * The rules layer has a hand-written table keyed by class id, and it can only
 * describe one edition: the 2014 paladin begins casting at level 2 and the
 * 2024 paladin at level 1, and one key cannot hold both answers. These pin the
 * index as the authority for that, and pin the two rows a hand-written table
 * would most likely get wrong.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "data");
const read = (name) => JSON.parse(fs.readFileSync(path.join(DATA, `${name}.json`), "utf8"));

const classes = read("class");
const subclasses = read("subclass");

const findClass = (name, source) => classes.find((r) => r.name === name && r.source === source);
const findSubclass = (name, source) =>
  subclasses.find((r) => r.name === name && r.source === source);

const KNOWN = new Set(["full", "1/2", "1/3", "artificer", "pact", null]);

test("the full casters are the five that have always been", () => {
  const full = classes
    .filter((row) => row.casterProgression === "full")
    .map((row) => row.name)
    .filter((name, index, all) => all.indexOf(name) === index)
    .sort();

  // Two unplayable oddities from Unearthed Arcana ride along in the data; the
  // five real ones are what matters.
  for (const name of ["Bard", "Cleric", "Druid", "Sorcerer", "Wizard"]) {
    assert.ok(full.includes(name), `${name} is no longer a full caster`);
  }
});

test("the paladin and the ranger changed edition, and the index says so", () => {
  // 2014: half-caster, nothing at level 1, and half its levels rounded *down*
  // toward a shared caster level. 2024: the artificer's progression, casting
  // from level 1 and rounding up. A table keyed by class id says one or the
  // other and is wrong about the rest.
  assert.equal(findClass("Paladin", "PHB").casterProgression, "1/2");
  assert.equal(findClass("Ranger", "PHB").casterProgression, "1/2");

  assert.equal(findClass("Paladin", "XPHB").casterProgression, "artificer");
  assert.equal(findClass("Ranger", "XPHB").casterProgression, "artificer");
});

test("the warlock is its own thing in both editions", () => {
  assert.equal(findClass("Warlock", "PHB").casterProgression, "pact");
  assert.equal(findClass("Warlock", "XPHB").casterProgression, "pact");
});

test("a class that casts nothing says nothing rather than zero", () => {
  for (const name of ["Barbarian", "Fighter", "Monk", "Rogue"]) {
    assert.equal(findClass(name, "PHB").casterProgression, null, name);
    assert.equal(findClass(name, "XPHB").casterProgression, null, name);
  }
});

test("the third-casters are subclasses, and carry it themselves", () => {
  // This is why the field had to exist on the subclass row. A fighter casts
  // nothing; an eldritch knight casts a third. Reading only the class makes a
  // fighter 12 / wizard 1 caster level 1 instead of 5.
  const thirds = subclasses
    .filter((row) => row.casterProgression === "1/3")
    .map((row) => `${row.name}|${row.source}`)
    .sort();

  assert.deepEqual(thirds, [
    "Arcane Trickster|PHB",
    "Arcane Trickster|XPHB",
    "Eldritch Knight|PHB",
    "Eldritch Knight|XPHB",
  ]);

  assert.equal(findSubclass("Eldritch Knight", "PHB").spellcastingAbility, "int");
  assert.equal(findSubclass("Arcane Trickster", "XPHB").spellcastingAbility, "int");
});

test("every progression is one the rules know how to apply", () => {
  // An unknown code would contribute zero to the caster level, which reads as
  // "this class does not cast" — a wrong answer rather than a missing one.
  for (const row of [...classes, ...subclasses]) {
    assert.ok(
      KNOWN.has(row.casterProgression),
      `${row.name} (${row.source}) advances as "${row.casterProgression}"`,
    );
  }
});
