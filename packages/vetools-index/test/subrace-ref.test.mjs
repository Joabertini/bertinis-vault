import test from "node:test";
import assert from "node:assert/strict";

import { RefResolver, collections, forRulesVersion } from "../dist/index.js";
import { buildToPayload } from "../dist/to-payload.js";

const resolver = (rulesVersion = "2014") => new RefResolver(rulesVersion, collections);

test("a subrace resolves to its own entry on the race page", () => {
  // 5etools merges subraces into the race list at load, so "Dwarf (Hill)" is
  // an entry on races.html with its own source, and hashes like any race.
  const result = resolver().resolve("subrace", "Dwarf (Hill)");

  assert.equal(result.ok, true);
  assert.equal(result.value.page, "races.html");
  assert.equal(result.value.hash, "dwarf%20(hill)_phb");
  assert.equal(result.value.prop, "subrace");
});

test("the id the builder stores resolves the same as the name", () => {
  const bySlug = resolver().resolve("subrace", "dwarf-hill");
  const byName = resolver().resolve("subrace", "Dwarf (Hill)");

  assert.equal(bySlug.ok, true);
  assert.deepEqual(bySlug.value, byName.value);
});

test("a subrace is not a race, which is why it used to be lost", () => {
  // Resolved against `race`, every subrace was not-found: they are their own
  // collection. The build dropped the subrace and a hill dwarf reached Foundry
  // as a plain dwarf — the wrong character, not a missing field.
  assert.equal(resolver().resolve("race", "Dwarf (Hill)").ok, false);
});

test("every subrace resolves once it is told which book", () => {
  for (const rulesVersion of ["2014", "2024"]) {
    const rows = forRulesVersion(collections.subrace, rulesVersion);
    const unresolved = rows
      .filter((row) => !resolver(rulesVersion).resolve("subrace", row.name, row.source).ok)
      .map((row) => row.name);

    // One row is junk the generator produced: a subrace with no name. Named
    // here so a second one cannot appear unnoticed.
    // Every one, including the row the generator produced with no name: told
    // its book, even that resolves.
    assert.deepEqual(unresolved, []);
  }
});

test("a name two books share is refused rather than guessed", () => {
  // Ten of 2014's 98 subraces exist in more than one book — the Eladrin is in
  // both the DMG and Mordenkainen's, with different traits. Picking one for
  // the player would export a character they did not build, which is why the
  // Forge records the book beside the pick.
  const withoutBook = resolver().resolve("subrace", "Elf (Eladrin)");
  assert.equal(withoutBook.ok, false);
  assert.equal(withoutBook.failure.reason, "ambiguous");

  const withBook = resolver().resolve("subrace", "Elf (Eladrin)", "MTF");
  assert.equal(withBook.ok, true);
  assert.equal(withBook.value.source, "MTF");
});

test("a build carries its subrace through to the payload", () => {
  const build = {
    meta: {
      rulesVersion: "5e-2014",
      sourceProfile: "vault-v1",
      createdAt: "2026-08-27T10:00:00.000Z",
      updatedAt: "2026-08-27T10:00:00.000Z",
    },
    identity: { characterName: "Thrain", playerName: "Joe" },
    ancestry: { raceId: "dwarf", subraceId: "dwarf-hill" },
    classing: { classes: [{ classId: "fighter", level: 1 }] },
    background: { backgroundId: "acolyte", grantedFeatIds: [] },
    abilities: {
      generationMethod: "standard-array",
      base: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
      final: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
    },
    choices: { feats: [], proficiencies: [], spells: [], equipment: [], features: [] },
    derived: { proficiencyBonus: 2, hp: 12, ac: 10 },
  };

  const { payload, failures } = buildToPayload(build, resolver());

  assert.equal(failures.filter((entry) => entry.prop === "subrace").length, 0);
  assert.equal(payload.race.subrace.hash, "dwarf%20(hill)_phb");
});
