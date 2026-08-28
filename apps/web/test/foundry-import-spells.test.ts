import { describe, expect, test } from "vitest";

import { readFoundryActor } from "../src/lib/foundry-import";

/**
 * A sheet with one spell prepared and one not, which is the only distinction
 * the actor keeps and the only one worth reading back.
 */
const actorWith = (className: string) => ({
  name: "Prueba",
  type: "character",
  system: { details: {}, abilities: {} },
  items: [
    { type: "class", name: className, system: { levels: 3 } },
    { type: "spell", name: "Fire Bolt", system: { level: 0 } },
    { type: "spell", name: "Shield", system: { level: 1, prepared: 1 } },
    { type: "spell", name: "Magic Missile", system: { level: 1, prepared: 0 } },
  ],
});

const linesOf = (value: string) => value.split("\n").filter(Boolean);

describe("reading spells back off an actor", () => {
  test("a wizard's unprepared spell is in the book and not prepared", () => {
    const state = readFoundryActor(actorWith("Wizard"))?.state;

    expect(linesOf(state?.spellsText ?? "")).toEqual(["Nv1: Shield"]);
    expect(linesOf(state?.spellbookText ?? "")).toEqual(["Nv1: Shield", "Nv1: Magic Missile"]);
  });

  test("everyone else keeps every spell, because there is no book to lose it in", () => {
    /*
     * Measured on a real paladin export: 16 of its 40 spells sat at
     * `prepared: 0`. Reading those as a book nobody has a chamber for would
     * drop them off the sheet on the way back in.
     */
    const state = readFoundryActor(actorWith("Paladin"))?.state;

    expect(linesOf(state?.spellsText ?? "")).toEqual(["Nv1: Shield", "Nv1: Magic Missile"]);
    expect(state?.spellbookText).toBe("");
  });

  test("cantrips are never in the book", () => {
    // "except your cantrips, which are fixed in your mind".
    const state = readFoundryActor(actorWith("Wizard"))?.state;

    expect(linesOf(state?.cantripsText ?? "")).toEqual(["Fire Bolt"]);
    expect(state?.spellbookText).not.toContain("Fire Bolt");
  });
});
