import test from "node:test";
import assert from "node:assert/strict";

import { hasSpellbook, spellbookSizeAt } from "../dist/index.js";

test("only the wizard keeps a book", () => {
  assert.equal(hasSpellbook("wizard"), true);
  assert.equal(hasSpellbook("Wizard"), true);

  // Casts from the wizard list and is often mistaken for one. It knows its
  // spells outright: there is no book to copy into.
  assert.equal(hasSpellbook("fighter"), false);
  assert.equal(hasSpellbook("cleric"), false);
  assert.equal(hasSpellbook("sorcerer"), false);
});

test("the book starts at six and grows by two a level", () => {
  // "At 1st level, you have a spellbook containing six 1st-level wizard
  // spells of your choice." — PHB / XPHB alike.
  assert.equal(spellbookSizeAt(1), 6);
  // "Whenever you gain a Wizard level after 1, add two Wizard spells."
  assert.equal(spellbookSizeAt(2), 8);
  assert.equal(spellbookSizeAt(3), 10);
  assert.equal(spellbookSizeAt(20), 44);
});

test("the book is never smaller than the one the wizard started with", () => {
  // A level read out of a half-filled draft, not a wizard of level zero.
  assert.equal(spellbookSizeAt(0), 6);
  assert.equal(spellbookSizeAt(-3), 6);
});

test("the book is bigger than the list the wizard prepares from it", () => {
  // The whole point of the two tracks. A level 1 wizard with Intelligence 16
  // prepares four of the six they wrote down; a builder that offered one list
  // would have to pick which of those numbers to be wrong about.
  const prepared2024AtLevel1 = 4;
  assert.ok(spellbookSizeAt(1) > prepared2024AtLevel1);
});
