/**
 * What a character must already have before a feat is legal.
 *
 * 205 of the 276 feats state something and nothing read any of it, so the
 * builder offered Heavily Armored to a wizard and Elemental Adept to a
 * barbarian. Both are illegal and both would have reached the sheet.
 *
 * Half of what the books state cannot be checked against a build — a Ravenloft
 * campaign, a dragonmark category, "no other dragonmark". These tests pin both
 * halves: that the checkable ones arrived in a checkable shape, and that the
 * rest arrived as text rather than being quietly dropped.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "data");
const feats = JSON.parse(fs.readFileSync(path.join(DATA, "feat.json"), "utf8"));

const find = (name, source) =>
  feats.find((row) => row.name === name && (!source || row.source === source));

const FIELDS = new Set([
  "abilities",
  "level",
  "classLevel",
  "races",
  "backgrounds",
  "feats",
  "features",
  "proficiencies",
  "spellcasting",
  "other",
]);

test("most feats state a prerequisite, which is why ignoring them mattered", () => {
  const stated = feats.filter((row) => row.prerequisites?.length);

  assert.equal(stated.length, 205);
  assert.equal(feats.length, 276);
});

test("an ability minimum arrives as the alternatives it is", () => {
  // [{int:13},{wis:13}] is "Intelligence or Wisdom" — the same shape the
  // multiclass requirement uses, and read by the same function.
  assert.deepEqual(find("Actor", "XPHB").prerequisites, [{ abilities: [{ cha: 13 }], level: 4 }]);

  const either = feats.find((row) =>
    row.prerequisites?.some((entry) => (entry.abilities?.length ?? 0) > 1),
  );
  assert.ok(either, "some feat should offer a choice of ability");
});

test("an armour prerequisite arrives as a proficiency, not as prose", () => {
  assert.deepEqual(find("Heavily Armored", "PHB").prerequisites, [
    { proficiencies: [{ kind: "armor", value: "medium" }] },
  ]);
});

test("the two spellings of a weapon prerequisite become one kind", () => {
  // The data says `weapon` in one place and `weaponGroup` in another, and they
  // mean the same thing. Two kinds would need two checks for one rule.
  const kinds = new Set();

  for (const row of feats) {
    for (const entry of row.prerequisites ?? []) {
      for (const proficiency of entry.proficiencies ?? []) kinds.add(proficiency.kind);
    }
  }

  assert.deepEqual([...kinds].sort(), ["armor", "weapon"]);
});

test("the three spellings of a spellcasting prerequisite become one flag", () => {
  // `spellcasting`, `spellcasting2020` and `spellcastingFeature` all mean the
  // character must cast.
  assert.deepEqual(find("Elemental Adept", "PHB").prerequisites, [{ spellcasting: true }]);

  const casters = feats.filter((row) =>
    row.prerequisites?.some((entry) => entry.spellcasting),
  );
  assert.ok(casters.length > 10, `only ${casters.length} feats require spellcasting`);
});

test("a level in a named class is kept apart from a character level", () => {
  // Treating the second as the first lets a level 3 wizard take a feat that
  // wants a level 3 fighter.
  const classLevels = feats.flatMap((row) =>
    (row.prerequisites ?? []).filter((entry) => entry.classLevel),
  );

  assert.ok(classLevels.length > 0);
  for (const entry of classLevels) {
    assert.ok(entry.classLevel.className.length > 0);
    assert.ok(entry.classLevel.level >= 1);
    assert.equal(entry.level, undefined, "a class level is not a character level");
  }
});

test("a species prerequisite keeps its subrace where the books state one", () => {
  const drow = feats.find((row) =>
    row.prerequisites?.some((entry) => entry.races?.some((race) => race.subrace)),
  );

  assert.ok(drow, "some feat should require a specific subrace");
  const race = drow.prerequisites.flatMap((entry) => entry.races ?? []).find((entry) => entry.subrace);
  assert.equal(race.name, "elf");
});

test("what cannot be checked is kept as text rather than dropped", () => {
  // A silent drop reads as "this feat has no prerequisite", which is false.
  assert.deepEqual(find("Aberrant Dragonmark", "ERLW").prerequisites, [
    { other: ["No other dragonmark"] },
  ]);

  const withNotes = feats.filter((row) => row.prerequisites?.some((entry) => entry.other?.length));
  assert.ok(withNotes.length > 20, `only ${withNotes.length} feats carry an unverifiable note`);
});

test("a campaign requirement is text too, and says which campaign", () => {
  const ravenloft = feats.find((row) =>
    row.prerequisites?.some((entry) => entry.other?.some((note) => note.startsWith("Campaign:"))),
  );

  assert.ok(ravenloft);
  assert.ok(
    ravenloft.prerequisites.some((entry) =>
      entry.other?.some((note) => /^Campaign: \w/.test(note)),
    ),
  );
});

test("no prerequisite carries a field nothing knows how to read", () => {
  // The indexer names ten kinds. An eleventh appearing in a data update should
  // fail here rather than vanish.
  for (const row of feats) {
    for (const entry of row.prerequisites ?? []) {
      for (const key of Object.keys(entry)) {
        assert.ok(FIELDS.has(key), `${row.name} (${row.source}): "${key}"`);
      }
      assert.ok(Object.keys(entry).length > 0, `${row.name}: an empty alternative means nothing`);
    }
  }
});

test("a feat with no prerequisite says so with an empty list", () => {
  // Empty and absent would be the same claim here, and 71 feats make it.
  const open = feats.filter((row) => (row.prerequisites?.length ?? 0) === 0);

  assert.equal(open.length, 71);
  for (const row of open) assert.deepEqual(row.prerequisites, []);
});
