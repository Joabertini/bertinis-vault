/**
 * What a character must have before taking a level in a class.
 *
 * The two editions state this in different fields and are read two different
 * ways: 2014 gives each class a `multiclassing.requirements` block, and 2024
 * dropped it because the rule became uniform — 13 in the class's primary
 * ability — so it comes off `primaryAbility` instead. That they agree is the
 * evidence both were read correctly, and is the first test here.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "data");
const classes = JSON.parse(fs.readFileSync(path.join(DATA, "class.json"), "utf8"));

const findClass = (name, source) => classes.find((r) => r.name === name && r.source === source);

test("both editions state the multiclass requirement, and agree", () => {
  // 2014 states it per class under `multiclassing.requirements`. 2024 dropped
  // that block because the rule became uniform — 13 in the class's primary
  // ability — so it is read from `primaryAbility` instead. Two different
  // fields, read two different ways, reaching the same answer is the evidence
  // that both were read correctly.
  for (const row of classes.filter((r) => r.source === "PHB")) {
    const modern = classes.find((r) => r.name === row.name && r.source === "XPHB");
    if (!modern) continue;

    assert.deepEqual(
      modern.multiclassRequirements,
      row.multiclassRequirements,
      `${row.name} asks for different things in each edition`,
    );
  }
});

test("the fighter is the only class whose requirement is a choice", () => {
  // Strength *or* Dexterity. Inside 5etools' `or` block the keys are
  // alternatives, which is the opposite of how the same shape reads at the top
  // level — the monk's `{dex, wis}` means both. One class is thin evidence for
  // a rule; it is also all the data has, so the build fails on anything that
  // does not fit rather than guessing.
  const choices = classes.filter((row) => row.multiclassRequirements.length > 1);

  assert.deepEqual(
    choices.map((row) => `${row.name}|${row.source}`).sort(),
    ["Fighter|PHB", "Fighter|XPHB"],
  );
  assert.deepEqual(findClass("Fighter", "PHB").multiclassRequirements, [{ str: 13 }, { dex: 13 }]);
});

test("a requirement naming two abilities needs both", () => {
  assert.deepEqual(findClass("Monk", "PHB").multiclassRequirements, [{ dex: 13, wis: 13 }]);
  assert.deepEqual(findClass("Paladin", "XPHB").multiclassRequirements, [{ str: 13, cha: 13 }]);
});

test("every requirement asks for a real ability and a real score", () => {
  const ABILITIES = new Set(["str", "dex", "con", "int", "wis", "cha"]);

  for (const row of classes) {
    for (const option of row.multiclassRequirements) {
      for (const [ability, score] of Object.entries(option)) {
        assert.ok(ABILITIES.has(ability), `${row.name} requires "${ability}"`);
        assert.ok(score >= 3 && score <= 20, `${row.name} requires ${score} in ${ability}`);
      }
    }
  }
});

test("a second class grants less than a first one does", () => {
  // The whole point. A rogue's first level gives four skills and thieves'
  // tools; a rogue level taken second gives one skill and thieves' tools.
  // Reading the starting list for both hands a dipping character three skills
  // they never chose.
  const rogue = findClass("Rogue", "PHB");

  assert.equal(rogue.skillChoice.count, 4);
  assert.equal(rogue.multiclassGrants.skillChoice.count, 1);
  assert.deepEqual(rogue.multiclassGrants.tools, ["Thieves' Tools"]);
  assert.deepEqual(rogue.multiclassGrants.armor, ["light"]);
});

test("a class that grants nothing on multiclassing says so", () => {
  // The wizard and the sorcerer hand over no proficiency at all, and the 2024
  // monk states no block. Null is not the same as an empty grant, and neither
  // is the same as "we did not look".
  assert.equal(findClass("Wizard", "PHB").multiclassGrants, null);
  assert.equal(findClass("Sorcerer", "PHB").multiclassGrants, null);
  assert.equal(findClass("Monk", "XPHB").multiclassGrants, null);
});

test("the editions differ in what a second class gives, and the index keeps them apart", () => {
  // 2024 narrowed several classes from "simple and martial" to "martial", and
  // gave the druid a shorter armour list.
  assert.deepEqual(findClass("Fighter", "PHB").multiclassGrants.weapons, ["simple", "martial"]);
  assert.deepEqual(findClass("Fighter", "XPHB").multiclassGrants.weapons, ["martial"]);

  assert.deepEqual(findClass("Druid", "PHB").multiclassGrants.armor, ["light", "medium", "shield"]);
  assert.deepEqual(findClass("Druid", "XPHB").multiclassGrants.armor, ["light", "shield"]);
});

test("a named weapon survives being a tag", () => {
  // The 2014 monk grants simple weapons and shortswords specifically, written
  // as `{@item shortsword|phb|shortswords}`.
  assert.deepEqual(findClass("Monk", "PHB").multiclassGrants.weapons, ["simple", "shortsword"]);
});

test("a tool written as a sentence is read as the choice it is", () => {
  // "one musical instrument of your choice" in 2014 and "Choose one Musical
  // Instrument" in 2024 are the same instruction. What is left after the
  // instruction is the category, which the tool table resolves to `music`.
  assert.deepEqual(findClass("Bard", "PHB").multiclassGrants.tools, []);
  assert.equal(findClass("Bard", "PHB").multiclassGrants.toolChoice, "musical instrument");
  assert.equal(findClass("Bard", "XPHB").multiclassGrants.toolChoice, "Musical Instrument");
});

test("an apostrophe does not become a capital letter", () => {
  // `\b[a-z]` treats an apostrophe as a word boundary, which turned "tinker's
  // tools" into "Tinker'S Tools" — and had been doing the same to background
  // tool grants since before any of this.
  assert.deepEqual(findClass("Artificer", "TCE").multiclassGrants.tools, [
    "Thieves' Tools",
    "Tinker's Tools",
  ]);
});

test("every grant is a shape the builder can offer", () => {
  const ARMOR = new Set(["light", "medium", "heavy", "shield"]);

  for (const row of classes) {
    const grants = row.multiclassGrants;
    if (!grants) continue;
    const where = `${row.name} (${row.source})`;

    for (const armor of grants.armor) {
      assert.ok(ARMOR.has(armor), `${where}: grants "${armor}" armour`);
    }
    if (grants.skillChoice) {
      assert.ok(grants.skillChoice.count >= 1, where);
      assert.ok(grants.skillChoice.count <= grants.skillChoice.options.length, where);
    }
    for (const tool of grants.tools) {
      assert.ok(!/choose|of your choice/i.test(tool), `${where}: "${tool}" is a sentence, not a tool`);
    }
  }
});
