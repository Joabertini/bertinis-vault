/**
 * What the character carries, against what they can.
 *
 * The bag weighed itself and nothing compared the total to anything. Worse, it
 * weighed only the bag: the weapon and the armour are single picks with real
 * weight, and a suit of plate is 65 lb on its own.
 */

import { describe, expect, it } from "vitest";

import { initialState, type BuilderState } from "@/lib/builder";
import { carriedLoadFor } from "@/lib/carrying";

const draft = (over: Partial<BuilderState> = {}): BuilderState => ({
  ...initialState,
  weaponId: "",
  armorId: "",
  extraEquipmentText: "",
  ...over,
});

describe("what goes on the scale", () => {
  it("counts the armour, which the bag never did", () => {
    // Plate is 65 lb, which is more than half of what a Strength 8 character
    // can carry. Counting only the bag reported a load nobody was under.
    const bare = carriedLoadFor(draft(), "2014", 10);
    const plated = carriedLoadFor(draft({ armorId: "plate-armor" }), "2014", 10);

    expect(bare.pounds).toBe(0);
    expect(plated.pounds).toBeGreaterThan(60);
  });

  it("counts the weapon too", () => {
    const armed = carriedLoadFor(draft({ weaponId: "greataxe" }), "2014", 10);

    expect(armed.pounds).toBeGreaterThan(0);
  });

  it("weighs a stack by its quantity", () => {
    // Twenty arrows weigh twenty arrows.
    const one = carriedLoadFor(draft({ extraEquipmentText: "rations-1-day" }), "2014", 10);
    const many = carriedLoadFor(draft({ extraEquipmentText: "rations-1-day x5" }), "2014", 10);

    expect(many.pounds).toBeCloseTo(one.pounds * 5, 5);
  });

  it("says how much of the bag it could weigh at all", () => {
    // A hand-typed line the index does not know is left off the scale rather
    // than guessed at, and the total says it is partial.
    const load = carriedLoadFor(
      draft({ extraEquipmentText: "rations-1-day\nun recuerdo de mi madre" }),
      "2014",
      10,
    );

    expect(load.weighed).toBe(1);
    expect(load.lines).toBe(2);
  });
});

describe("against the limits", () => {
  it("reports the state the load is in", () => {
    // Strength 10: 50 encumbered, 100 heavily, 150 capacity.
    const limits = carriedLoadFor(draft(), "2014", 10).limits;

    expect(limits.capacity).toBe(150);
    expect(limits.encumbered).toBe(50);
    expect(limits.pushDragLift).toBe(300);
  });

  it("says nothing is wrong when nothing is", () => {
    expect(carriedLoadFor(draft({ armorId: "plate-armor" }), "2014", 20).state).toBe("clear");
  });

  it("flags a load past capacity, which is the only part the rules state", () => {
    const load = carriedLoadFor(draft({ extraEquipmentText: "plate-armor x10" }), "2014", 8);

    expect(load.state).toBe("over-capacity");
  });

  it("uses the size, so a halfling and a human of equal Strength carry the same", () => {
    // The book only halves it at Tiny and doubles it from Large up.
    expect(carriedLoadFor(draft(), "2014", 15, "sm").limits.capacity).toBe(225);
    expect(carriedLoadFor(draft(), "2014", 15, "lg").limits.capacity).toBe(450);
  });
});
