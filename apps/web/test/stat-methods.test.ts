/**
 * The four ways a character gets its six numbers, and what each owes.
 *
 * Written because two of the four did not work. Point buy could not be left —
 * the chamber asked every method the pool question and point buy has no pool —
 * and "a mano" had no screen at all. Both were reported from a real table.
 */

import { describe, expect, test } from "vitest";

import { ABILITY_IDS, type AbilityId } from "../src/lib/abilities";
import {
  POINT_BUY_BUDGET,
  STANDARD_ARRAY,
  abilitiesSettled,
  pointBuyFloor,
  pointBuySpent,
  scratchForMethod,
} from "../src/lib/stat-methods";

const spread = (values: number[]): Record<AbilityId, number> =>
  Object.fromEntries(ABILITY_IDS.map((ability, index) => [ability, values[index] ?? 10])) as Record<
    AbilityId,
    number
  >;

describe("whether the six numbers let a player move on", () => {
  test("point buy settles without binding anything, which is the bug", () => {
    // The whole report: the player assigns their points and the button stays
    // dead. Point buy writes straight onto the draft, so nothing is ever
    // bound and the old question could never be answered.
    const bought = spread([15, 14, 13, 12, 10, 8]);

    expect(pointBuySpent(bought)).toBeLessThanOrEqual(POINT_BUY_BUDGET);
    expect(abilitiesSettled({ method: "pointbuy", scores: bought, boundCount: 0 })).toBe(true);
  });

  test("point buy at the floor is settled too, unspent points and all", () => {
    // Leaving points is the player's business — it costs them, and the panel
    // says so in the accent colour. It is not a question left unanswered.
    expect(abilitiesSettled({ method: "pointbuy", scores: pointBuyFloor(), boundCount: 0 })).toBe(
      true,
    );
  });

  test("a spread over budget is not settled", () => {
    const overspent = spread([15, 15, 15, 15, 15, 15]);

    expect(pointBuySpent(overspent)).toBeGreaterThan(POINT_BUY_BUDGET);
    expect(abilitiesSettled({ method: "pointbuy", scores: overspent, boundCount: 0 })).toBe(false);
  });

  test("the pool methods still owe every ability a score", () => {
    const rolled = spread([16, 15, 14, 12, 11, 9]);

    for (const method of ["roll", "array"] as const) {
      expect(abilitiesSettled({ method, scores: rolled, boundCount: 5 })).toBe(false);
      expect(abilitiesSettled({ method, scores: rolled, boundCount: 6 })).toBe(true);
    }
  });

  test("a mano refuses nothing, because the table already agreed", () => {
    expect(abilitiesSettled({ method: "manual", scores: spread([8, 8, 8, 8, 8, 8]), boundCount: 0 }))
      .toBe(true);
  });
});

describe("what switching method keeps", () => {
  const sets = [
    [15, 14, 13, 12, 10, 8],
    [16, 12, 12, 11, 10, 9],
  ];

  test("the throws survive a look at another method", () => {
    // The second report: a player opened point buy to compare it against what
    // they rolled, and the roll was gone when they came back. Three throws
    // that cannot be made again, destroyed by reading another screen.
    for (const method of ["pointbuy", "array", "manual", "roll"] as const) {
      expect(scratchForMethod(method, sets).sets).toEqual(sets);
    }
  });

  test("the pool and the bindings do not", () => {
    // A rolled 17 carried into point buy would be a spread point buy cannot
    // sell, against a budget it never paid.
    const next = scratchForMethod("pointbuy", sets);

    expect(next.pool).toEqual([]);
    expect(next.bound).toEqual([]);
  });

  test("the standard array arrives as a pool of its own six", () => {
    expect(scratchForMethod("array", sets).pool).toEqual([...STANDARD_ARRAY]);
  });
});
