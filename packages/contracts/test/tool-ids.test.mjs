/**
 * The committed tool table, against the two things it was read from.
 *
 * A tool proficiency is a key on `system.tools` and that map has no fixed
 * keys, so a wrong key is not an error — it is a key that gets created, stores
 * the value, and is shown nowhere. The table this replaced had six ids out of
 * forty-four and one of those six named the wrong ability, and every character
 * exported from this builder reached the table with no tool proficiencies at
 * all. Nothing said so.
 *
 * These check the committed file still matches its sources. Point `DND5E_DIR`
 * at an installed dnd5e system and `PLUTONIUM_DIR` at an installed Plutonium
 * to run them; without either they skip, because a game system and 6MB of
 * someone else's bundle do not belong in this repository.
 *
 * The shape tests below run either way — those are about the file itself.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";

import {
  generatedToolsByName,
  toolAbilityFor,
  toolIdFor,
  TOOL_TABLE_SYSTEM_VERSION,
} from "../dist/index.js";

const ABILITIES = new Set(["str", "dex", "con", "int", "wis", "cha"]);

const dnd5ePath = process.env.DND5E_DIR ?? null;
const pluPath = process.env.PLUTONIUM_DIR ?? null;
const sourcesAvailable = Boolean(
  dnd5ePath &&
    existsSync(join(dnd5ePath, "dnd5e.mjs")) &&
    pluPath &&
    existsSync(join(pluPath, "Bundle.js")),
);
const skip = sourcesAvailable
  ? false
  : "set DND5E_DIR and PLUTONIUM_DIR to check the table against its sources";

/** The same brace-counting slice the generator uses, so both read one shape. */
function literalAfter(source, name, context = {}) {
  const at = source.indexOf(name);
  assert.notEqual(at, -1, `no "${name}" in the source — was it renamed?`);

  const open = source.indexOf("{", at);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return vm.runInNewContext(`(${source.slice(open, i + 1)})`, { ...context });
    }
  }
  throw new Error(`unbalanced braces after "${name}"`);
}

const dnd5e = sourcesAvailable ? readFileSync(join(dnd5ePath, "dnd5e.mjs"), "utf8") : "";
const bundle = sourcesAvailable ? readFileSync(join(pluPath, "Bundle.js"), "utf8") : "";

test("every key is one the system actually has", { skip }, () => {
  const tools = literalAfter(dnd5e, "DND5E.tools = {");
  const categories = new Set([...Object.keys(literalAfter(dnd5e, "DND5E.toolTypes = {")), "vehicle"]);
  const vehicles = new Set(Object.keys(literalAfter(dnd5e, "DND5E.vehicleTypes = {")));

  for (const [name, entry] of Object.entries(generatedToolsByName)) {
    const known = entry.id in tools || categories.has(entry.id) || vehicles.has(entry.id);
    assert.ok(known, `"${name}" maps to "${entry.id}", which dnd5e does not have`);
  }
});

test("every ability is the one the system rolls, not one we chose", { skip }, () => {
  const tools = literalAfter(dnd5e, "DND5E.tools = {");

  for (const [name, entry] of Object.entries(generatedToolsByName)) {
    if (entry.kind !== "tool") continue;
    assert.equal(
      entry.ability,
      tools[entry.id].ability,
      `"${name}" rolls ${entry.ability}; dnd5e says ${tools[entry.id].ability}`,
    );
  }
});

test("the table covers every name the importer maps", { skip }, () => {
  const context = {};
  for (const group of ["ARTISAN", "GAMING", "MUSICAL", "VEHICLE"]) {
    context[`VALID_TOOL_PROFICIENCIES__${group}`] = literalAfter(
      bundle,
      `const VALID_TOOL_PROFICIENCIES__${group} = {`,
    );
  }
  const byName = literalAfter(bundle, "const VALID_TOOL_PROFICIENCIES = {", context);

  for (const [name, id] of Object.entries(byName)) {
    assert.equal(
      generatedToolsByName[name]?.id,
      id,
      `"${name}" is missing from the table, or maps somewhere else`,
    );
  }
  assert.equal(Object.keys(generatedToolsByName).length, Object.keys(byName).length);
});

test("the file records which system version it was read from", { skip }, () => {
  const version = JSON.parse(readFileSync(join(dnd5ePath, "system.json"), "utf8")).version;
  assert.equal(
    TOOL_TABLE_SYSTEM_VERSION,
    version,
    "the table was generated from a different dnd5e than the one installed — regenerate it",
  );
});

test("the table is not the six-entry stub it replaced", () => {
  // A number rather than "more than zero": the hand-written table had six, and
  // a regeneration that quietly produced a handful should fail rather than
  // ship a builder that drops most tool proficiencies again.
  const count = Object.keys(generatedToolsByName).length;
  assert.ok(count >= 40, `only ${count} tools in the table`);
});

test("a category carries no ability, and a tool carries a real one", () => {
  for (const [name, entry] of Object.entries(generatedToolsByName)) {
    if (entry.kind === "category") {
      // Artisan's tools spans seventeen tools across four abilities. Naming
      // one would be a number nobody in the rules chose.
      assert.equal(entry.ability, undefined, `"${name}" is a category with an ability`);
      continue;
    }

    assert.equal(entry.kind, "tool", `"${name}" has an unknown kind`);
    assert.ok(ABILITIES.has(entry.ability), `"${name}" rolls "${entry.ability}"`);
  }
});

test("the names a player types resolve to the system's keys", () => {
  assert.equal(toolIdFor("Thieves' Tools"), "thief");
  // The apostrophe is the point: a player types it or does not, and both are
  // the same proficiency.
  assert.equal(toolIdFor("thieves tools"), "thief");
  assert.equal(toolIdFor("Smith's Tools"), "smith");
  assert.equal(toolIdFor("smiths tools"), "smith");

  // Names with no word "tool" in them at all. These used to be classified as
  // "other" and dropped.
  assert.equal(toolIdFor("Bagpipes"), "bagpipes");
  assert.equal(toolIdFor("Dice Set"), "dice");
  assert.equal(toolIdFor("Pan Flute"), "panflute");

  assert.equal(toolIdFor("tool: Herbalism Kit"), "herb");
  assert.equal(toolIdFor("Vehicles (Land)"), "land");
});

test("a key that is already a key comes back unchanged", () => {
  assert.equal(toolIdFor("thief"), "thief");
  assert.equal(toolIdFor("panflute"), "panflute");
});

test("a name that is not a tool resolves to nothing", () => {
  // Dropping is the honest answer: a key we cannot resolve would be written to
  // a path the sheet never reads.
  assert.equal(toolIdFor("Longsword"), null);
  assert.equal(toolIdFor(""), null);
});

test("the ability lookup answers by key, and says nothing for a category", () => {
  assert.equal(toolAbilityFor("thief"), "dex");
  assert.equal(toolAbilityFor("lute"), "cha");
  // The old hand-written table said the herbalism kit rolled Wisdom. It rolls
  // Intelligence, and that was one of only six entries it had.
  assert.equal(toolAbilityFor("herb"), "int");
  assert.equal(toolAbilityFor("art"), null);
  assert.equal(toolAbilityFor("nonsense"), null);
});
