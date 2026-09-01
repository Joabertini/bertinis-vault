/**
 * Which class features a character is handed, checked against the real data.
 *
 * The rule under test is one line, and getting it wrong is invisible on the
 * sheet: Tasha's optional features look exactly like ordinary ones. A wizard
 * was arriving with Cantrip Formulas nobody chose, and a cleric would have
 * arrived with twenty features it never picked.
 *
 * These read a Plutonium install's `data/class` rather than a fixture, because
 * a fixture would record what we believed the data said. Point `PLUTONIUM_DIR`
 * at the directory holding `Bundle.js`; without it they skip.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { collectFeatures } from "../src/plutonium.js";

const classDir = process.env.PLUTONIUM_DIR ? join(process.env.PLUTONIUM_DIR, "data", "class") : null;
const available = Boolean(classDir && existsSync(classDir));
const skip = available ? false : "set PLUTONIUM_DIR to the directory holding Bundle.js";

/** Every class and subclass feature in the data, flat. */
function allFeatures() {
  const features = [];
  for (const file of readdirSync(classDir).filter(name => name.endsWith(".json"))) {
    const parsed = JSON.parse(readFileSync(join(classDir, file), "utf8"));
    features.push(...(parsed.classFeature ?? []), ...(parsed.subclassFeature ?? []));
  }
  return features;
}

/**
 * `collectFeatures` takes the shape `DataLoader` leaves — a list of lists — so
 * a single feature is wrapped to match, and asked for at a level that cannot
 * exclude it.
 */
function granted(feature) {
  const entity = { classFeatures: [[feature]] };
  return collectFeatures({ entity, prop: "class", level: 20 }).length > 0;
}

test("no optional class feature is handed over unasked", { skip }, () => {
  const variants = allFeatures().filter(feature => feature.isClassFeatureVariant);

  assert.ok(variants.length > 0, "the data should carry variants; check the path");

  const handedOver = variants.filter(granted).map(feature => `${feature.className}: ${feature.name}`);

  assert.deepEqual(
    handedOver,
    [],
    `${handedOver.length} optional features would be granted without being chosen`,
  );
});

test("Cantrip Formulas is not granted to a wizard", { skip }, () => {
  const feature = allFeatures().find(entry => entry.name === "Cantrip Formulas");

  assert.ok(feature, "Cantrip Formulas should exist in the data");
  assert.equal(feature.isClassFeatureVariant, true);
  assert.equal(granted(feature), false);
});

test("ordinary features are still granted", { skip }, () => {
  const features = allFeatures();

  for (const name of ["Arcane Recovery", "Spellcasting", "Divine Smite", "Extra Attack"]) {
    const feature = features.find(entry => entry.name === name);
    assert.ok(feature, `${name} should exist in the data`);
    assert.equal(granted(feature), true, `${name} should reach the sheet`);
  }
});

test("Ability Score Improvement stays out, and is not flagged as a variant", { skip }, () => {
  const entries = allFeatures().filter(entry => entry.name === "Ability Score Improvement");

  assert.ok(entries.length > 100, "the data should carry one per class per level");

  // The reason the name is hardcoded: nothing in the data distinguishes these.
  assert.equal(
    entries.some(entry => entry.isClassFeatureVariant),
    false,
    "if these ever gain the flag, drop the name from SCAFFOLDING_FEATURE_NAMES",
  );
  assert.equal(entries.filter(granted).length, 0);
});

test("a level filters what a character has reached", { skip }, () => {
  const entity = {
    classFeatures: [
      [{ name: "Early", level: 1 }],
      [{ name: "Later", level: 6 }],
    ],
  };

  const atThree = collectFeatures({ entity, prop: "class", level: 3 }).map(f => f.name);

  assert.deepEqual(atThree, ["Early"]);
});
