import test from "node:test";
import assert from "node:assert/strict";

import {
  getClassFallbackMeta,
  getClassArmorOptionIds,
  getClassWeaponOptionIds,
} from "../dist/index.js";

// Class skill options and background proficiencies moved to the vetools
// index (`packages/vetools-index`, consumed via `skillChoiceForClass` and
// `proficiencyGrantForBackground` in the web app) — see
// docs/CHARACTER-MODEL-GAPS.md findings B and C. Their coverage is asserted
// against the generated data in packages/vetools-index/test instead.

test("builder rules expose equipment availability by class", () => {
  assert.deepEqual(getClassWeaponOptionIds("paladin"), [
    "longsword",
    "warhammer",
    "javelin",
    "light-crossbow",
  ]);
  assert.deepEqual(getClassArmorOptionIds("wizard"), [
    "mage-armor",
    "unarmored",
  ]);
  assert.deepEqual(getClassWeaponOptionIds("unknown-class"), []);
  assert.deepEqual(getClassArmorOptionIds("unknown-class"), []);
});

test("builder rules expose fallback class metadata", () => {
  assert.deepEqual(getClassFallbackMeta("wizard"), {
    hitDie: 6,
    spellcastingAbility: "int",
    casterProgression: "full",
    startingEquipment: ["quarterstaff", "spellbook", "component-pouch", "scholars-pack"],
    primaryAbilities: ["int", "con"],
  });
  assert.equal(getClassFallbackMeta("fighter")?.spellcastingAbility, null);
  assert.equal(getClassFallbackMeta("unknown-class"), undefined);
});
