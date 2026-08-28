/**
 * The hit points a character already had, on the way back in.
 *
 * Measured on the real paladin 5 in `probes/fixtures`: the class item records
 * `HitPoints` per level and `system.attributes.hp.max` is **null**, so the
 * advancement is the only place the answer exists. Rebuilding at the average
 * gave that character 44 where their sheet says 60.
 */

import { describe, expect, it } from "vitest";

import { readFoundryActor } from "@/lib/foundry-import";
import { buildCanonicalSnapshot } from "@/lib/builder";
import actor from "../probes/fixtures/rathma-paladin-5.json";

describe("reading hit points off a real actor", () => {
  it("takes what each level gave rather than the average", () => {
    const read = readFoundryActor(actor);

    expect(read).not.toBeNull();
    expect(read!.state.hpMethod).toBe("rolled");
    // Four d10 levels at maximum, which is how this character was levelled.
    expect(read!.state.hpRolls).toEqual({ "2": 10, "3": 10, "4": 10, "5": 10 });
  });

  it("derives the total the character's own sheet carries", () => {
    const read = readFoundryActor(actor)!;
    const build = buildCanonicalSnapshot(read.state);

    expect(build.derived.hp).toBe(actor.system.attributes.hp.value);
  });

  it("says average when the actor records nothing to say otherwise", () => {
    const bare = {
      type: "character",
      name: "Sin historial",
      items: [{ type: "class", name: "Fighter", system: { identifier: "fighter", levels: 3 } }],
      system: { abilities: {}, details: {} },
    };

    const read = readFoundryActor(bare)!;

    expect(read.state.hpMethod).toBe("average");
    expect(read.state.hpRolls).toEqual({});
  });
});
