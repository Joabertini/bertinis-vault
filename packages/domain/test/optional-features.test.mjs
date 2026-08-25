import test from "node:test";
import assert from "node:assert/strict";

import {
  countAtLevel,
  optionalFeatureQuotas,
  optionalFeatureSlots,
  pactNameOf,
  unmetPrerequisites,
} from "../dist/index.js";

/** The warlock's invocations, as 5etools states them and the index flattens them. */
const invocations = {
  name: "Eldritch Invocations",
  featureType: ["EI"],
  countByLevel: [0, 2, 2, 2, 3, 3, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 7, 8, 8, 8],
};

const pactBoon = {
  name: "Pact Boon",
  featureType: ["PB"],
  countByLevel: [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
};

const maneuvers = {
  name: "Maneuvers",
  featureType: ["MV:B"],
  countByLevel: [0, 0, 3, 3, 3, 3, 5, 5, 5, 7, 7, 7, 7, 7, 9, 9, 9, 9, 9, 9],
};

const warlock = (level) => ({
  name: "Warlock",
  source: "PHB",
  level,
  optionalFeatureProgression: [invocations, pactBoon],
});

test("the count at a level is a lookup, not a sum", () => {
  // Running totals. A level 5 warlock knows three invocations, not 2 + 3.
  assert.equal(countAtLevel(invocations, 1), 0);
  assert.equal(countAtLevel(invocations, 2), 2);
  assert.equal(countAtLevel(invocations, 5), 3);
  assert.equal(countAtLevel(invocations, 20), 8);
});

test("a level below the table, or off the end of it, does not throw", () => {
  assert.equal(countAtLevel(invocations, 0), 0);
  assert.equal(countAtLevel(invocations, -3), 0);
  assert.equal(countAtLevel(invocations, 99), 8);
});

test("a progression that has not started yields no quota at all", () => {
  // A level 2 warlock has invocations but no pact boon yet. Reporting the boon
  // as a quota of zero would put an empty picker in front of the player.
  const quotas = optionalFeatureQuotas([warlock(2)]);

  assert.deepEqual(
    quotas.map((q) => [q.name, q.count]),
    [["Eldritch Invocations", 2]],
  );
});

test("a subclass grants on top of its class", () => {
  const quotas = optionalFeatureQuotas([
    { name: "Fighter", source: "PHB", level: 7, optionalFeatureProgression: [] },
    { name: "Battle Master", source: "PHB", level: 7, optionalFeatureProgression: [maneuvers] },
  ]);

  assert.deepEqual(
    quotas.map((q) => [q.grantedBy.name, q.count]),
    [["Battle Master", 5]],
  );
});

test("picks are matched to the pool they belong to, and what is owed is what is left", () => {
  const quotas = optionalFeatureQuotas([warlock(5)]);
  const slots = optionalFeatureSlots(quotas, [
    { name: "Agonizing Blast", source: "PHB", featureType: ["EI"] },
    { name: "Pact of the Tome", source: "PHB", featureType: ["PB"] },
  ]);

  const invocationSlot = slots.find((s) => s.featureType.includes("EI"));
  const boonSlot = slots.find((s) => s.featureType.includes("PB"));

  assert.equal(invocationSlot.count, 3);
  assert.equal(invocationSlot.taken.length, 1);
  assert.equal(invocationSlot.remaining, 2);

  assert.equal(boonSlot.remaining, 0);
});

test("a build carrying more than it should reports it rather than hiding it", () => {
  // Lowering a character's level after picking is the ordinary way to get here,
  // and silently dropping the extras would lose the player's work.
  const slots = optionalFeatureSlots(optionalFeatureQuotas([warlock(2)]), [
    { name: "Agonizing Blast", source: "PHB", featureType: ["EI"] },
    { name: "Armor of Shadows", source: "PHB", featureType: ["EI"] },
    { name: "Beast Speech", source: "PHB", featureType: ["EI"] },
  ]);

  assert.equal(slots[0].remaining, -1);
});

test("an option is counted against one pool, never two", () => {
  const slots = optionalFeatureSlots(
    [
      { grantedBy: { name: "A", source: "X" }, name: "First", featureType: ["EI"], count: 2 },
      { grantedBy: { name: "B", source: "X" }, name: "Second", featureType: ["EI"], count: 2 },
    ],
    [{ name: "Agonizing Blast", source: "PHB", featureType: ["EI"] }],
  );

  assert.equal(slots[0].taken.length, 1);
  assert.equal(slots[1].taken.length, 0);
});

const context = (overrides = {}) => ({
  classLevels: { "Warlock|PHB": 5 },
  characterLevel: 5,
  pacts: [],
  spells: [],
  taken: [],
  ...overrides,
});

test("a spell prerequisite ignores the marker 5etools appends", () => {
  // Agonizing Blast asks for `"eldritch blast#c"`, where `#c` says cantrip.
  const needsBlast = [{ kind: "spell", spell: "eldritch blast#c" }];

  assert.deepEqual(unmetPrerequisites(needsBlast, context({ spells: ["Eldritch Blast"] })), []);
  assert.equal(unmetPrerequisites(needsBlast, context({ spells: ["Fire Bolt"] })).length, 1);
});

test("a pact prerequisite matches the boon that grants it", () => {
  // The invocation asks for "Tome"; the boon is called "Pact of the Tome".
  assert.equal(pactNameOf("Pact of the Tome"), "Tome");
  assert.equal(pactNameOf("Pact of the Blade"), "Blade");

  const needsTome = [{ kind: "pact", pact: "Tome" }];
  assert.deepEqual(unmetPrerequisites(needsTome, context({ pacts: ["Tome"] })), []);
  assert.equal(unmetPrerequisites(needsTome, context({ pacts: ["Blade"] })).length, 1);
});

test("a level prerequisite counts the class it names, not the character", () => {
  // This is the one multiclassing gets wrong if it is not stated: a
  // Warlock 2 / Fighter 10 is level 12 and still cannot take an invocation
  // that asks for Warlock 5.
  const needsWarlock5 = [
    { kind: "level", level: 5, className: "Warlock", classSource: "PHB" },
  ];

  const multiclass = context({
    classLevels: { "Warlock|PHB": 2, "Fighter|PHB": 10 },
    characterLevel: 12,
  });

  assert.equal(unmetPrerequisites(needsWarlock5, multiclass).length, 1);
  assert.deepEqual(unmetPrerequisites(needsWarlock5, context()), []);
});

test("a level prerequisite falls back to the class by name when the book differs", () => {
  const needsWarlock5 = [
    { kind: "level", level: 5, className: "Warlock", classSource: "XPHB" },
  ];

  assert.deepEqual(unmetPrerequisites(needsWarlock5, context()), []);
});

test("a level prerequisite naming no class counts the character's level", () => {
  const needsFive = [{ kind: "level", level: 5, className: null, classSource: null }];

  assert.deepEqual(unmetPrerequisites(needsFive, context()), []);
  assert.equal(unmetPrerequisites(needsFive, context({ characterLevel: 4 })).length, 1);
});

test("one option can require another", () => {
  // Devouring Blade needs Thirsting Blade, and 5etools writes both lowercased.
  const needsThirsting = [
    { kind: "optionalfeature", name: "thirsting blade", source: "xphb" },
  ];

  assert.deepEqual(
    unmetPrerequisites(needsThirsting, context({ taken: [{ name: "Thirsting Blade", source: "XPHB" }] })),
    [],
  );
  assert.equal(unmetPrerequisites(needsThirsting, context()).length, 1);
});

test("every unmet prerequisite is reported, not just the first", () => {
  // The player is owed the whole reason an option is closed to them.
  const both = [
    { kind: "level", level: 12, className: "Warlock", classSource: "XPHB" },
    { kind: "optionalfeature", name: "thirsting blade", source: "xphb" },
  ];

  assert.equal(unmetPrerequisites(both, context()).length, 2);
});
