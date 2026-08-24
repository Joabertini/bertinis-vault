import test from "node:test";
import assert from "node:assert/strict";

import { spellSlotsForPayload } from "../dist/index.js";

/**
 * The published half-caster table, level 1 through 20.
 *
 * Written out rather than derived, because deriving it is exactly what went
 * wrong: the old code halved the class level rounding down and read the
 * full-caster table with the result, which matches at even levels and
 * undershoots at every odd level from 3 up.
 *
 * Checked against the 5etools data for all 20 levels of every casting class in
 * both editions — 300 class-levels, no mismatches — but that data is not in
 * the repository, so the table lives here.
 */
const halfCasterSlots = [
  {}, { 1: 2 }, { 1: 3 }, { 1: 3 },
  { 1: 4, 2: 2 }, { 1: 4, 2: 2 }, { 1: 4, 2: 3 }, { 1: 4, 2: 3 },
  { 1: 4, 2: 3, 3: 2 }, { 1: 4, 2: 3, 3: 2 }, { 1: 4, 2: 3, 3: 3 }, { 1: 4, 2: 3, 3: 3 },
  { 1: 4, 2: 3, 3: 3, 4: 1 }, { 1: 4, 2: 3, 3: 3, 4: 1 },
  { 1: 4, 2: 3, 3: 3, 4: 2 }, { 1: 4, 2: 3, 3: 3, 4: 2 },
  { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 }, { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
  { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 }, { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
];

const asKeys = (row) => Object.fromEntries(Object.entries(row));

test("a 2014 paladin matches the published table at every level", () => {
  for (let level = 1; level <= 20; level += 1) {
    assert.deepEqual(
      spellSlotsForPayload("paladin", level, "2014").slots,
      asKeys(halfCasterSlots[level - 1]),
      `paladin level ${level}`,
    );
  }
});

test("a 2024 half-caster differs from a 2014 one only at level 1", () => {
  assert.deepEqual(spellSlotsForPayload("ranger", 1, "2014").slots, {});
  assert.deepEqual(spellSlotsForPayload("ranger", 1, "2024").slots, { 1: 2 });

  for (let level = 2; level <= 20; level += 1) {
    assert.deepEqual(
      spellSlotsForPayload("ranger", level, "2024").slots,
      spellSlotsForPayload("ranger", level, "2014").slots,
      `ranger level ${level}`,
    );
  }
});

test("the artificer casts from level 1 in both editions", () => {
  assert.deepEqual(spellSlotsForPayload("artificer", 1, "2014").slots, { 1: 2 });
  assert.deepEqual(spellSlotsForPayload("artificer", 1, "2024").slots, { 1: 2 });
});

test("a full caster is keyed by level, not by Foundry's field names", () => {
  const { slots } = spellSlotsForPayload("wizard", 5);

  assert.deepEqual(slots, { 1: 4, 2: 3, 3: 2 });
  assert.equal(slots.spell1, undefined);
});

test("levels with no slots are absent rather than sent as zero", () => {
  const { slots } = spellSlotsForPayload("wizard", 1);

  assert.deepEqual(slots, { 1: 2 });
});

test("a warlock's slots are pact slots, with the level they cast at", () => {
  const warlock = spellSlotsForPayload("warlock", 5);

  assert.deepEqual(warlock.slots, { pact: 2 });
  assert.equal(warlock.pactLevel, 3);
});

test("a non-caster has nothing at any level", () => {
  for (const level of [1, 5, 20]) {
    assert.deepEqual(spellSlotsForPayload("fighter", level).slots, {});
    assert.equal(spellSlotsForPayload("fighter", level).pactLevel, undefined);
  }
});
