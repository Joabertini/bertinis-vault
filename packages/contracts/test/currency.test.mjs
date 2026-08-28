/**
 * The purse, and where it lands on a sheet.
 *
 * The builder counts starting money in copper because it is the only unit that
 * never rounds. Two exporters turn that into coins — the actor JSON and the
 * payload the module imports — and they have to agree, or the same character
 * arrives with a different purse depending on how they were sent.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { coinsFromCopper, copperFromCoins, currencySchema } from "../dist/index.js";

test("the money a table was told about lands in the box that table reads", () => {
  // "150 gp" is what the 2024 fighter is offered instead of the kit.
  assert.deepEqual(coinsFromCopper(15000), { pp: 0, gp: 150, ep: 0, sp: 0, cp: 0 });
});

test("platinum and electrum stay empty, however large the purse", () => {
  // 15 platinum is the same money and a different answer: the player has to
  // convert it back to check it against the number the book gave them.
  const rich = coinsFromCopper(50000);

  assert.equal(rich.pp, 0);
  assert.equal(rich.ep, 0);
  assert.equal(rich.gp, 500);
});

test("what does not divide into gold stays as silver and copper", () => {
  // A background pouch of 15 gp 5 sp 2 cp is 1552 copper.
  assert.deepEqual(coinsFromCopper(1552), { pp: 0, gp: 15, ep: 0, sp: 5, cp: 2 });
});

test("no money is an empty purse rather than a negative one", () => {
  assert.deepEqual(coinsFromCopper(0), { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 });
  assert.deepEqual(coinsFromCopper(-40), { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 });
});

test("splitting a purse and adding it back up is the same money", () => {
  for (const copper of [1, 9, 10, 99, 100, 101, 1552, 15000]) {
    assert.equal(copperFromCoins(coinsFromCopper(copper)), copper, String(copper));
  }
});

test("a purse read back counts every denomination, including the two never written", () => {
  // Nothing here writes platinum or electrum, but a payload may arrive with
  // them — a hand-edited one, or a later version of the builder — and reading
  // them as zero would lose most of the money.
  assert.equal(copperFromCoins({ pp: 1, ep: 1 }), 1050);
});

test("a coin is a whole coin", () => {
  assert.equal(currencySchema.safeParse({ gp: 1.5 }).success, false);
  assert.equal(currencySchema.safeParse({ gp: -1 }).success, false);
  assert.deepEqual(currencySchema.parse({ gp: 3 }), { pp: 0, gp: 3, ep: 0, sp: 0, cp: 0 });
});
