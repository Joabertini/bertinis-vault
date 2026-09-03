import { describe, expect, test } from "vitest";

import { initialState, type BuilderState } from "../src/lib/builder";
import { originAbilityAllowanceFor, seedSpeciesBonus } from "../src/lib/improvements";

const build = (over: Partial<BuilderState> = {}): BuilderState => ({
  ...initialState,
  abilityBonuses: {},
  levelChoices: {},
  sourceBooks: {},
  ...over,
});

describe("which abilities the origin increase may go into", () => {
  test("a 2024 background names three, and only those three", () => {
    // The Acolyte raises Intelligence, Wisdom or Charisma. An editor offering
    // all six let a player put its +2 into Strength.
    const allowed = originAbilityAllowanceFor(
      build({ rulesVersion: "5e-2024", backgroundId: "acolyte" }),
      "2024",
    );

    expect(allowed).toEqual(["int", "wis", "cha"]);
  });

  test("a different background names a different three", () => {
    expect(
      originAbilityAllowanceFor(
        build({ rulesVersion: "5e-2024", backgroundId: "archaeologist" }),
        "2024",
      ),
    ).toEqual(["dex", "int", "wis"]);
  });

  test("2014 restricts nothing, because the species grants what it grants", () => {
    expect(
      originAbilityAllowanceFor(
        build({ rulesVersion: "5e-2014", backgroundId: "acolyte" }),
        "2014",
      ),
    ).toBeNull();
  });

  test("no background yet restricts nothing", () => {
    expect(
      originAbilityAllowanceFor(build({ rulesVersion: "5e-2024", backgroundId: "" }), "2024"),
    ).toBeNull();
  });

  test("a background the index has never heard of allows everything, not nothing", () => {
    // Locking the editor to no ability at all would be worse than not
    // restricting it: the player could finish no character.
    expect(
      originAbilityAllowanceFor(
        build({ rulesVersion: "5e-2024", backgroundId: "trasfondo-fantasma" }),
        "2024",
      ),
    ).toBeNull();
  });
});

describe("what the species seeds the increase with", () => {
  test("a 2024 species seeds nothing, because 2024 moved it to the background", () => {
    /*
     * The bug a player found by making a 2024 human. Every 2024 species
     * records `null` in the index, so the seed fell through to a hand-written
     * table that is the *2014* one — and the 2014 human is six +1s. The 2024
     * editor then counted six against a budget of three and offered only the
     * three abilities the background names, so the panel opened at 6/3 with
     * nothing addable and points that could only be taken away.
     */
    expect(seedSpeciesBonus(build({ rulesVersion: "5e-2024", raceId: "human" }), "2024")).toEqual(
      {},
    );
  });

  test("no 2024 species seeds anything, human or otherwise", () => {
    for (const raceId of ["human", "elf", "dwarf", "halfling", "tiefling", "orc"]) {
      expect(seedSpeciesBonus(build({ rulesVersion: "5e-2024", raceId }), "2024")).toEqual({});
    }
  });

  test("2014 is untouched: the species still grants what the book prints", () => {
    // The guard. The edition that does hand out an increase must keep it.
    const dwarf = seedSpeciesBonus(build({ rulesVersion: "5e-2014", raceId: "dwarf" }), "2014");

    expect(dwarf.con).toBe(2);
  });

  test("the 2014 human is still six ones", () => {
    const human = seedSpeciesBonus(build({ rulesVersion: "5e-2014", raceId: "human" }), "2014");

    expect(human).toEqual({ str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 });
  });
});
