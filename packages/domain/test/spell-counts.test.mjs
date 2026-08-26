import test from "node:test";
import assert from "node:assert/strict";

import {
  cantripsKnownAt,
  castsAtLevel,
  preparedFromFormula,
  spellCountLabel,
  spellsAvailableAt,
} from "../dist/index.js";

/** The real rows, as the index reads them out of each class's own table. */
const bard2014 = {
  spellTable: {
    cantrips: [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
    known: [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 15, 16, 18, 19, 19, 20, 22, 22, 22],
    prepared: null,
  },
  preparedSpells: null,
  spellcastingLevel: 1,
};

const bard2024 = {
  spellTable: {
    cantrips: [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
    known: null,
    prepared: [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22],
  },
  preparedSpells: null,
  spellcastingLevel: 1,
};

/** 2014 clerics prepare by formula: their count depends on a modifier. */
const cleric2014 = {
  spellTable: { cantrips: [3, 3, 3, 4, 4, 4, 4, 4, 4, 5], known: null, prepared: null },
  preparedSpells: "<$level$> + <$wis_mod$>",
  spellcastingLevel: 1,
};

const paladin2014 = {
  spellTable: null,
  preparedSpells: "<$level$> / 2 + <$cha_mod$>",
  spellcastingLevel: 2,
};

const paladin2024 = {
  spellTable: {
    cantrips: null,
    known: null,
    prepared: [2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15],
  },
  preparedSpells: null,
  spellcastingLevel: 1,
};

test("a 2024 bard prepares more than a 2014 bard knows", () => {
  // The difference the hand-written table could not express: one switch served
  // both editions, so a 2024 bard was held to the 2014 numbers.
  assert.equal(spellsAvailableAt(bard2014, 5), 8);
  assert.equal(spellsAvailableAt(bard2024, 5), 9);
});

test("the count comes off the table at the class's own level", () => {
  assert.equal(spellsAvailableAt(bard2024, 1), 4);
  assert.equal(spellsAvailableAt(bard2024, 20), 22);
});

test("a level past the table is clamped rather than read off the end", () => {
  // Reading index 20 of a 20-entry table hands back undefined, and every
  // comparison against it is false.
  assert.equal(spellsAvailableAt(bard2024, 25), 22);
  assert.equal(cantripsKnownAt(bard2024, 25), 4);

  // Below the level the class starts casting at the answer is zero, which is
  // a different thing from clamping: level 0 is not a character with two
  // cantrips, it is a character who has not taken the class yet.
  assert.equal(cantripsKnownAt(bard2024, 0), 0);
});

test("a 2014 prepare-caster falls back to its formula, because a table cannot know a modifier", () => {
  assert.equal(spellsAvailableAt(cleric2014, 5, 3), 8);
  assert.equal(spellsAvailableAt(cleric2014, 1, 0), 1);
});

test("a bad casting modifier still leaves one spell", () => {
  // "Level plus a negative modifier" is not zero spells, it is a character
  // with a bad casting stat.
  assert.equal(spellsAvailableAt(cleric2014, 1, -2), 1);
  assert.equal(preparedFromFormula("<$level$> + <$wis_mod$>", 2, -5), 1);
});

test("a half caster's formula halves the level, rounding down", () => {
  assert.equal(preparedFromFormula("<$level$> / 2 + <$cha_mod$>", 5, 3), 5);
  assert.equal(preparedFromFormula("<$level$> / 2 + <$cha_mod$>", 4, 0), 2);
});

test("2024 moved the paladin's magic to level 1, and the builder has to follow", () => {
  // A 2014 paladin casts nothing at level 1 and a 2024 one prepares two. A
  // constant "half casters start at 2" is wrong for exactly the two classes
  // it was written for.
  assert.equal(castsAtLevel(paladin2014, 1), false);
  assert.equal(spellsAvailableAt(paladin2014, 1, 3), 0);

  assert.equal(castsAtLevel(paladin2024, 1), true);
  assert.equal(spellsAvailableAt(paladin2024, 1), 2);
});

test("a class with no cantrip column has no cantrips, in either edition", () => {
  assert.equal(cantripsKnownAt(paladin2014, 20), 0);
  assert.equal(cantripsKnownAt(paladin2024, 20), 0);
});

test("cantrips come from the table too, and the two editions agree for the bard", () => {
  assert.equal(cantripsKnownAt(bard2014, 3), 2);
  assert.equal(cantripsKnownAt(bard2024, 4), 3);
  assert.equal(cantripsKnownAt(bard2024, 10), 4);
});

test("a non-caster has nothing rather than a default", () => {
  const fighter = { spellTable: null, preparedSpells: null, spellcastingLevel: null };

  assert.equal(spellsAvailableAt(fighter, 20, 5), 0);
  assert.equal(cantripsKnownAt(fighter, 20), 0);
});

test("the word for the count follows the edition that names it", () => {
  assert.equal(spellCountLabel(bard2014), "known");
  assert.equal(spellCountLabel(bard2024), "prepared");
  assert.equal(spellCountLabel(cleric2014), "prepared");
});
