/**
 * The level-up choices, checked against the data they came from.
 *
 * A class names the pools it draws from; an option belongs to a pool by its own
 * `featureType`. Neither half is written down anywhere in this repository, and
 * that is the point — the hand-written table is the thing that has been wrong
 * every time it has been audited. What these tests protect is the *pairing*: a
 * class asking for a pool nothing answers produces an empty picker, and an
 * empty picker looks exactly like a class that has no choice to make.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "data");
const load = (prop) => JSON.parse(fs.readFileSync(path.join(DATA, `${prop}.json`), "utf8"));

const classes = load("class");
const subclasses = load("subclass");
const optionalFeatures = load("optionalfeature");

const granters = [...classes, ...subclasses].filter((row) => row.optionalFeatureProgression.length);

/** Every pool that has at least one option in it. */
const pools = new Set(optionalFeatures.flatMap((row) => row.featureType));

test("the index carries the level-up choices at all", () => {
  assert.ok(optionalFeatures.length > 200, `only ${optionalFeatures.length} optional features`);
  assert.ok(granters.length >= 15, `only ${granters.length} classes and subclasses grant a choice`);
});

test("every pool a class asks for has something in it", () => {
  // The failure this catches is silent: a class offers a choice, the picker
  // comes up empty, and nothing distinguishes that from a class with no choice.
  const unanswered = [];

  for (const row of granters) {
    for (const progression of row.optionalFeatureProgression) {
      for (const type of progression.featureType) {
        if (!pools.has(type)) unanswered.push(`${row.name} (${row.source}) asks for "${type}"`);
      }
    }
  }

  assert.deepEqual(unanswered, []);
});

test("every progression states all twenty levels, and never forgets one", () => {
  // The counts are running totals, not per-level gains. A progression that
  // decreased would mean the character forgot an invocation on level-up, which
  // is a shape error rather than a rule.
  for (const row of granters) {
    for (const progression of row.optionalFeatureProgression) {
      const where = `${row.name} (${row.source}) / ${progression.name}`;

      assert.equal(progression.countByLevel.length, 20, `${where}: not 20 levels`);

      for (const [index, count] of progression.countByLevel.entries()) {
        assert.ok(Number.isInteger(count) && count >= 0, `${where}: level ${index + 1} is ${count}`);
        if (index > 0) {
          assert.ok(
            count >= progression.countByLevel[index - 1],
            `${where}: level ${index + 1} knows fewer than level ${index}`,
          );
        }
      }

      assert.ok(
        progression.countByLevel.at(-1) > 0,
        `${where}: grants nothing at any level, so it should not be here`,
      );
    }
  }
});

test("the counts match the rules, for both shapes and both editions", () => {
  // 5etools states these two ways — a dense array for the warlock and the
  // artificer, a sparse object for everyone else — and the generator flattens
  // both. These are the numbers from the books, checked at the levels the
  // totals change.
  const at = (name, source, type, level) => {
    const row = [...classes, ...subclasses].find((r) => r.name === name && r.source === source);
    assert.ok(row, `no ${name} (${source}) in the index`);
    const progression = row.optionalFeatureProgression.find((p) => p.featureType.includes(type));
    assert.ok(progression, `${name} (${source}) has no "${type}" progression`);
    return progression.countByLevel[level - 1];
  };

  // Warlock invocations, the dense-array shape. 2014: two at 2, growing to
  // eight at 18. 2024 moved the first to level 1 and ends at ten.
  assert.equal(at("Warlock", "PHB", "EI", 1), 0);
  assert.equal(at("Warlock", "PHB", "EI", 2), 2);
  assert.equal(at("Warlock", "PHB", "EI", 5), 3);
  assert.equal(at("Warlock", "PHB", "EI", 20), 8);
  assert.equal(at("Warlock", "XPHB", "EI", 1), 1);
  assert.equal(at("Warlock", "XPHB", "EI", 20), 10);

  // Sorcerer metamagic, the sparse-object shape, and an edition that differs at
  // every step: 2014 gives 2/3/4 at levels 3/10/17, 2024 gives 2/4/6 at 2/10/17.
  assert.equal(at("Sorcerer", "PHB", "MM", 2), 0);
  assert.equal(at("Sorcerer", "PHB", "MM", 3), 2);
  assert.equal(at("Sorcerer", "PHB", "MM", 10), 3);
  assert.equal(at("Sorcerer", "PHB", "MM", 17), 4);
  assert.equal(at("Sorcerer", "XPHB", "MM", 2), 2);
  assert.equal(at("Sorcerer", "XPHB", "MM", 10), 4);
  assert.equal(at("Sorcerer", "XPHB", "MM", 17), 6);

  // A subclass grants on top of its class. Battle Master maneuvers: 3/5/7/9.
  assert.equal(at("Battle Master", "PHB", "MV:B", 2), 0);
  assert.equal(at("Battle Master", "PHB", "MV:B", 3), 3);
  assert.equal(at("Battle Master", "PHB", "MV:B", 7), 5);
  assert.equal(at("Battle Master", "PHB", "MV:B", 15), 9);

  // A fighting style is one pick, held for the rest of the character's life.
  assert.equal(at("Fighter", "PHB", "FS:F", 1), 1);
  assert.equal(at("Fighter", "PHB", "FS:F", 20), 1);
});

