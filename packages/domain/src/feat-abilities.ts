/**
 * The ability increase a feat carries, and whether the player answered it.
 *
 * 159 of the 276 feats raise something, and on an odd score that raise is the
 * most efficient purchase in the game: a half-feat buys its effect *and* the
 * modifier point a plain improvement would have bought, which no flat
 * improvement can match in the same slot. It is the reason a full caster
 * deliberately opens at 17 rather than 16 or 18.
 *
 * Nothing recorded it. A feat choice stored an id and stopped, so Resilient,
 * Fey Touched and Telekinetic raised nothing and the sheet said so without
 * saying why. That is the worst category of gap this project tracks: answered
 * wrong rather than left blank, because nothing on the sheet tells the player
 * it happened.
 *
 * What is *not* here is a list of which feats raise what. That comes off the
 * index, which reads it from 5etools.
 */

import type { AbilityId } from "@bertinis-vault/contracts";

import type { AbilityBonusMap } from "./ability-bonuses.js";

const ABILITY_IDS: AbilityId[] = ["str", "dex", "con", "int", "wis", "cha"];

/**
 * Whether a string from the data names one of the six abilities.
 *
 * 5etools pools are plain strings, and a pool naming something that is not an
 * ability would otherwise be carried into the sheet and land nowhere. Dropping
 * it here is the honest reading: an increase we cannot place is an increase we
 * cannot apply.
 */
export function isAbilityId(value: string): value is AbilityId {
  return (ABILITY_IDS as string[]).includes(value);
}

/** A fixed increase, or a pool to choose from. */
export type FeatAbilityGrantLike =
  | { kind: "fixed"; bonuses: Record<string, number> }
  | { kind: "choice"; from: string[]; amount: number; count: number };

/** What a feat's grants add up to, and what the player still has to answer. */
export type FeatAbilityRequirement = {
  /** Raises the feat applies with no question asked. */
  fixed: AbilityBonusMap;
  /** Pools the player picks from. Empty when the feat asks nothing. */
  choices: { from: string[]; amount: number; count: number }[];
  /** How many points the choices are worth in total. */
  points: number;
};

/**
 * Split a feat's grants into what it applies and what it asks.
 *
 * A feat can do both, though none in the current data does; keeping them apart
 * costs nothing and means a feat that starts doing both is not a special case.
 */
export function featAbilityRequirement(
  grants: FeatAbilityGrantLike[],
): FeatAbilityRequirement {
  const fixed: AbilityBonusMap = {};
  const choices: FeatAbilityRequirement["choices"] = [];
  let points = 0;

  for (const grant of grants) {
    if (grant.kind === "fixed") {
      for (const [ability, amount] of Object.entries(grant.bonuses)) {
        if (!isAbilityId(ability)) continue;
        fixed[ability] = (fixed[ability] ?? 0) + amount;
      }
      continue;
    }

    choices.push({ from: grant.from, amount: grant.amount, count: grant.count });
    points += grant.amount * grant.count;
  }

  return { fixed, choices, points };
}

/** Why a feat's ability increase does not match what the feat offers. */
export type FeatAbilityProblem =
  /** The player has not spent everything the feat grants. */
  | { kind: "unspent"; points: number; spent: number }
  /** More was taken than the feat grants. */
  | { kind: "overspent"; points: number; spent: number }
  /** An ability was raised that none of the feat's pools offer. */
  | { kind: "not-offered"; ability: string }
  /** Spread across more abilities than the feat lets you choose. */
  | { kind: "too-many-abilities"; allowed: number; chosen: number };

/**
 * Check a feat's chosen increase against what the feat actually offers.
 *
 * An empty result means the choice is answered and legal. A feat that grants
 * nothing and was given nothing is answered, which is why the common case
 * costs no interaction.
 *
 * Fixed grants are not the player's to answer and are not checked here — they
 * are applied, not chosen.
 */
export function featAbilityProblems(
  grants: FeatAbilityGrantLike[],
  chosen: AbilityBonusMap,
): FeatAbilityProblem[] {
  const requirement = featAbilityRequirement(grants);
  const problems: FeatAbilityProblem[] = [];

  const entries = Object.entries(chosen).filter(([, amount]) => (amount ?? 0) > 0);
  const spent = entries.reduce((sum, [, amount]) => sum + (amount ?? 0), 0);

  if (spent < requirement.points) {
    problems.push({ kind: "unspent", points: requirement.points, spent });
  }
  if (spent > requirement.points) {
    problems.push({ kind: "overspent", points: requirement.points, spent });
  }

  // Every pool the feat offers, flattened. A raise is legal if any pool allows
  // it, which is the right reading for a feat with more than one pool: the
  // pools are alternatives to spend within, not a sequence to satisfy in order.
  const offered = new Set(requirement.choices.flatMap((choice) => choice.from));
  for (const [ability] of entries) {
    if (!offered.has(ability)) problems.push({ kind: "not-offered", ability });
  }

  const allowed = requirement.choices.reduce((sum, choice) => sum + choice.count, 0);
  if (entries.length > allowed) {
    problems.push({ kind: "too-many-abilities", allowed, chosen: entries.length });
  }

  return problems;
}

/** A feat the character has taken, with whatever increase was chosen for it. */
export type TakenFeat = {
  /** Where it came from, so a report can say which one is unanswered. */
  featId: string;
  grants: FeatAbilityGrantLike[];
  bonuses: AbilityBonusMap;
};

/** Every taken feat whose ability increase is still unanswered or illegal. */
export function unansweredFeatAbilities(
  feats: TakenFeat[],
): { featId: string; problems: FeatAbilityProblem[] }[] {
  return feats
    .map((feat) => ({ featId: feat.featId, problems: featAbilityProblems(feat.grants, feat.bonuses) }))
    .filter((entry) => entry.problems.length > 0);
}

/**
 * The increases a set of taken feats contributes, chosen and fixed together.
 *
 * Fixed grants are included because nothing else applies them: a feat that
 * raises Constitution outright has no question to ask, and until this existed
 * that raise reached the sheet no more than a chosen one did.
 */
export function bonusesFromFeats(feats: TakenFeat[]): AbilityBonusMap {
  const total: AbilityBonusMap = {};

  const add = (ability: string, amount: number) => {
    if (!isAbilityId(ability)) return;
    total[ability] = (total[ability] ?? 0) + amount;
  };

  for (const feat of feats) {
    for (const [ability, amount] of Object.entries(featAbilityRequirement(feat.grants).fixed)) {
      add(ability, amount ?? 0);
    }
    for (const [ability, amount] of Object.entries(feat.bonuses)) {
      if ((amount ?? 0) > 0) add(ability, amount ?? 0);
    }
  }

  return total;
}
