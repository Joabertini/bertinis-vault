/**
 * Where a character's ability increase comes from, which the editions disagree
 * about more sharply than anything else at level one.
 *
 * 2014 puts it on the species: a mountain dwarf is +2 Strength and +2
 * Constitution whoever they are. 2024 moved it to the background, and the ten
 * 2024 species grant none at all. A builder that reads only the species — as
 * this one did — leaves every 2024 character three points short, and nothing
 * says so, because a 16 is a perfectly plausible score.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "data");
const backgrounds = JSON.parse(fs.readFileSync(path.join(DATA, "background.json"), "utf8"));
const races = JSON.parse(fs.readFileSync(path.join(DATA, "race.json"), "utf8"));

const find = (name, source) => backgrounds.find((r) => r.name === name && r.source === source);

test("a 2024 species grants no ability increase, and a 2014 one does", () => {
  // This is the pair of facts the whole rule rests on. If a 2024 species
  // carried a bonus too, applying the background's would double-count it.
  const modern = races.filter((row) => row.source === "XPHB");

  assert.equal(modern.length, 10);
  for (const row of modern) {
    assert.equal(row.ability, null, row.name);
  }

  assert.deepEqual(races.find((row) => row.name === "Dwarf" && row.source === "PHB")?.ability, {
    con: 2,
  });
});

test("a 2024 background grants it instead", () => {
  assert.deepEqual(find("Acolyte", "XPHB").abilityChoice, [
    { options: ["int", "wis", "cha"], amounts: [2, 1] },
    { options: ["int", "wis", "cha"], amounts: [1, 1, 1] },
  ]);
});

test("the same background in 2014 grants none", () => {
  // Acolyte exists in both editions, and only one of them raises anything.
  assert.equal(find("Acolyte", "PHB").abilityChoice, null);
});

test("every background that grants one offers exactly two ways to spend it", () => {
  const withChoice = backgrounds.filter((row) => row.abilityChoice);

  assert.equal(withChoice.length, 60);
  for (const row of withChoice) {
    assert.equal(row.abilityChoice.length, 2, `${row.name} (${row.source})`);
  }
});

test("both ways are worth the same three points", () => {
  // If one alternative were worth more the choice would not be a choice, and
  // a builder could quietly favour it.
  for (const row of backgrounds) {
    if (!row.abilityChoice) continue;
    const where = `${row.name} (${row.source})`;

    for (const option of row.abilityChoice) {
      const spent = option.amounts.reduce((total, amount) => total + amount, 0);
      assert.equal(spent, 3, `${where}: ${option.amounts.join("/")}`);
      assert.equal(option.options.length, 3, where);
      assert.ok(option.amounts.length <= option.options.length, where);
    }
  }
});

test("the two ways are always the same two: +2/+1, or +1 three times", () => {
  const shapes = new Set();

  for (const row of backgrounds) {
    for (const option of row.abilityChoice ?? []) shapes.add(option.amounts.join("/"));
  }

  assert.deepEqual([...shapes].sort(), ["1/1/1", "2/1"]);
});

test("no 2014 background raises anything", () => {
  // The rule is an edition boundary, not a per-book one. Applying a background
  // bonus in 2014 as well would hand the character three points too many.
  const legacy = backgrounds.filter((row) => row.source === "PHB" || row.source === "SCAG");

  assert.ok(legacy.length > 20);
  for (const row of legacy) {
    assert.equal(row.abilityChoice, null, `${row.name} (${row.source})`);
  }
});

test("the abilities offered differ by background, so the choice means something", () => {
  // The acolyte offers the three mental abilities; the soldier offers strength
  // and dexterity. A table shared across backgrounds would be wrong for both.
  assert.deepEqual(find("Acolyte", "XPHB").abilityChoice[0].options, ["int", "wis", "cha"]);
  assert.deepEqual(find("Soldier", "XPHB").abilityChoice[0].options, ["str", "dex", "con"]);
});
