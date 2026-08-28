/**
 * The spells everything *other than a subclass* grants.
 *
 * 5etools keeps them all in one field, `additionalSpells`, and the builder
 * read it on subclasses alone. Measured across the data: 128 subclasses have
 * one, and so do 66 feats, 54 optional features, 50 subspecies, 30 species,
 * 15 backgrounds and 7 classes. None of those 222 reached a character, which
 * is why a tiefling arrived without Thaumaturgy.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "data");
const load = (name) => JSON.parse(fs.readFileSync(path.join(DATA, `${name}.json`), "utf8"));

const races = load("race");
const subraces = load("subrace");
const feats = load("feat");
const backgrounds = load("background");
const optionalFeatures = load("optionalfeature");

const find = (rows, name, source) =>
  rows.find((row) => row.name === name && (!source || row.source === source));

const withSpells = (rows) => rows.filter((row) => row.spells?.length);

test("every collection that grants spells now says so", () => {
  // The counts are the point: each of these was zero.
  assert.equal(withSpells(races).length, 30);
  assert.equal(withSpells(subraces).length, 50);
  assert.equal(withSpells(feats).length, 66);
  assert.equal(withSpells(backgrounds).length, 15);
  assert.equal(withSpells(optionalFeatures).length, 54);
});

test("the 2024 elf's lineages are readable, because they live nowhere else", () => {
  /*
   * XPHB ships zero subraces. Drow, High Elf and Wood Elf exist in the data
   * only as the names on these blocks, so a 2024 elf could not be built at
   * all until they were read.
   */
  assert.equal(subraces.filter((row) => row.source === "XPHB").length, 0);

  const elf = find(races, "Elf", "XPHB");
  const lineages = [...new Set(elf.spells.map((entry) => entry.variant))];

  assert.deepEqual(lineages, ["Drow", "High Elf", "Wood Elf"]);
});

test("a species gate is a level, and the spells arrive in order", () => {
  const tiefling = find(races, "Tiefling", "PHB");

  assert.deepEqual(
    tiefling.spells.map((entry) => [entry.level, entry.names[0].name]),
    [
      [1, "thaumaturgy"],
      [3, "hellish rebuke"],
      [5, "darkness"],
    ],
  );
});

test("an innate spell says how often it comes back, and how many times", () => {
  const tiefling = find(races, "Tiefling", "PHB");
  const rebuke = tiefling.spells.find((entry) => entry.kind === "innate");

  assert.equal(rebuke.recharge, "daily");
  assert.equal(rebuke.uses, 1);
});

test("the cast level is read off the name rather than left stuck to it", () => {
  // `hellish rebuke#2` is cast as a 2nd-level spell. Left attached, that name
  // resolves to no spell at all.
  const tiefling = find(races, "Tiefling", "PHB");
  const rebuke = tiefling.spells.find((entry) => entry.names[0]?.name === "hellish rebuke");

  assert.equal(rebuke.names[0].castLevel, 2);
});

test("the cantrip marker is dropped, because the catalog knows the level", () => {
  const aasimar = find(races, "Aasimar", "XPHB");
  const light = aasimar.spells.flatMap((entry) => entry.names).find(Boolean);

  assert.equal(light.name, "light");
  // And the book survives, which is the half that matters: two Lights are
  // printed and they are different documents.
  assert.equal(light.source, "xphb");
});

test("the casting ability is kept, fixed or chosen", () => {
  // A species grants its spells with an ability of the player's choice, and
  // that is not the class's — a fighter's species cantrip is not cast with
  // Strength.
  const tiefling = find(races, "Tiefling", "PHB");
  assert.deepEqual(tiefling.spells[0].ability, { fixed: "cha", choose: [] });

  const elf = find(races, "Elf", "XPHB");
  assert.deepEqual(elf.spells[0].ability, { fixed: null, choose: ["int", "wis", "cha"] });
});

test("every entry across every collection is a shape the rules layer can act on", () => {
  const KINDS = new Set(["expanded", "known", "prepared", "innate"]);
  let entries = 0;

  for (const [label, rows] of [
    ["race", races],
    ["subrace", subraces],
    ["feat", feats],
    ["background", backgrounds],
    ["optionalfeature", optionalFeatures],
  ]) {
    for (const row of rows) {
      const where = `${label} ${row.name} (${row.source})`;

      for (const entry of row.spells ?? []) {
        entries += 1;
        assert.ok(KINDS.has(entry.kind), `${where}: kind "${entry.kind}"`);
        // Both gates at once would be two different rules on one entry.
        assert.ok(entry.level === null || entry.spellLevel === null, where);
        assert.ok(
          entry.names.length || entry.filters.length || entry.choices.length,
          `${where}: an empty entry means nothing`,
        );
        for (const ref of entry.names) {
          assert.ok(ref.name.length > 0, where);
          // A marker left on the name is a spell that resolves to nothing.
          assert.ok(!ref.name.includes("#"), `${where}: "${ref.name}" kept its marker`);
        }
        // Uses without a recharge is a limit that never comes back.
        if (entry.uses !== null) assert.ok(entry.recharge, where);
      }
    }
  }

  assert.ok(entries > 300, `only ${entries} entries read`);
});
