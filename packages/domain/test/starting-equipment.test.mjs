import test from "node:test";
import assert from "node:assert/strict";

import {
  averageStartingGold,
  coinsFromCopper,
  equipmentRowId,
  resolveStartingEquipment,
} from "../dist/index.js";

const item = (name, over = {}) => ({ kind: "item", name, source: "phb", ...over });

/** The 2014 rogue, which is four questions and a granted row. */
const rogue = {
  id: "class",
  goldAlternative: "4d4 × 10",
  rows: [
    {
      fixed: false,
      options: [
        { key: "a", entries: [item("rapier")] },
        { key: "b", entries: [item("shortsword")] },
      ],
    },
    {
      fixed: false,
      options: [
        { key: "a", entries: [item("shortbow"), item("arrows (20)")] },
        { key: "b", entries: [item("shortsword")] },
      ],
    },
    {
      fixed: true,
      options: [
        {
          key: "_",
          entries: [item("leather armor"), item("dagger", { quantity: 2 }), item("thieves' tools")],
        },
      ],
    },
  ],
};

test("a fixed row needs no answer and is never asked about", () => {
  const resolved = resolveStartingEquipment({ lists: [rogue], answers: { "class:0": "a", "class:1": "a" } });

  assert.deepEqual(resolved.unanswered, []);
  assert.ok(resolved.items.some((entry) => entry.name === "leather armor"));
});

test("an unanswered choice contributes nothing and says so", () => {
  // Half a list is worse than a list that admits it is incomplete: the
  // character would silently start without a weapon.
  const resolved = resolveStartingEquipment({ lists: [rogue], answers: {} });

  assert.deepEqual(resolved.unanswered, ["class:0", "class:1"]);
  assert.deepEqual(
    resolved.items.map((entry) => entry.name),
    ["leather armor", "dagger", "thieves' tools"],
  );
});

test("the same item picked twice is one line of two", () => {
  // A rogue may answer "shortsword" to both questions, and owns two.
  const resolved = resolveStartingEquipment({
    lists: [rogue],
    answers: { "class:0": "b", "class:1": "b" },
  });
  const shortswords = resolved.items.filter((entry) => entry.name === "shortsword");

  assert.equal(shortswords.length, 1);
  assert.equal(shortswords[0].quantity, 2);
});

test("a quantity in the data is kept rather than counted as one", () => {
  const resolved = resolveStartingEquipment({ lists: [rogue], answers: { "class:0": "a", "class:1": "a" } });

  assert.equal(resolved.items.find((entry) => entry.name === "dagger").quantity, 2);
});

test("taking the gold replaces every list, not one row", () => {
  // The 2014 rule is "or 4d4 × 10 gp" for the whole thing. A version that
  // dropped only the answered rows would leave the granted ones behind.
  const resolved = resolveStartingEquipment({
    lists: [rogue],
    answers: { "class:0": "a", "class:1": "a" },
    takeGold: true,
    goldCopper: 10000,
  });

  assert.deepEqual(resolved.items, []);
  assert.deepEqual(resolved.unanswered, []);
  assert.equal(resolved.copper, 10000);
});

test("money arrives from inside an option too, which is how 2024 states it", () => {
  const list = {
    id: "class",
    rows: [
      {
        fixed: false,
        options: [
          { key: "A", entries: [item("leather armor"), { kind: "coins", copper: 800 }] },
          { key: "B", entries: [{ kind: "coins", copper: 10000 }] },
        ],
      },
    ],
  };

  assert.equal(resolveStartingEquipment({ lists: [list], answers: { "class:0": "A" } }).copper, 800);
  assert.equal(resolveStartingEquipment({ lists: [list], answers: { "class:0": "B" } }).copper, 10000);
});

test("two lists add up, and each names its own rows", () => {
  // A character has a class list and a background list, and both ask
  // questions. Answers have to name which list they answer or the second
  // list's first row would take the first list's answer.
  const background = {
    id: "background",
    rows: [
      {
        fixed: false,
        options: [
          { key: "A", entries: [item("holy symbol")] },
          { key: "B", entries: [{ kind: "coins", copper: 5000 }] },
        ],
      },
    ],
  };

  const resolved = resolveStartingEquipment({
    lists: [rogue, background],
    answers: { "class:0": "a", "class:1": "a", "background:0": "A" },
  });

  assert.ok(resolved.items.some((entry) => entry.name === "rapier"));
  assert.ok(resolved.items.some((entry) => entry.name === "holy symbol"));
  assert.equal(equipmentRowId("background", 0), "background:0");
});

test("a category stays a question rather than becoming an item", () => {
  // "Two simple weapons" names no weapon. Picking one here would be answering
  // for the player.
  const list = {
    id: "class",
    rows: [
      {
        fixed: true,
        options: [{ key: "_", entries: [{ kind: "category", categories: ["weaponSimple"], quantity: 2 }] }],
      },
    ],
  };

  const resolved = resolveStartingEquipment({ lists: [list], answers: {} });

  assert.deepEqual(resolved.items, []);
  assert.deepEqual(resolved.openCategories, [
    { rowId: "class:0", categories: ["weaponSimple"], quantity: 2 },
  ]);
});

test("a special is kept even though no item matches it", () => {
  const list = {
    id: "class",
    rows: [{ fixed: true, options: [{ key: "_", entries: [{ kind: "special", label: "Spellbook" }] }] }],
  };

  assert.deepEqual(resolveStartingEquipment({ lists: [list], answers: {} }).specials, [
    { label: "Spellbook", quantity: 1 },
  ]);
});

test("a renamed item shows its name and imports the other one", () => {
  const list = {
    id: "background",
    rows: [
      {
        fixed: true,
        options: [{ key: "_", entries: [item("book", { displayName: "Book (Prayers)" })] }],
      },
    ],
  };

  const [book] = resolveStartingEquipment({ lists: [list], answers: {} }).items;

  assert.equal(book.name, "book");
  assert.equal(book.label, "Book (Prayers)");
});

test("copper becomes the coins a sheet shows", () => {
  assert.deepEqual(coinsFromCopper(10000), { gp: 100, sp: 0, cp: 0 });
  assert.deepEqual(coinsFromCopper(800), { gp: 8, sp: 0, cp: 0 });
  assert.deepEqual(coinsFromCopper(1573), { gp: 15, sp: 7, cp: 3 });
});

test("a gold formula averages to what the books intend", () => {
  // 4d4 × 10 is the rogue's, and 100 gp is the number the 2024 books replaced
  // it with — which is the check that the average is read right.
  assert.equal(averageStartingGold("4d4 × 10"), 100);
  assert.equal(averageStartingGold("5d4 × 10"), 125);

  // The monk's is 5d4 flat. No multiplier is not a multiplier of ten.
  assert.equal(averageStartingGold("5d4"), 12.5);

  assert.equal(averageStartingGold("a handful"), null);
});
