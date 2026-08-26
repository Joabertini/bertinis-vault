import test from "node:test";
import assert from "node:assert/strict";

import {
  PREPARABLE_KINDS,
  parseSpellFilter,
  spellMatchesFilter,
  subclassSpellsAt,
} from "../dist/index.js";

const spell = (name, level, over = {}) => ({
  name,
  level,
  school: "V",
  source: "PHB",
  classes: ["Wizard|PHB"],
  ...over,
});

/** The Eldritch Knight, whose whole spell list is the wizard's. */
const eldritchKnight = [
  {
    kind: "expanded",
    level: 3,
    spellLevel: null,
    names: [],
    filters: [
      { filter: "level=0|class=Wizard", count: null },
      { filter: "level=1|class=Wizard", count: null },
    ],
  },
  {
    kind: "expanded",
    level: 7,
    spellLevel: null,
    names: [],
    filters: [{ filter: "level=2|class=Wizard", count: null }],
  },
];

/** The Archfey, whose expanded list is gated by pact slot level. */
const archfey = [
  { kind: "expanded", level: null, spellLevel: 1, names: ["faerie fire", "sleep"], filters: [] },
  { kind: "expanded", level: null, spellLevel: 3, names: ["blink", "plant growth"], filters: [] },
];

test("a filter says which classes, levels, schools and books it means", () => {
  assert.deepEqual(parseSpellFilter("level=0;1;2|class=Cleric;Druid"), {
    classes: ["Cleric", "Druid"],
    levels: [0, 1, 2],
    schools: [],
    sources: [],
  });
});

test("a key nothing knows how to read is left out rather than guessed at", () => {
  // A filter that silently ignores half of itself offers spells the subclass
  // never granted.
  const parsed = parseSpellFilter("level=1|somethingNew=yes");

  assert.deepEqual(parsed.levels, [1]);
  assert.deepEqual(parsed.classes, []);
});

test("a spell matches a filter on every clause at once", () => {
  const filter = parseSpellFilter("level=1|class=Wizard");

  assert.equal(spellMatchesFilter(spell("shield", 1), filter), true);
  assert.equal(spellMatchesFilter(spell("fireball", 3), filter), false);
  assert.equal(spellMatchesFilter(spell("cure wounds", 1, { classes: ["Cleric|PHB"] }), filter), false);
});

test("the class match ignores the book, because a list is a list", () => {
  // A spell on the 2024 wizard's list is on the wizard's list.
  const filter = parseSpellFilter("class=Wizard");

  assert.equal(spellMatchesFilter(spell("shield", 1, { classes: ["Wizard|XPHB"] }), filter), true);
  assert.equal(spellMatchesFilter(spell("shield", 1, { classes: ["wizard|phb"] }), filter), true);
});

test("a school filter is checked, which is how the necromancer's list is stated", () => {
  const filter = parseSpellFilter("level=0|school=N");

  assert.equal(spellMatchesFilter(spell("chill touch", 0, { school: "N" }), filter), true);
  assert.equal(spellMatchesFilter(spell("light", 0, { school: "V" }), filter), false);
});

test("an empty filter matches everything, which is what stating nothing means", () => {
  assert.equal(spellMatchesFilter(spell("shield", 1), parseSpellFilter("")), true);
});

test("a class level gate opens at the level the subclass states", () => {
  assert.deepEqual(subclassSpellsAt(eldritchKnight, { classLevel: 2 }), []);
  assert.equal(subclassSpellsAt(eldritchKnight, { classLevel: 3 }).length, 1);
  assert.equal(subclassSpellsAt(eldritchKnight, { classLevel: 7 }).length, 2);
});

test("a warlock patron's gate is the pact slot level, not the class level", () => {
  // Reading "s3" as class level 3 would hand a level 3 warlock third-level
  // spells five levels early — their slots are second-level at that point.
  assert.equal(subclassSpellsAt(archfey, { classLevel: 20, pactSlotLevel: 0 }).length, 0);
  assert.equal(subclassSpellsAt(archfey, { classLevel: 3, pactSlotLevel: 2 }).length, 1);
  assert.equal(subclassSpellsAt(archfey, { classLevel: 5, pactSlotLevel: 3 }).length, 2);
});

test("an entry gated by neither arrives with the subclass", () => {
  const always = [{ kind: "innate", level: null, spellLevel: null, names: ["misty step"], filters: [] }];

  assert.equal(subclassSpellsAt(always, { classLevel: 1 }).length, 1);
});

test("a subclass with no spells contributes none rather than failing", () => {
  assert.deepEqual(subclassSpellsAt(null, { classLevel: 20 }), []);
  assert.deepEqual(subclassSpellsAt([], { classLevel: 20 }), []);
});

test("preparing and knowing are different rules, and only two widen the list", () => {
  // An innate spell is cast without preparing it. Folding it into the prepared
  // pool would let the character prepare it a second time, at a slot's cost.
  assert.deepEqual(PREPARABLE_KINDS, ["expanded", "prepared"]);
});
