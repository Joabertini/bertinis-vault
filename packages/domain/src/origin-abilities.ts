/**
 * The ability increase a 2024 character gets from their background.
 *
 * This is the rule that most separates the two editions at level one, and the
 * builder used to get it wrong in the quietest way: 2014 puts the increase on
 * the species, 2024 moves it to the background, and the builder only ever read
 * the species. A 2024 character therefore reached the sheet three points short
 * — a 16 where the rules say 18 — with nothing reporting a problem.
 *
 * The shape is uniform across every background that has one: two alternatives
 * over the same three abilities. Either two of them take +2 and +1, or all
 * three take +1. How much is the rule; which abilities is the answer.
 */

import type { AbilityId } from "@bertinis-vault/contracts";

export type OriginAbilityOption = {
  /** The three abilities the background offers. */
  options: string[];
  /** Positional: [2, 1] means the first named ability takes +2. */
  amounts: number[];
};

/** Which alternative was taken, and which abilities fill it, in order. */
export type OriginAbilityAnswer = {
  optionIndex: number;
  /** As long as the alternative's `amounts`, in the same order. */
  abilities: string[];
};

const ABILITY_IDS = ["str", "dex", "con", "int", "wis", "cha"];

function isAbilityId(value: string): value is AbilityId {
  return ABILITY_IDS.includes(value);
}

/**
 * What the answer is worth, as a bonus map.
 *
 * An incomplete answer contributes what it has rather than nothing: a player
 * halfway through picking is not a player who chose zero, and the unanswered
 * half is reported separately by `unansweredOriginAbilities`.
 */
export function originAbilityBonuses(
  alternatives: OriginAbilityOption[] | null,
  answer: OriginAbilityAnswer | null,
): Partial<Record<AbilityId, number>> {
  if (!alternatives?.length || !answer) return {};

  const alternative = alternatives[answer.optionIndex];
  if (!alternative) return {};

  const bonuses: Partial<Record<AbilityId, number>> = {};

  for (const [slot, amount] of alternative.amounts.entries()) {
    const ability = answer.abilities[slot];
    // An ability the background does not offer is not a bonus it grants. A
    // draft edited by hand can name one, and it is dropped rather than obeyed.
    if (!ability || !isAbilityId(ability) || !alternative.options.includes(ability)) continue;
    bonuses[ability] = (bonuses[ability] ?? 0) + amount;
  }

  return bonuses;
}

/**
 * The slots still to fill, so the interface can say what is missing.
 *
 * The +1/+1/+1 alternative must name three different abilities and the +2/+1
 * one must name two, so a repeat is as unanswered as a blank: the same ability
 * cannot take both halves of the increase.
 */
export function unansweredOriginAbilities(
  alternatives: OriginAbilityOption[] | null,
  answer: OriginAbilityAnswer | null,
): number {
  if (!alternatives?.length) return 0;

  const alternative = alternatives[answer?.optionIndex ?? 0];
  if (!alternative) return 0;
  if (!answer) return alternative.amounts.length;

  const seen = new Set<string>();
  let filled = 0;

  for (let slot = 0; slot < alternative.amounts.length; slot += 1) {
    const ability = answer.abilities[slot];
    if (!ability || seen.has(ability) || !alternative.options.includes(ability)) continue;
    seen.add(ability);
    filled += 1;
  }

  return alternative.amounts.length - filled;
}

/** How an alternative reads on one line, so the two can be compared. */
export function describeOriginAbilityOption(option: OriginAbilityOption): string {
  return option.amounts.map((amount) => `+${amount}`).join(" / ");
}
