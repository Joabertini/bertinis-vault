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
    ritual: null,
    attacks: [],
  });
});

test("a ritual filter is read, where it used to be dropped in silence", () => {
  /*
   * Ritual Caster grants "a 1st-level spell from that class's list that has
   * the ritual tag". Fourteen filters say this, and dropping the clause read
   * it as "a 1st-level bard spell" — a hundred choices where the feat offers
   * ten.
   */
  assert.equal(parseSpellFilter("level=1|class=Bard|components & miscellaneous=ritual").ritual, true);
  // The data is not consistent about the case of its own key.
  assert.equal(parseSpellFilter("level=1|Components & Miscellaneous=ritual").ritual, true);
  assert.equal(parseSpellFilter("level=1|class=Bard").ritual, null);
});

test("an attack filter is read too", () => {
  // Spell Sniper: "a cantrip that requires an attack roll". Melee, ranged or
  // other — which is to say any of them.
  assert.deepEqual(parseSpellFilter("level=0|class=Wizard|spell attack=m;r;o").attacks, [
    "m",
    "r",
    "o",
  ]);
});

test("a spell is matched on both of them", () => {
  const ritualFilter = parseSpellFilter("level=1|components & miscellaneous=ritual");
  const detectMagic = { name: "Detect Magic", level: 1, source: "PHB", classes: [], ritual: 1 };
  const magicMissile = { name: "Magic Missile", level: 1, source: "PHB", classes: [], ritual: 0 };

  assert.equal(spellMatchesFilter(detectMagic, ritualFilter), true);
  assert.equal(spellMatchesFilter(magicMissile, ritualFilter), false);

  const attackFilter = parseSpellFilter("level=0|spell attack=m;r;o");
  const fireBolt = { name: "Fire Bolt", level: 0, source: "PHB", classes: [], attack: ["r"] };
  const guidance = { name: "Guidance", level: 0, source: "PHB", classes: [], attack: [] };

  assert.equal(spellMatchesFilter(fireBolt, attackFilter), true);
  assert.equal(spellMatchesFilter(guidance, attackFilter), false);
});

test("a spell that says nothing still matches a filter that asks nothing", () => {
  // Most rows carry neither field, and most filters ask for neither.
  const plain = parseSpellFilter("level=1|class=Bard");
  assert.equal(spellMatchesFilter({ name: "Bless", level: 1, source: "PHB", classes: ["Bard|PHB"] }, plain), true);
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
  // One, not two. A domain's "prepared" list is always prepared: the cleric
  // has it without spending a preparation, so it is handed over rather than
  // offered — and offering it as well spent a preparation on a free spell.
  assert.deepEqual(PREPARABLE_KINDS, ["expanded"]);
});
