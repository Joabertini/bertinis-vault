import test from "node:test";
import assert from "node:assert/strict";

import { getClassFallbackMeta } from "../dist/index.js";

// Class skill options and background proficiencies moved to the vetools
// index (`packages/vetools-index`, consumed via `skillChoiceForClass` and
// `proficiencyGrantForBackground` in the web app) — see
// docs/CHARACTER-MODEL-GAPS.md findings B and C. Their coverage is asserted
// against the generated data in packages/vetools-index/test instead.
//
// Weapon and armour option lists (finding D) are gone the same way: both
// pickers search the full item index directly, unfiltered by class, and let
// Plutonium's class-document import grant the real proficiency regardless of
// what was picked here. `getClassWeaponOptionIds`/`getClassArmorOptionIds`
// had gone unused since the weapon picker moved to the index; the armour
// picker's own leftover restriction was silently reverting any pick outside
// its three-item shortlist, which is the bug this closed.

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
