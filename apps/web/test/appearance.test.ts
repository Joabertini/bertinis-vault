/**
 * What the character looks like, from the Forge to the sheet and back.
 *
 * Nine boxes the dnd5e sheet already draws, and nine keys `system.details`
 * already has. Until now the builder captured none of them: a player who had
 * decided their character's age, height and eyes had nowhere to write it and
 * nothing to send.
 */

import { describe, expect, it } from "vitest";

import { buildCanonicalSnapshot, coerceBuilderState, initialState } from "@/lib/builder";
import { readFoundryActor } from "@/lib/foundry-import";
import { hasPalette, suggestAppearance } from "@/lib/appearance";

describe("what the snapshot carries", () => {
  it("sends each box under the name dnd5e keeps it by", () => {
    const build = buildCanonicalSnapshot({
      ...initialState,
      age: "27",
      height: "1,75 m",
      weight: "70 kg",
      eyes: "Grises",
      hair: "Negro",
      skin: "Palida",
      gender: "No binario",
      faith: "Ninguna",
      appearance: "Una cicatriz que le cruza la ceja.",
    });

    expect(build.identity.biography).toMatchObject({
      age: "27",
      height: "1,75 m",
      weight: "70 kg",
      eyes: "Grises",
      hair: "Negro",
      skin: "Palida",
      gender: "No binario",
      faith: "Ninguna",
      appearance: "Una cicatriz que le cruza la ceja.",
    });
  });

  it("leaves a blank box unset rather than sending an empty string", () => {
    // An empty string would blank a box the actor already had filled in, and
    // the module writes only what arrives as a non-empty string.
    const build = buildCanonicalSnapshot({ ...initialState, eyes: "Grises", age: "" });

    expect(build.identity.biography?.eyes).toBe("Grises");
    expect(build.identity.biography?.age).toBeUndefined();
  });
});

describe("reading one back", () => {
  it("takes the description off the actor's own fields", () => {
    const actor = {
      type: "character",
      name: "Rathma",
      items: [{ type: "class", name: "Paladin", system: { identifier: "paladin", levels: 1 } }],
      system: {
        abilities: {},
        details: { age: "31", eyes: "Verdes", appearance: "Armadura abollada." },
      },
    };

    const read = readFoundryActor(actor)!;

    expect(read.state.age).toBe("31");
    expect(read.state.eyes).toBe("Verdes");
    expect(read.state.appearance).toBe("Armadura abollada.");
    // A field the actor does not carry reads as empty, not as undefined.
    expect(read.state.faith).toBe("");
  });
});

describe("a draft saved before these existed", () => {
  it("opens with them empty instead of failing to open", () => {
    const { age, ...older } = { ...initialState, age: "27" };
    const state = coerceBuilderState(older);

    expect(state.age).toBe("");
    expect(state.appearance).toBe("");
  });
});

describe("what a species suggests you look like", () => {
  /** A fixed sequence, so a suggestion is a fact rather than a coin toss. */
  const fixed = (values: number[]) => {
    let at = 0;
    return () => values[at++ % values.length] ?? 0;
  };

  it("gives a dwarf a dwarf's build and a goliath a goliath's", () => {
    const dwarf = suggestAppearance("dwarf", "", "2014", null, fixed([0]));
    const goliath = suggestAppearance("goliath", "", "2014", null, fixed([0]));

    expect(dwarf?.height).toBe("1,22 m");
    expect(goliath?.height).toBe("2,13 m");
  });

  it("answers in the units the sheet asks for", () => {
    // The boxes are Spanish and their own placeholders read "1,75 m", "70 kg".
    const human = suggestAppearance("human", "", "2014", null, fixed([0.5]));

    expect(human?.height).toMatch(/^\d,\d\d m$/);
    expect(human?.weight).toMatch(/^\d+ kg$/);
  });

  it("gives a species it has no palette for a build and no invented colours", () => {
    // Inventing a palette for a species whose book nobody here has read would
    // put a wrong fact on a sheet. A blank box is a question the player answers.
    const suggestion = suggestAppearance("loxodon", "", "2014", null, fixed([0.5]));

    expect(suggestion?.height).not.toBe("");
    expect(suggestion?.eyes).toBe("");
    expect(hasPalette("loxodon")).toBe(false);
    expect(hasPalette("dwarf")).toBe(true);
  });

  it("says nothing when there is no species yet", () => {
    expect(suggestAppearance("", "", "2014")).toBeNull();
  });

  it("follows the chosen size for a species that offers two", () => {
    // The 2024 human is `["S","M"]`. A Small one and a Medium one are a metre
    // apart, so the suggestion has to follow the answer and not the species.
    const small = suggestAppearance("human", "", "2024", "S", fixed([0]));
    const medium = suggestAppearance("human", "", "2024", "M", fixed([0]));

    expect(small?.height).toBe("0,86 m");
    expect(medium?.height).toBe("1,47 m");
  });

  it("reads an unanswered size as Medium rather than as the first letter", () => {
    // Falling to `sizes[0]` would make every unanswered 2024 human Small,
    // which is the bug the array replaced.
    const unanswered = suggestAppearance("human", "", "2024", null, fixed([0]));
    const medium = suggestAppearance("human", "", "2024", "M", fixed([0]));

    expect(unanswered?.height).toBe(medium?.height);
  });
});
