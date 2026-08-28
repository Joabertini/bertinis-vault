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
