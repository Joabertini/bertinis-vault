/**
 * What a character starts with, as the choice it actually is.
 *
 * The builder read the prose form — "(a) a rapier or (b) a shortsword" — which
 * is a sentence and cannot be offered as a choice, so equipment was a fixed
 * list and the player never picked. 5etools carries the same list a second
 * time in structured form; these tests pin that it was read, and read whole.
 *
 * The shapes worth pinning are the ones that are easy to lose: a quantity, a
 * category ("any simple weapon") standing in for an item, coins as an
 * alternative to the entire list, and the wizard's spellbook, which has no
 * item entry to point at.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "data");
const classes = JSON.parse(fs.readFileSync(path.join(DATA, "class.json"), "utf8"));
const backgrounds = JSON.parse(fs.readFileSync(path.join(DATA, "background.json"), "utf8"));

const findClass = (name, source) => classes.find((r) => r.name === name && r.source === source);
const findBackground = (name, source) =>
  backgrounds.find((r) => r.name === name && r.source === source);

const KINDS = new Set(["item", "category", "coins", "special"]);

test("the rogue's list is four questions, not one list", () => {
  // The whole point. 2014 divides the list into rows and asks about each one:
  // a rapier or a shortsword, a bow or a second shortsword, one of three
  // packs, and then a row that is simply granted.
  const rows = findClass("Rogue", "PHB").startingEquipment.rows;

  assert.equal(rows.length, 4);
  assert.deepEqual(
    rows.map((row) => row.options.map((option) => option.key)),
    [["a", "b"], ["a", "b"], ["a", "b", "c"], ["_"]],
  );
  assert.deepEqual(rows.map((row) => row.fixed), [false, false, false, true]);
});

test("a quantity survives", () => {
  // "two daggers" is one entry with a quantity, and a list that drops it hands
  // the character one dagger. Everything else is quantity one and says so by
  // leaving the field out.
  const granted = findClass("Rogue", "PHB").startingEquipment.rows[3].options[0].entries;
  const dagger = granted.find((entry) => entry.name === "dagger");

  assert.equal(dagger.quantity, 2);
  assert.equal(granted.find((entry) => entry.name === "leather armor").quantity, undefined);
});

test("2024 asks one question instead of four, and money is one of the answers", () => {
  // The editions divide the list differently: 2024 states the whole kit as A
  // and a pile of gold as B. The money is inside the option rather than
  // alongside it, which is why `goldAlternative` is a 2014 field only.
  const equipment = findClass("Rogue", "XPHB").startingEquipment;

  assert.equal(equipment.rows.length, 1);
  assert.deepEqual(equipment.rows[0].options.map((option) => option.key), ["A", "B"]);
  assert.equal(equipment.goldAlternative, null);

  const [a, b] = equipment.rows[0].options;
  assert.deepEqual(b.entries, [{ kind: "coins", copper: 10000 }]);
  assert.equal(a.entries.at(-1).copper, 800);
});

test("2014's gold alternative is kept as the formula it is", () => {
  // "or 4d4 × 10 gp" replaces the entire list, so it is not a row: it is an
  // answer to all of them at once. Fourteen classes state one.
  assert.equal(findClass("Rogue", "PHB").startingEquipment.goldAlternative, "4d4 × 10");
  assert.equal(findClass("Fighter", "PHB").startingEquipment.goldAlternative, "5d4 × 10");

  // The monk is the exception and the data is right: its starting wealth is
  // 5d4 gp flat, with no × 10. A regex that assumed the multiplier would have
  // quietly given a monk ten times the money.
  assert.equal(findClass("Monk", "PHB").startingEquipment.goldAlternative, "5d4");

  const withGold = classes.filter((row) => row.startingEquipment?.goldAlternative);
  assert.equal(withGold.length, 14);
  for (const row of withGold) {
    assert.match(row.startingEquipment.goldAlternative, /^\d+d\d+( × 10)?$/, row.name);
  }
});

test("a category is a choice inside a choice, and stays one", () => {
  // The artificer's "two simple weapons" and the 2024 monk's "an artisan's
  // tool or a musical instrument" name no item. Resolving them to a single
  // item here would be inventing an answer the player is supposed to give.
  const artificer = findClass("Artificer", "TCE").startingEquipment.rows;
  const simple = artificer
    .flatMap((row) => row.options)
    .flatMap((option) => option.entries)
    .find((entry) => entry.kind === "category" && entry.categories.includes("weaponSimple"));

  assert.equal(simple.quantity, 2);

  const monk = findClass("Monk", "XPHB")
    .startingEquipment.rows.flatMap((row) => row.options)
    .flatMap((option) => option.entries)
    .find((entry) => entry.kind === "category");

  assert.deepEqual(monk.categories, ["instrumentMusical", "toolArtisan"]);
});

test("the wizard's spellbook is kept even though no item entry exists for it", () => {
  const entries = findClass("Wizard", "XPHB")
    .startingEquipment.rows.flatMap((row) => row.options)
    .flatMap((option) => option.entries);

  assert.deepEqual(
    entries.find((entry) => entry.kind === "special"),
    { kind: "special", label: "Spellbook" },
  );
});

test("a pouch of coins is both the pouch and the coins", () => {
  // "A pouch containing 15 gp" is one entry in the data and two things a
  // character owns. Sixty-nine backgrounds state one, and reading only the
  // item silently loses the starting money.
  const entries = findBackground("Acolyte", "PHB")
    .startingEquipment.rows.flatMap((row) => row.options)
    .flatMap((option) => option.entries);

  assert.ok(entries.some((entry) => entry.kind === "item" && entry.name === "pouch"));
  assert.deepEqual(
    entries.find((entry) => entry.kind === "coins"),
    { kind: "coins", copper: 1500 },
  );
});

test("a renamed item keeps both names", () => {
  // The 2024 acolyte's first entry is a plain book that the background calls
  // "Book (Prayers)". The item to import is the book; the label to show is not.
  const book = findBackground("Acolyte", "XPHB")
    .startingEquipment.rows[0].options[0].entries.find((entry) => entry.name === "book");

  assert.equal(book.displayName, "Book (Prayers)");
});

test("a background states no gold alternative, because that rule is the class's", () => {
  for (const row of backgrounds) {
    if (!row.startingEquipment) continue;
    assert.equal(row.startingEquipment.goldAlternative, null, row.name);
    assert.equal(row.startingEquipment.additionalFromBackground, false, row.name);
  }
});

test("every entry in every class and background is a shape the builder can offer", () => {
  // The indexer throws on a shape it does not model, so this passing means
  // both that nothing was dropped and that nothing arrived half-read.
  let entries = 0;

  for (const row of [...classes, ...backgrounds]) {
    const equipment = row.startingEquipment;
    if (!equipment) continue;
    const where = `${row.name} (${row.source})`;

    for (const line of equipment.rows) {
      assert.ok(line.options.length >= 1, where);
      assert.equal(line.fixed, line.options.length === 1 && line.options[0].key === "_", where);

      for (const option of line.options) {
        for (const entry of option.entries) {
          entries += 1;
          assert.ok(KINDS.has(entry.kind), `${where}: kind "${entry.kind}"`);
          if (entry.kind === "item") assert.ok(entry.name.length > 0, where);
          if (entry.kind === "category") assert.ok(entry.categories.length > 0, where);
          if (entry.kind === "coins") assert.ok(entry.copper > 0, where);
          if (entry.quantity !== undefined) assert.ok(entry.quantity > 1, where);
        }
      }
    }
  }

  assert.ok(entries > 1000, `only ${entries} entries read`);
});

test("the four classes with no equipment block say so rather than pretending", () => {
  // Three Tasha's sidekicks and a UA prestige class. Null is not an empty list.
  const without = classes.filter((row) => row.startingEquipment === null).map((row) => row.name);

  assert.deepEqual(without.sort(), [
    "Expert Sidekick",
    "Prestige Class: Rune Scribe",
    "Spellcaster Sidekick",
    "Warrior Sidekick",
  ]);
});
