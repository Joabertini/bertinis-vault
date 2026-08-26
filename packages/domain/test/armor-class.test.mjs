import test from "node:test";
import assert from "node:assert/strict";

import { activeArmorClassOptions, armorClassFrom, bestArmorClass } from "../dist/index.js";

const option = (over) => ({
  name: "Unarmored Defense",
  source: "PHB",
  level: 1,
  isVariant: false,
  base: 10,
  abilities: ["dex", "con"],
  allowsShield: true,
  requiresNoArmor: true,
  calc: null,
  ...over,
});

const barbarian = option({});
const monk = option({ abilities: ["dex", "wis"], allowsShield: false });
const scales = option({ name: "Natural Armor", base: 13, abilities: ["dex"] });
const shell = option({ name: "Natural Armor", base: 17, abilities: [] });

/** A barbarian who opened 14 Dex, 16 Con — the common shape. */
const modifiers = { str: 3, dex: 2, con: 3, int: -1, wis: 1, cha: 0 };

test("an option is its flat part plus the modifiers it names", () => {
  assert.equal(armorClassFrom(barbarian, modifiers), 15);
  assert.equal(armorClassFrom(monk, modifiers), 13);
  assert.equal(armorClassFrom(shell, modifiers), 17);
});

test("an ability the option names that is not an ability adds nothing", () => {
  // Rather than adding zero silently under a different name: an option built
  // from a misparse should be visibly worth less, not quietly worth the same.
  assert.equal(armorClassFrom(option({ abilities: ["dex", "luck"] }), modifiers), 12);
});

test("Unarmored Defense beats no armour, which is the whole point", () => {
  // This is the bug. `calculateArmorClass` has had the parameter for it since
  // the beginning and nothing passed it, so this barbarian was shown 12.
  const result = bestArmorClass({
    options: [barbarian],
    modifiers,
    wornArmorClass: 12,
    isWearingArmor: false,
    level: 1,
  });

  assert.equal(result.ac, 15);
  assert.equal(result.from?.name, "Unarmored Defense");
});

test("armour switches it off, and the armour wins on its own merits", () => {
  const result = bestArmorClass({
    options: [barbarian],
    modifiers,
    // Half plate: 15 + Dex capped at 2.
    wornArmorClass: 17,
    isWearingArmor: true,
    level: 1,
  });

  assert.equal(result.ac, 17);
  assert.equal(result.from, null);
});

test("the character uses the best of what they have, not the last one found", () => {
  // A lizardfolk barbarian compares 13 + Dex against 10 + Dex + Con. At 18
  // Constitution the rage wins by one; at 16 they are equal and at 12 the
  // scales win.
  const rageWins = bestArmorClass({
    options: [scales, barbarian],
    modifiers: { ...modifiers, con: 4 },
    wornArmorClass: 12,
    isWearingArmor: false,
    level: 1,
  });
  assert.equal(rageWins.ac, 16);
  assert.equal(rageWins.from?.name, "Unarmored Defense");

  const scalesWin = bestArmorClass({
    options: [scales, barbarian],
    modifiers: { ...modifiers, con: 0 },
    wornArmorClass: 12,
    isWearingArmor: false,
    level: 1,
  });
  assert.equal(scalesWin.ac, 15);
  assert.equal(scalesWin.from?.name, "Natural Armor");
});

test("a shield applies to whichever calculation wins", () => {
  const result = bestArmorClass({
    options: [barbarian],
    modifiers,
    wornArmorClass: 12,
    isWearingArmor: false,
    hasShield: true,
    level: 1,
  });

  assert.equal(result.ac, 17);
});

test("a monk holding a shield loses the benefit rather than stacking it", () => {
  // 10 + Dex + 2 rather than 10 + Dex + Wis + 2. This is the one place the
  // builder deliberately disagrees with the Foundry sheet: neither Plutonium
  // nor the dnd5e system excludes the shield, so both would show 15.
  const result = bestArmorClass({
    options: [monk],
    modifiers,
    wornArmorClass: 12,
    isWearingArmor: false,
    hasShield: true,
    level: 1,
  });

  assert.equal(result.ac, 14);
  assert.equal(result.from, null);
});

test("an option earned at a later level is not applied early", () => {
  // The 2024 draconic sorcerer's scales arrive at 3, not 1.
  const later = option({ name: "Draconic Resilience", level: 3, abilities: ["dex", "cha"] });

  assert.deepEqual(activeArmorClassOptions({ options: [later], level: 2 }), []);
  assert.equal(activeArmorClassOptions({ options: [later], level: 3 }).length, 1);
});

test("an optional feature is not applied unless it was taken", () => {
  const variant = option({ name: "Tashas Something", isVariant: true });

  assert.deepEqual(activeArmorClassOptions({ options: [variant], level: 5 }), []);
  assert.equal(
    activeArmorClassOptions({ options: [variant], level: 5, variantsTaken: ["tashas something"] })
      .length,
    1,
  );
});

test("no options at all leaves the worn armour exactly as it was", () => {
  // The common case, and the one that must not change: a wizard in nothing has
  // 10 + Dex and a fighter in plate has 18, both as before.
  const result = bestArmorClass({
    options: [],
    modifiers,
    wornArmorClass: 12,
    isWearingArmor: false,
    level: 20,
  });

  assert.deepEqual(result, { ac: 12, from: null });
});