test("2024 dropped the paladin's and ranger's fighting style, and the data says so", () => {
  // Fighting styles became feats in 2024. Nothing in this repository encodes
  // that; it shows up as the entry not existing, which is the whole argument
  // for reading progressions out of the data.
  for (const name of ["Paladin", "Ranger"]) {
    const legacy = classes.find((row) => row.name === name && row.source === "PHB");
    const current = classes.find((row) => row.name === name && row.source === "XPHB");

    assert.ok(legacy?.optionalFeatureProgression.length, `2014 ${name} lost its fighting style`);
    assert.equal(current?.optionalFeatureProgression.length, 0, `2024 ${name} regained one`);
  }
});

test("prerequisites are data where they can be, and prose where they cannot", () => {
  const kinds = new Set(
    optionalFeatures.flatMap((row) => row.prerequisites.map((entry) => entry.kind)),
  );

  // The four 5etools states in a form worth checking.
  assert.deepEqual([...kinds].sort(), ["level", "optionalfeature", "pact", "spell"]);

  for (const row of optionalFeatures) {
    for (const entry of row.prerequisites) {
      const where = `${row.name} (${row.source})`;
      if (entry.kind === "level") assert.ok(entry.level >= 1, `${where}: level ${entry.level}`);
      if (entry.kind === "pact") assert.ok(entry.pact, `${where}: empty pact`);
      if (entry.kind === "spell") assert.ok(entry.spell, `${where}: empty spell`);
      if (entry.kind === "optionalfeature") assert.ok(entry.name, `${where}: empty name`);
    }
  }

  // And the two it writes for a person. Dropping them would leave an option
  // looking freely available when it is not.
  const withProse = optionalFeatures.filter((row) => row.prerequisiteText.length);
  assert.ok(withProse.length > 0, "no prose prerequisites survived the build");
  for (const row of withProse) {
    for (const text of row.prerequisiteText) {
      assert.equal(typeof text, "string");
      assert.ok(text.trim().length, `${row.name} (${row.source}): blank prerequisite text`);
    }
  }
});

test("a pact prerequisite names a pact boon that exists", () => {
  // Fifteen invocations require a pact, and the pact itself is an optional
  // feature in the "PB" pool. If the two stopped agreeing, those invocations
  // would be unreachable and nothing would say why.
  const boons = new Set(
    optionalFeatures
      .filter((row) => row.featureType.includes("PB"))
      .map((row) => row.name.replace(/^Pact of the /, "")),
  );

  assert.ok(boons.size >= 3, `only ${boons.size} pact boons`);

  const required = new Set(
    optionalFeatures.flatMap((row) =>
      row.prerequisites.filter((entry) => entry.kind === "pact").map((entry) => entry.pact),
    ),
  );

  assert.ok(required.size > 0, "no invocation requires a pact any more");
  for (const pact of required) {
    assert.ok(boons.has(pact), `an invocation requires the "${pact}" pact, which no boon grants`);
  }
});
