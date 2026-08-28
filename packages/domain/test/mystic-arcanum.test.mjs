import test from "node:test";
import assert from "node:assert/strict";

import { mysticArcanaAt } from "../dist/index.js";

test("nothing before level 11, which is where the feature starts", () => {
  assert.deepEqual(mysticArcanaAt("warlock", 10), []);
  assert.equal(mysticArcanaAt("warlock", 11).length, 1);
});

test("one more at 13, 15 and 17, and the spell level climbs with them", () => {
  const levels = (classLevel) =>
    mysticArcanaAt("warlock", classLevel).map((entry) => entry.filters[0].filter);

  assert.deepEqual(levels(11), ["level=6|class=Warlock"]);
  assert.deepEqual(levels(13), ["level=6|class=Warlock", "level=7|class=Warlock"]);
  assert.equal(levels(17).length, 4);
  assert.equal(levels(20).length, 4);
});

test("each is one spell, chosen by the player rather than named by the rules", () => {
  for (const entry of mysticArcanaAt("warlock", 20)) {
    assert.deepEqual(entry.names, []);
    assert.equal(entry.filters[0].count, 1);
  }
});

test("it is cast without a slot, once, and comes back on a long rest", () => {
  /*
   * "You can cast your arcanum spell once without expending a spell slot. You
   * must finish a long rest before you can do so again." A warlock's pact
   * slots never reach sixth level, so this cannot be a slot.
   */
  const [first] = mysticArcanaAt("warlock", 11);

  assert.equal(first.kind, "innate");
  assert.equal(first.uses, 1);
  assert.equal(first.recharge, "rest");
});

test("the gate is a class level, not a pact slot level", () => {
  // The patrons gate on what the pact slots are worth. This one cannot: no
  // pact slot is ever worth a sixth-level spell, which is the whole feature.
  for (const entry of mysticArcanaAt("warlock", 17)) {
    assert.equal(entry.spellLevel, null);
    assert.ok(entry.level >= 11);
  }
});

test("no other class has one", () => {
  assert.deepEqual(mysticArcanaAt("sorcerer", 20), []);
  assert.deepEqual(mysticArcanaAt("wizard", 20), []);
  assert.deepEqual(mysticArcanaAt("", 20), []);
});
