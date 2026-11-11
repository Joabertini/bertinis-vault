/**
 * The slot map comes keyed three ways; the picker needs one count per level.
 */

import { describe, expect, it } from "vitest";

import { slotsByLevelOf } from "@/lib/spells";

describe("slotsByLevelOf", () => {
  it("reads `spell3`, a bare `3` and a warlock's pact slots", () => {
    expect(slotsByLevelOf({ spell1: 4, spell2: 3 }, 0)).toEqual({ 1: 4, 2: 3 });
    expect(slotsByLevelOf({ "1": 2, "2": 1 }, 0)).toEqual({ 1: 2, 2: 1 });
    expect(slotsByLevelOf({ pact: 2 }, 3)).toEqual({ 3: 2 });
  });

  it("skips empty levels and a pact with no level", () => {
    expect(slotsByLevelOf({ spell1: 0, spell2: 2 }, 0)).toEqual({ 2: 2 });
    expect(slotsByLevelOf({ pact: 2 }, 0)).toEqual({});
  });
});
