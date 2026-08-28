/**
 * The four ways a character gets its six numbers.
 *
 * All four already existed in `StatMethod` and all four already map to the
 * payload's `generationMethod`. Only rolling was ever wired to a screen, so a
 * player who buys points or takes the standard array — which is most players —
 * had to roll and then talk the dice into the answer they wanted.
 *
 * The tables here are the printed ones, not house rules:
 *
 *   Standard array   15 14 13 12 10 8, assigned in any order
 *   Point buy        27 points, scores from 8 to 15, cost rising at 14 and 15
 *   Rolling          4d6 drop lowest, six times
 *   Manual           whatever the table agreed on
 *
 * The two jumps in the cost table are the whole point of point buy: 13→14
 * costs two points instead of one, and 14→15 costs two more. That is what
 * makes spreading cheaper than one big score, and it is why the guide says a
 * 15/14/13/12/10/8 spread beats dumping to buy a single 16 — which point buy
 * cannot reach at all.
 */

import { ABILITY_IDS, type AbilityId } from "./abilities";

export type StatMethodId = "roll" | "pointbuy" | "array" | "manual";

export const STAT_METHODS: Array<{
  id: StatMethodId;
  label: string;
  blurb: string;
}> = [
  {
    id: "pointbuy",
    label: "Compra de puntos",
    blurb: "27 puntos entre las seis. Nada baja de 8 ni sube de 15 antes de los bonus.",
  },
  {
    id: "array",
    label: "Arreglo estandar",
    blurb: "15, 14, 13, 12, 10 y 8. Los repartis como quieras.",
  },
  {
    id: "roll",
    label: "Tirada",
    blurb: "4d6 y descartas el menor, seis veces. Tres tiradas para elegir.",
  },
  {
    id: "manual",
    label: "A mano",
    blurb: "Escribis los seis numeros. Para mesas con sus propias reglas.",
  },
];

/** 15, 14, 13, 12, 10, 8. */
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const;

/** What point buy will sell, and for how much. */
const POINT_BUY_COST: Record<number, number> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  // The two jumps. Everything about point buy follows from these.
  14: 7,
  15: 9,
};

export const POINT_BUY_BUDGET = 27;
export const POINT_BUY_MIN = 8;
export const POINT_BUY_MAX = 15;

/** What one score costs. Null for a score point buy cannot sell. */
export function pointBuyCost(score: number): number | null {
  return POINT_BUY_COST[score] ?? null;
}

/** What a whole spread costs. Scores off the table count as zero. */
export function pointBuySpent(scores: Record<AbilityId, number>): number {
  let total = 0;
  for (const ability of ABILITY_IDS) total += pointBuyCost(scores[ability]) ?? 0;
  return total;
}

/**
 * Whether one more point into this score is affordable.
 *
 * Checked against the cost of the *step*, not of the score, because the step
 * from 13 to 14 costs two and a budget with one point left cannot pay it.
 */
export function canRaise(scores: Record<AbilityId, number>, ability: AbilityId): boolean {
  const current = scores[ability];
  if (current >= POINT_BUY_MAX) return false;

  const step = (pointBuyCost(current + 1) ?? 0) - (pointBuyCost(current) ?? 0);
  return pointBuySpent(scores) + step <= POINT_BUY_BUDGET;
}

export function canLower(scores: Record<AbilityId, number>, ability: AbilityId): boolean {
  return scores[ability] > POINT_BUY_MIN;
}

/** Every ability at the floor, which is where point buy starts. */
export function pointBuyFloor(): Record<AbilityId, number> {
  return Object.fromEntries(ABILITY_IDS.map((ability) => [ability, POINT_BUY_MIN])) as Record<
    AbilityId,
    number
  >;
}

/**
 * One 4d6-drop-lowest score.
 *
 * Six of these is a rolled character. The lowest die is dropped rather than
 * the first, which is the difference between an average of 12.24 and one of
 * 10.5 — the whole reason the rule is written that way.
 */
export function rollOneScore(): number {
  const dice = [0, 0, 0, 0].map(() => 1 + Math.floor(Math.random() * 6));
  dice.sort((a, b) => a - b);
  return dice[1]! + dice[2]! + dice[3]!;
}

export function rollSix(): number[] {
  return [0, 0, 0, 0, 0, 0].map(rollOneScore);
}

/** How many rolled sets a player gets to choose between. */
export const ROLL_ATTEMPTS = 3;

/** The sum of a set's modifiers — the one number that compares two spreads. */
export function spreadWorth(scores: number[]): number {
  return scores.reduce((total, score) => total + Math.floor((score - 10) / 2), 0);
}
