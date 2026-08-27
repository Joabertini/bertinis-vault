import { describe, expect, test } from "vitest";

import { initialState, type BuilderState } from "../src/lib/builder";
import { originAbilityAllowanceFor } from "../src/lib/improvements";

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
