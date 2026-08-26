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
