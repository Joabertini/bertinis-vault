/**
 * How much a character can carry, and when the load starts to cost them.
 *
 * One rule, printed the same in both editions: your carrying capacity is your
 * Strength score times 15, and you can push, drag or lift twice that. Size
 * changes it — a Small or Medium creature uses the number as printed, a Tiny
 * one halves it, and each size above Medium doubles it.
 *
 * The encumbrance thresholds are a *variant*, and are kept apart for that
 * reason. The 2014 Player's Handbook prints them as an optional rule a table
 * may adopt: carrying more than five times your Strength slows you by 10 feet,
 * and more than ten times slows you by 20 and gives disadvantage on everything
 * Strength, Dexterity or Constitution asks of you. A sheet that reported those
 * as the rule would be reporting a rule most tables do not use; one that hid
 * them would be hiding the numbers the tables that do use it need.
 */

/** dnd5e's size keys, smallest first. */
export type CreatureSize = "tiny" | "sm" | "med" | "lg" | "huge" | "grg";

/**
 * What size does to the number.
 *
 * Small and Medium are the same, which is why the table starts at 1 twice.
 */
const SIZE_FACTOR: Record<CreatureSize, number> = {
  tiny: 0.5,
  sm: 1,
  med: 1,
  lg: 2,
  huge: 4,
  grg: 8,
};

export type CarryingCapacity = {
  /** Strength times 15, adjusted for size. Over this, you cannot carry it. */
  capacity: number;
  /** Twice that: what you can push, drag or lift without carrying it. */
  pushDragLift: number;
  /** The optional variant's first threshold: speed drops by 10 feet. */
  encumbered: number;
  /** Its second: speed drops by 20 and every Str, Dex and Con roll has disadvantage. */
  heavilyEncumbered: number;
};

export function carryingCapacity(
  strength: number,
  size: CreatureSize = "med",
): CarryingCapacity {
  const factor = SIZE_FACTOR[size] ?? 1;
  const score = Math.max(strength, 0);

  return {
    capacity: score * 15 * factor,
    pushDragLift: score * 30 * factor,
    encumbered: score * 5 * factor,
    heavilyEncumbered: score * 10 * factor,
  };
}

/** Where a load sits against those numbers. */
export type LoadState = "clear" | "encumbered" | "heavily-encumbered" | "over-capacity";

/**
 * What a given weight means for this character.
 *
 * The variant thresholds are reported whether or not the table uses them,
 * because reporting them is not applying them: the sheet says what the load
 * is and the table decides what the load costs.
 */
export function loadStateFor(pounds: number, limits: CarryingCapacity): LoadState {
  if (pounds > limits.capacity) return "over-capacity";
  if (pounds > limits.heavilyEncumbered) return "heavily-encumbered";
  if (pounds > limits.encumbered) return "encumbered";
  return "clear";
}
