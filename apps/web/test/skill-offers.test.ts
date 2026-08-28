/**
 * Two offers, one list of picks.
 *
 * The draft stores proficiencies flat, because being proficient in Stealth is
 * one fact however you came by it. The asking is not flat: a class offers two
 * skills from its list and a background may offer two more from another.
 *
 * Read as one list they collided. Two picks from the class filled the
 * background's quota too, its options went grey before a single choice was made
 * in it, and the chamber could never be satisfied — the player could not go
 * back and could not go on.
 */

import { describe, expect, test } from "vitest";

import { assignOffers, offersAreSatisfied, type SkillOffer } from "../src/lib/grants";

const wizard: SkillOffer = {
  options: ["Arcana", "History", "Insight", "Investigation", "Medicine", "Religion"],
  count: 2,
  isOpen: false,
  from: "clase",
};

const background: SkillOffer = {
  options: ["Athletics", "Intimidation", "Survival", "Insight"],
  count: 2,
  isOpen: false,
  from: "trasfondo",
};

describe("two offers do not spend each other's budget", () => {
  test("picks from the class are charged to the class", () => {
    const [fromClass, fromBackground] = assignOffers(
      [wizard, background],
      ["Arcana", "Investigation"],
    );

    expect(fromClass).toEqual(["Arcana", "Investigation"]);
    // The background has not been asked yet. Before the fix it read as full
    // and locked every one of its options.
    expect(fromBackground).toEqual([]);
  });

  test("the chamber is unfinished until every offer is paid", () => {
    expect(offersAreSatisfied([wizard, background], ["Arcana", "Investigation"])).toBe(false);
    expect(
      offersAreSatisfied([wizard, background], ["Arcana", "Investigation", "Athletics"]),
    ).toBe(false);
    expect(
      offersAreSatisfied(
        [wizard, background],
        ["Arcana", "Investigation", "Athletics", "Survival"],
      ),
    ).toBe(true);
  });

  test("a skill both lists offer is paid for once, not twice", () => {
    // Insight is on both lists. Being proficient in it is one fact, so it
    // cannot settle two debts — counting it twice would let a character skip
    // a skill the books owe them.
    const [fromClass, fromBackground] = assignOffers([wizard, background], ["Insight"]);

    expect(fromClass).toEqual(["Insight"]);
    expect(fromBackground).toEqual([]);
    expect(offersAreSatisfied([wizard, background], ["Insight"])).toBe(false);
  });

  test("what one offer cannot pay for falls to the next", () => {
    // Athletics is not on the wizard's list, so it can only be the
    // background's — even though the background is second.
    const [fromClass, fromBackground] = assignOffers(
      [wizard, background],
      ["Athletics", "Arcana"],
    );

    expect(fromClass).toEqual(["Arcana"]);
    expect(fromBackground).toEqual(["Athletics"]);
  });

  test("a pick past an offer's limit is not charged to it", () => {
    const [fromClass] = assignOffers([wizard], ["Arcana", "History", "Medicine"]);

    expect(fromClass).toEqual(["Arcana", "History"]);
  });

  test("a skill from no list at all is ignored rather than throwing", () => {
    // Typed by hand, or left over from a class the player has since changed.
    const [fromClass] = assignOffers([wizard], ["Underwater Basket Weaving"]);

    expect(fromClass).toEqual([]);
  });

  test("no offers is satisfied, not blocked", () => {
    expect(offersAreSatisfied([], [])).toBe(true);
  });
});
