/**
 * What the index says a feat raises, against what the feats say.
 *
 * The rule this protects is the one the builder was silently breaking: 159 of
 * the 276 feats grant an ability increase, and a feat choice that stores only
 * an id loses it. These check the shape survived the build, and that the one
 * genuinely different case stayed different.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "data");
const feats = JSON.parse(fs.readFileSync(path.join(DATA, "feat.json"), "utf8"));

const find = (name, source) => feats.find((row) => row.name === name && row.source === source);

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];

test("most of the feats raise something, and the index says which", () => {
  const raising = feats.filter((row) => row.ability.length);

  // A number rather than "more than zero": if a build ever drops this to a
  // handful, the field has quietly stopped being read.
  assert.ok(raising.length > 140, `only ${raising.length} feats carry an ability increase`);
});

test("a half-feat's pool is the pool the book gives it", () => {
  assert.deepEqual(find("Fey Touched", "TCE").ability, [
    { kind: "choice", from: ["int", "wis", "cha"], amount: 1, count: 1 },
  ]);

  assert.deepEqual(find("Athlete", "PHB").ability, [
    { kind: "choice", from: ["str", "dex"], amount: 1, count: 1 },
  ]);

  assert.deepEqual(find("Resilient", "PHB").ability, [
    { kind: "choice", from: ABILITIES, amount: 1, count: 1 },
  ]);
});

test("a feat that raises nothing carries nothing", () => {
  // Tough gives hit points, not a score. An empty list here is the difference
  // between "no question to ask" and "a question nobody asked".
  assert.deepEqual(find("Tough", "PHB").ability, []);
  assert.equal(find("Tough", "PHB").isAbilityScoreImprovement, 0);
});

test("the 2024 improvement is a feat, and is not treated as a half-feat", () => {
  // This is the only entity in the data whose `ability` is marked hidden, and
  // it is marked hidden because it *is* the improvement rather than a bonus
  // riding alongside one. Offering it as a half-feat pool would ask the player
  // the same question twice.
  const asi = find("Ability Score Improvement", "XPHB");

  assert.ok(asi, "the 2024 Ability Score Improvement feat is gone");
  assert.equal(asi.isAbilityScoreImprovement, 1);
  assert.deepEqual(asi.ability, []);

  const flagged = feats.filter((row) => row.isAbilityScoreImprovement);
  assert.equal(flagged.length, 1, "more than one feat now claims to be the improvement");
});

test("every grant is a shape the rules can be applied to", () => {
  for (const row of feats) {
    for (const grant of row.ability) {
      const where = `${row.name} (${row.source})`;

      if (grant.kind === "fixed") {
        assert.ok(Object.keys(grant.bonuses).length, `${where}: a fixed grant that raises nothing`);
        for (const [ability, amount] of Object.entries(grant.bonuses)) {
          assert.ok(ABILITIES.includes(ability), `${where}: raises "${ability}"`);
          assert.ok(Number.isInteger(amount) && amount > 0, `${where}: ${ability} by ${amount}`);
        }
        continue;
      }

      assert.equal(grant.kind, "choice", `${where}: unknown grant kind "${grant.kind}"`);
      assert.ok(grant.from.length, `${where}: a choice with nothing to choose from`);
      for (const ability of grant.from) {
        assert.ok(ABILITIES.includes(ability), `${where}: offers "${ability}"`);
      }
      assert.ok(grant.amount >= 1, `${where}: amount ${grant.amount}`);
      assert.ok(grant.count >= 1, `${where}: count ${grant.count}`);
      assert.ok(grant.count <= grant.from.length, `${where}: picks more than it offers`);
    }
  }
});
