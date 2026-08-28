/**
 * The skills and tools a species grants.
 *
 * 77 of the 258 species rows in the data grant a skill and 14 grant a tool,
 * and not one of them reached a character: the half-orc's Intimidation, the
 * elf's choice of three, the 2024 human's free skill and the 2014 dwarf's
 * three artisan's tools were all read off the page and typed in by hand, or
 * lost.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "data");
const read = (name) => JSON.parse(fs.readFileSync(path.join(DATA, name), "utf8"));
const races = read("race.json");
const subraces = read("subrace.json");
const all = [...races, ...subraces];

const find = (name, source) =>
  all.find((row) => row.name === name && (!source || row.source === source));

test("a species that grants a skill outright says so, with nothing to ask", () => {
  const halfOrc = find("Half-Orc", "PHB");

  assert.deepEqual(halfOrc.speciesProficiencies.skills.granted, ["Intimidation"]);
  assert.deepEqual(halfOrc.speciesProficiencies.skills.choices, []);
});

test("a bounded choice keeps its list and its count", () => {
  // The 2024 elf picks one of three, which is a question and not a grant.
  const elf = find("Elf", "XPHB");

  assert.deepEqual(elf.speciesProficiencies.skills.choices, [
    { options: ["Insight", "Perception", "Survival"], count: 1, scope: null },
  ]);
});

test("a tool choice is kept apart from a skill choice", () => {
  // The 2014 dwarf picks one of three artisan's tools. Folding it in with the
  // skills would offer the pick under a heading that reads as a bug.
  const dwarf = find("Dwarf", "PHB");

  assert.deepEqual(dwarf.speciesProficiencies.tools.choices, [
    { options: ["Smith's Tools", "Brewer's Supplies", "Mason's Tools"], count: 1, scope: null },
  ]);
  assert.deepEqual(dwarf.speciesProficiencies.skills.choices, []);
});

test("a choice the data states as a kind carries the kind and no list", () => {
  // "Any musical instrument" has no list in the data, and writing one here
  // would be writing a rule the book does not print.
  const satyr = find("Satyr", "MOT");

  assert.deepEqual(satyr.speciesProficiencies.tools.choices, [
    { options: [], count: 1, scope: "instrument" },
  ]);
  assert.deepEqual(satyr.speciesProficiencies.skills.granted, ["Performance", "Persuasion"]);
});

test("any skill is a scope and not an empty list", () => {
  // The 2024 human's free skill. An empty `options` with no scope would read
  // as "nothing to choose" instead of "anything".
  const human = find("Human", "XPHB");

  assert.deepEqual(human.speciesProficiencies.skills.choices, [
    { options: [], count: 1, scope: "any" },
  ]);
});

test("the gear grants are still there beside them", () => {
  // The same field carries both, so a species with only a skill is no longer
  // dropped for having no weapons — and one with only weapons keeps them.
  const dwarf = find("Dwarf", "PHB");

  assert.deepEqual(dwarf.speciesProficiencies.weaponItems, [
    "battleaxe",
    "handaxe",
    "light hammer",
    "warhammer",
  ]);
});

test("every row is a shape the rules layer can act on", () => {
  const scopes = new Set([null, "any", "artisan", "instrument"]);
  let granting = 0;

  for (const row of all) {
    const grant = row.speciesProficiencies;
    if (!grant) continue;

    for (const kind of ["skills", "tools"]) {
      assert.ok(Array.isArray(grant[kind].granted), `${row.name}: ${kind}.granted`);
      for (const choice of grant[kind].choices) {
        assert.ok(choice.count >= 1, `${row.name}: ${kind} count`);
        assert.ok(scopes.has(choice.scope), `${row.name}: scope ${choice.scope}`);
        // A choice with neither a list nor a kind is a question with no answer.
        assert.ok(choice.options.length > 0 || choice.scope !== null, `${row.name}: ${kind} empty`);
        assert.ok(choice.options.length === 0 || choice.options.length >= choice.count, row.name);
      }
      if (grant[kind].granted.length || grant[kind].choices.length) granting += 1;
    }
  }

  assert.ok(granting > 80, `only ${granting} rows grant a skill or a tool`);
});
