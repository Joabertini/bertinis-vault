/**
 * Mastery comes from the weapons the character has, not from a catalogue.
 */

import { describe, expect, it } from "vitest";

import { masteryPlanFor, masteryPlanForCarried, picksStillCarried } from "@/lib/weapon-mastery";

const fighter = [{ classId: "fighter", level: 5 }];

describe("mastery of the weapons carried", () => {
  it("offers only the weapons in the character's hands", () => {
    const plan = masteryPlanForCarried(masteryPlanFor(fighter, "2024"), ["Greatsword", "Flail", "Rope"]);

    expect(plan.options.map((option) => option.label).sort()).toEqual(["Flail", "Greatsword"]);
    expect(plan.count).toBeGreaterThan(0);
  });

  it("offers nothing for a character with no weapon that has a mastery", () => {
    const plan = masteryPlanForCarried(masteryPlanFor(fighter, "2024"), ["Rope", "Backpack"]);

    expect(plan.options).toEqual([]);
  });

  it("keeps a barbarian to melee weapons it carries", () => {
    const plan = masteryPlanForCarried(masteryPlanFor([{ classId: "barbarian", level: 1 }], "2024"), [
      "Greataxe",
      "Handaxe",
      "Longbow",
    ]);

    expect(plan.options.map((option) => option.label)).not.toContain("Longbow");
  });

  it("drops a mastery whose weapon left the bag", () => {
    const plan = masteryPlanForCarried(masteryPlanFor(fighter, "2024"), ["Greatsword"]);

    expect(picksStillCarried(["greatsword", "flail"], plan)).toEqual(["greatsword"]);
  });
});
