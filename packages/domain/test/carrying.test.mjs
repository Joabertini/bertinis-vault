/**
 * How much a character can carry.
 *
 * The bag weighed itself and nothing compared the total against anything, so
 * a character could walk out of the Forge carrying three times what the rules
 * allow with nothing on the page saying so.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { carryingCapacity, loadStateFor } from "../dist/index.js";

test("capacity is Strength times fifteen, in both editions", () => {
  assert.equal(carryingCapacity(15).capacity, 225);
  assert.equal(carryingCapacity(8).capacity, 120);
});

test("push, drag and lift is twice carrying", () => {
  assert.equal(carryingCapacity(15).pushDragLift, 450);
});

test("size changes the number, and Small does not", () => {
  // A halfling carries what a human of the same Strength carries; the book
  // only halves it at Tiny and doubles it from Large up.
  assert.equal(carryingCapacity(15, "sm").capacity, 225);
  assert.equal(carryingCapacity(15, "med").capacity, 225);
  assert.equal(carryingCapacity(15, "tiny").capacity, 112.5);
  assert.equal(carryingCapacity(15, "lg").capacity, 450);
  assert.equal(carryingCapacity(15, "grg").capacity, 1800);
});

test("the variant thresholds are five and ten times Strength", () => {
  const limits = carryingCapacity(10);

  assert.equal(limits.encumbered, 50);
  assert.equal(limits.heavilyEncumbered, 100);
});

test("a load is placed against the thresholds, in order", () => {
  const limits = carryingCapacity(10); // 50 / 100 / 150

  assert.equal(loadStateFor(0, limits), "clear");
  assert.equal(loadStateFor(50, limits), "clear");
  assert.equal(loadStateFor(51, limits), "encumbered");
  assert.equal(loadStateFor(100, limits), "encumbered");
  assert.equal(loadStateFor(101, limits), "heavily-encumbered");
  assert.equal(loadStateFor(150, limits), "heavily-encumbered");
  assert.equal(loadStateFor(151, limits), "over-capacity");
});

test("a size the table does not know is treated as Medium rather than as nothing", () => {
  // A build written before the size field existed carries none, and a
  // character who can carry zero pounds is not the honest reading of that.
  assert.equal(carryingCapacity(15, undefined).capacity, 225);
});
