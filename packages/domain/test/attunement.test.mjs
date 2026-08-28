import test from "node:test";
import assert from "node:assert/strict";

import { ATTUNEMENT_SLOTS, attunementFor } from "../dist/index.js";

const item = (id) => ({ id, label: id });

test("three at a time, which is the sentence both editions print", () => {
  assert.equal(ATTUNEMENT_SLOTS, 3);
});

test("what the player marked is what they are attuned to", () => {
  const state = attunementFor({
    offered: [item("wand-of-magic-missiles"), item("cloak-of-protection")],
    attuned: ["cloak-of-protection"],
  });

  assert.deepEqual(
    state.attuned.map((entry) => entry.id),
    ["cloak-of-protection"],
  );
  assert.equal(state.used, 1);
  assert.equal(state.over, 0);
});

test("an item no longer carried takes its slot back", () => {
  // A player who attunes to a wand and then empties it out of the bag is
  // attuned to nothing. Holding the slot would tell them they have two left.
  const state = attunementFor({ offered: [item("cloak-of-protection")], attuned: ["wand"] });

  assert.deepEqual(state.attuned, []);
  assert.equal(state.used, 0);
});

test("a fourth is reported rather than refused", () => {
  // A table that hands out a fourth attunement is making a ruling, and a
  // builder that deletes the pick is arguing with it.
  const ids = ["a", "b", "c", "d"];
  const state = attunementFor({ offered: ids.map(item), attuned: ids });

  assert.equal(state.used, 4);
  assert.equal(state.over, 1);
});

test("the same item marked twice is one attunement", () => {
  const state = attunementFor({ offered: [item("a"), item("a")], attuned: ["a", "a"] });

  assert.equal(state.used, 1);
  assert.equal(state.offered.length, 1);
});

test("nothing carried is nothing to answer", () => {
  const state = attunementFor({ offered: [], attuned: ["a"] });

  assert.deepEqual(state.offered, []);
  assert.equal(state.used, 0);
  assert.equal(state.over, 0);
});
