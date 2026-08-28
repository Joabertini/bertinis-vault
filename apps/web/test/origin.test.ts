/**
 * Customizing Your Origin, as blocks.
 *
 * The rule moves a species' increase whole and forbids landing two blocks on
 * one ability. Modelled as loose points it allowed both things the rule
 * forbids: a gnome at +1/+1/+1, and a +2 split in half.
 */

import { describe, expect, test } from "vitest";

import {
  assignmentComplete,
  assignmentFrom,
  bonusesFromAssignment,
  originBlocksFor,
  placeBlock,
} from "../src/lib/origin";

/** Gnome: +2 from the species, +1 from the subrace. */
const gnome = { int: 2, con: 1 };
/** Mountain dwarf: two blocks of the same size. */
const mountainDwarf = { str: 2, con: 2 };
/** 2014 human: six blocks of one, which is already every ability. */
const human = { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 };

describe("the blocks a species hands over", () => {
  test("a gnome hands over a +2 and a +1, largest first", () => {
    expect(originBlocksFor(gnome)).toEqual([2, 1]);
  });

  test("a mountain dwarf hands over two twos, not one four", () => {
    expect(originBlocksFor(mountainDwarf)).toEqual([2, 2]);
  });

  test("a human hands over six ones", () => {
    expect(originBlocksFor(human)).toEqual([1, 1, 1, 1, 1, 1]);
  });

  test("a species that grants nothing hands over nothing", () => {
    expect(originBlocksFor({})).toEqual([]);
  });
});

describe("reading where the blocks already are", () => {
  test("the printed spread reads back as itself", () => {
    expect(assignmentFrom(gnome, [2, 1])).toEqual(["int", "con"]);
  });

  test("a moved spread reads back moved", () => {
    expect(assignmentFrom({ dex: 2, wis: 1 }, [2, 1])).toEqual(["dex", "wis"]);
  });

  test("two equal blocks each find their own ability", () => {
    const assignment = assignmentFrom(mountainDwarf, [2, 2]);

    expect(assignment).toHaveLength(2);
    expect(new Set(assignment).size).toBe(2);
  });

  test("a spread no legal move produces leaves blocks unplaced", () => {
    // A draft written while this was a pot of loose points. Refusing to read it
    // would leave the editor disagreeing with the player's own sheet; matching
    // what fits shows the work as unfinished, which is what it is.
    const assignment = assignmentFrom({ str: 1, dex: 1, con: 1 }, [2, 1]);

    expect(assignment[0]).toBeNull();
    expect(assignment[1]).not.toBeNull();
    expect(assignmentComplete(assignment)).toBe(false);
  });
});

describe("placing a block", () => {
  test("an empty ability just takes it", () => {
    expect(placeBlock(["int", "con"], 0, "str")).toEqual(["str", "con"]);
  });

  test("an ability another block holds swaps them rather than stacking", () => {
    // The one thing the rule forbids is two blocks on one ability. Swapping is
    // both what the player meant and the only legal reading.
    expect(placeBlock(["int", "con"], 0, "con")).toEqual(["con", "int"]);
  });

  test("no two blocks ever share an ability", () => {
    const after = placeBlock(placeBlock(["int", "con"], 0, "wis"), 1, "wis");

    expect(new Set(after.filter(Boolean)).size).toBe(after.filter(Boolean).length);
  });
});

describe("what the assignment produces", () => {
  test("blocks land whole, never split", () => {
    expect(bonusesFromAssignment([2, 1], ["str", "cha"])).toEqual({ str: 2, cha: 1 });
  });

  test("the total never changes, wherever the blocks go", () => {
    const moved = bonusesFromAssignment([2, 1], ["dex", "wis"]);
    const sum = (map: Record<string, number>) =>
      Object.values(map).reduce((total, value) => total + value, 0);

    expect(sum(moved)).toBe(sum(gnome));
  });

  test("an unplaced block adds nothing rather than a zero", () => {
    expect(bonusesFromAssignment([2, 1], [null, "cha"])).toEqual({ cha: 1 });
  });
});
