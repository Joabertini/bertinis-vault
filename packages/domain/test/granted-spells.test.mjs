import test from "node:test";
import assert from "node:assert/strict";

import {
  grantedSpellsAt,
  preparationForKind,
  spellVariantsOf,
} from "../dist/index.js";

const entry = (over = {}) => ({
  kind: "known",
  variant: null,
  ability: null,
  level: null,
  spellLevel: null,
  recharge: null,
  uses: null,
  names: [],
  filters: [],
  choices: [],
  ...over,
});

/** The 2024 elf, as the index reads it: three lineages and nothing else. */
const elf = [
  entry({ variant: "Drow", level: 1, names: [{ name: "dancing lights", source: "xphb" }] }),
  entry({ variant: "High Elf", level: 1, filters: [{ filter: "level=0|class=Wizard", count: 1 }] }),
  entry({ variant: "Wood Elf", level: 1, names: [{ name: "druidcraft", source: "xphb" }] }),
  entry({
    kind: "innate",
    variant: "Drow",
    level: 3,
    recharge: "daily",
    uses: 1,
    names: [{ name: "faerie fire", source: "xphb" }],
  }),
];

test("the lineages of a 2024 species are readable, because they live nowhere else", () => {
  // XPHB ships no subraces at all. Without these names a 2024 elf cannot be
  // built: the choice exists only as the name on a block of spells.
  assert.deepEqual(spellVariantsOf(elf), ["Drow", "High Elf", "Wood Elf"]);
  assert.deepEqual(spellVariantsOf([]), []);
  assert.deepEqual(spellVariantsOf(null), []);
});

test("an unanswered variant grants nothing, rather than all of them at once", () => {
  // Three lineages' spells is three characters, not one generous one.
  assert.deepEqual(grantedSpellsAt(elf, { level: 20 }), []);
});

test("the chosen lineage grants its own and only its own", () => {
  const drow = grantedSpellsAt(elf, { level: 3, variant: "Drow" });

  assert.equal(drow.length, 2);
  assert.deepEqual(
    drow.flatMap((found) => found.names.map((ref) => ref.name)),
    ["dancing lights", "faerie fire"],
  );
});

test("a level gate holds until the character reaches it", () => {
  // The tiefling's second spell arrives at character level 3, and the elf's
  // Faerie Fire with it.
  assert.equal(grantedSpellsAt(elf, { level: 1, variant: "Drow" }).length, 1);
  assert.equal(grantedSpellsAt(elf, { level: 3, variant: "Drow" }).length, 2);
});

test("a grant with no variant applies whether or not one was chosen", () => {
  const plain = [entry({ level: 1, names: [{ name: "thaumaturgy", source: "phb" }] })];

  assert.equal(grantedSpellsAt(plain, { level: 1 }).length, 1);
  assert.equal(grantedSpellsAt(plain, { level: 1, variant: "Infernal" }).length, 1);
});

test("a warlock patron still gates on pact slots and not on levels", () => {
  const patron = [entry({ kind: "expanded", spellLevel: 3 })];

  assert.equal(grantedSpellsAt(patron, { level: 20, pactSlotLevel: 2 }).length, 0);
  assert.equal(grantedSpellsAt(patron, { level: 5, pactSlotLevel: 3 }).length, 1);
});

test("the four kinds are four states on the sheet, and one of them is no state", () => {
  // A known spell is castable; an innate one is castable too — what makes it
  // innate is how it is cast, not whether it is prepared.
  assert.equal(preparationForKind("known"), "prepared");
  assert.equal(preparationForKind("innate"), "prepared");
  // A domain spell is ready without costing one of the day's preparations,
  // which is exactly what dnd5e's `always` is for.
  assert.equal(preparationForKind("prepared"), "always");
  // And an expanded list grants nothing at all: it widens what may be
  // prepared, and the spell reaches the sheet only if the player prepares it.
  assert.equal(preparationForKind("expanded"), null);
});
