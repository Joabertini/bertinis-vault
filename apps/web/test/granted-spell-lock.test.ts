/**
 * What a character is handed outright is shown as given and costs no pick.
 */

import { describe, expect, it } from "vitest";

import { grantedNameSet, spellNameOf } from "@/lib/spells";

describe("granted spells in the pickers", () => {
  it("compares picker options and granted spells on the same lowercase name", () => {
    const granted = grantedNameSet([{ label: "Bless" }, { label: " Cure Wounds " }, { label: "thaumaturgy" }]);

    expect(granted.has(spellNameOf("Nv1: Bless"))).toBe(true);
    expect(granted.has(spellNameOf("Nv1: Cure Wounds"))).toBe(true);
    expect(granted.has(spellNameOf("Thaumaturgy"))).toBe(true);
    expect(granted.has(spellNameOf("Nv1: Bane"))).toBe(false);
  });

  it("reads a level prefix of any size", () => {
    expect(spellNameOf("Nv9: Wish")).toBe("wish");
    expect(spellNameOf("Nv12: Hold Person")).toBe("hold person");
  });
});
