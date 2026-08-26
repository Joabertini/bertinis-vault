/**
 * What the index says a character's armour class can be, against the books.
 *
 * This one is parsed out of English, which makes it the most fragile thing in
 * the index and the one most worth pinning. There is no structured form for
 * the barbarian, the monk or the 2024 dancing bard: 5etools' Foundry companion
 * file records an `ac.calc` override for the sorcerer and six species and
 * nothing at all for those three, which lean on the game system's own SRD
 * class items. Plutonium reads the prose for the same reason.
 *
 * Two readings the parse could get wrong, both checked below: the flat part is
 * not always 10, and the shield clause is not the same for every feature.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "data");
const read = (name) => JSON.parse(fs.readFileSync(path.join(DATA, `${name}.json`), "utf8"));

const classes = read("class");
const subclasses = read("subclass");
const races = read("race");

const findClass = (name, source) => classes.find((r) => r.name === name && r.source === source);
const findSubclass = (name, source) =>
  subclasses.find((r) => r.name === name && r.source === source);
const findRace = (name, source) => races.find((r) => r.name === name && r.source === source);

const ABILITIES = new Set(["str", "dex", "con", "int", "wis", "cha"]);

test("the classes with Unarmored Defense are the two that have always had it", () => {
  const granting = classes
    .filter((row) => row.armorClass.length)
    .map((row) => `${row.name}|${row.source}`)
    .sort();

  assert.deepEqual(granting, ["Barbarian|PHB", "Barbarian|XPHB", "Monk|PHB", "Monk|XPHB"]);
});

test("the barbarian adds Constitution and the monk adds Wisdom", () => {
  assert.deepEqual(findClass("Barbarian", "PHB").armorClass, [
    {
      name: "Unarmored Defense",
      source: "PHB",
      level: 1,
      isVariant: false,
      calc: null,
      base: 10,
      abilities: ["dex", "con"],
      allowsShield: true,
      requiresNoArmor: true,
    },
  ]);

  const monk = findClass("Monk", "PHB").armorClass[0];
  assert.deepEqual(monk.abilities, ["dex", "wis"]);
});

test("the shield clause is read, and it is not the same clause", () => {
  // The barbarian "can use a shield and still gain this benefit". The monk's
  // applies only "while you are wearing no armor and not wielding a shield".
  // Neither Plutonium nor the dnd5e system models the difference — both add
  // the shield to a monk's total anyway.
  assert.equal(findClass("Barbarian", "PHB").armorClass[0].allowsShield, true);
  assert.equal(findClass("Barbarian", "XPHB").armorClass[0].allowsShield, true);
  assert.equal(findClass("Monk", "PHB").armorClass[0].allowsShield, false);
  assert.equal(findClass("Monk", "XPHB").armorClass[0].allowsShield, false);
});

test("both prose shapes are read the same way", () => {
  // 2014: "10 + your Dexterity modifier + your Constitution modifier"
  // 2024: "10 plus your Dexterity and Constitution modifiers"
  // The wording changed between editions and the formula did not.
  assert.deepEqual(
    findClass("Barbarian", "PHB").armorClass[0].abilities,
    findClass("Barbarian", "XPHB").armorClass[0].abilities,
  );
  assert.equal(findClass("Barbarian", "XPHB").armorClass[0].base, 10);
});

test("the flat part is read, not assumed to be ten", () => {
  // The 2014 draconic sorcerer's scales are 13 + Dexterity. Plutonium hardcodes
  // 10 here and gets away with it only because this feature also carries a
  // named `ac.calc` for it to fall back on. Nothing would catch the mistake on
  // a feature that did not.
  const draconic = findSubclass("Draconic Bloodline", "PHB").armorClass[0];

  assert.equal(draconic.base, 13);
  assert.deepEqual(draconic.abilities, ["dex"]);
  assert.equal(draconic.calc, "draconic");
});

test("2024 changed the draconic sorcerer's scales, and the index says so", () => {
  // 10 plus Dexterity and Charisma, at level 3 rather than 1. The `calc` is
  // dnd5e's `unarmoredBard` because that is the same formula, not a mislabel.
  const draconic = findSubclass("Draconic Sorcery", "XPHB").armorClass[0];

  assert.equal(draconic.level, 3);
  assert.equal(draconic.base, 10);
  assert.deepEqual(draconic.abilities, ["dex", "cha"]);
  assert.equal(draconic.calc, "unarmoredBard");
});

test("the 2024 bard's condition comes from its name when the text omits it", () => {
  // College of Dance states the formula and no condition: "Your base Armor
  // Class equals 10 plus your Dexterity and Charisma modifiers." The condition
  // is in the feature's name, which is data too. A bard who kept this in plate
  // would be shown an armour class it does not have.
  const dance = findSubclass("College of Dance", "XPHB").armorClass[0];

  assert.equal(dance.name, "Unarmored Defense");
  assert.deepEqual(dance.abilities, ["dex", "cha"]);
  assert.equal(dance.requiresNoArmor, true);
});

test("natural armour is read from the formula, not from the prose", () => {
  // Species record theirs as a Foundry formula. Parsing English when a
  // machine-readable form exists would be choosing the worse source.
  assert.equal(findRace("Tortle", "TTP").armorClass[0].base, 17);
  assert.deepEqual(findRace("Tortle", "TTP").armorClass[0].abilities, []);

  assert.equal(findRace("Lizardfolk", "VGM").armorClass[0].base, 13);
  assert.deepEqual(findRace("Lizardfolk", "VGM").armorClass[0].abilities, ["dex"]);

  // The loxodon's hide is the only one that is not Dexterity.
  assert.deepEqual(findRace("Loxodon", "GGR").armorClass[0].abilities, ["con"]);
});

test("a species' natural armour never excludes a shield", () => {
  // The tortle's shell and the lizardfolk's scales both say a shield applies
  // as normal, and no species contradicts that.
  for (const race of races.filter((row) => row.armorClass.length)) {
    for (const option of race.armorClass) {
      assert.equal(option.allowsShield, true, `${race.name} excludes a shield`);
    }
  }
});

test("the species with natural armour are the five the join reaches", () => {
  const granting = races
    .filter((row) => row.armorClass.length)
    .map((row) => `${row.name}|${row.source}`)
    .sort();

  // Zendikar's Grotag goblin is deliberately absent. Its companion entry is
  // filed under "Goblin (Zendikar; Grotag Tribe)" while the species itself is
  // just "Goblin", and matching loosely would hand 11 + Dexterity to every
  // Zendikar goblin rather than the one tribe that has it.
  assert.deepEqual(granting, [
    "Autognome|AAG",
    "Lizardfolk|VGM",
    "Locathah|LR",
    "Loxodon|GGR",
    "Tortle|TTP",
  ]);
});

test("every option is a shape the rules can be applied to", () => {
  const options = [
    ...classes.flatMap((row) => row.armorClass),
    ...subclasses.flatMap((row) => row.armorClass),
    ...races.flatMap((row) => row.armorClass),
  ];

  // Four class features, three subclass features, five species.
  assert.equal(options.length, 12);

  for (const option of options) {
    const where = `${option.name} (${option.source})`;

    assert.ok(Number.isInteger(option.base) && option.base >= 10, `${where}: base ${option.base}`);
    // A base above 18 would beat plate, which nothing in the rules does except
    // the tortle's shell — and that is exactly 17.
    assert.ok(option.base <= 17, `${where}: base ${option.base}`);

    for (const ability of option.abilities) {
      assert.ok(ABILITIES.has(ability), `${where}: adds "${ability}"`);
    }
    assert.ok(option.abilities.length <= 2, `${where}: adds ${option.abilities.length} modifiers`);

    assert.equal(typeof option.allowsShield, "boolean", where);
    // Every one of these replaces armour rather than adding to it, so wearing
    // armour switches all of them off. One that did not would be a new rule,
    // and this is where it would show up.
    assert.equal(option.requiresNoArmor, true, `${where}: applies while wearing armour`);
  }
});
