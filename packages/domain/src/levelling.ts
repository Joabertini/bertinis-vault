/**
 * The decisions a character makes on the way up.
 *
 * A level is not a number the sheet derives everything from. It is a sequence
 * of moments where the rules stop and ask: pick a subclass, raise two scores or
 * take a feat instead. The builder used to skip all of it — a level went in and
 * hit points came out — which meant a level 12 fighter and a level 12 wizard
 * were treated as having made the same number of choices. They have not: the
 * fighter has taken seven improvements to the wizard's three.
 *
 * The levels themselves are not hardcoded here. They come off the class row in
 * the index, read from each class's own feature list, because the familiar
 * [4, 8, 12, 16, 19] is wrong for the fighter, wrong for the rogue, and wrong
 * for every class in 2024.
 */

import type { AbilityId } from "@bertinis-vault/contracts";

import { abilityScoreCap, mergeBonuses, type AbilityBonusMap } from "./ability-bonuses.js";

/** Each improvement is worth two points: +2 to one score, or +1 to two. */
export const pointsPerImprovement = 2;

/** The most a single improvement can add to one score. */
export const maxPointsPerAbility = 2;

/** What the rules ask for at a given level. */
export type LevelDecision =
  /** Choose the subclass this class unlocks. */
  | { level: number; kind: "subclass" }
  /** Raise ability scores, or take a feat in their place. */
  | { level: number; kind: "ability-or-feat" };

/** What the player answered. */
export type LevelChoice =
  | { kind: "improvement"; bonuses: AbilityBonusMap }
  | { kind: "feat"; featId: string; bonuses?: AbilityBonusMap };

/** The class facts a level plan is built from, as the index records them. */
export type LevellingClass = {
  improvementLevels: number[];
  subclassLevel: number | null;
};

/**
 * Every decision a character of this level has reached, in level order.
 *
 * A decision at exactly the character's level counts: a level 4 character has
 * taken their level 4 improvement.
 */
export function levelDecisions(entry: LevellingClass, level: number): LevelDecision[] {
  const decisions: LevelDecision[] = [];

  if (entry.subclassLevel !== null && level >= entry.subclassLevel) {
    decisions.push({ level: entry.subclassLevel, kind: "subclass" });
  }

  for (const improvementLevel of entry.improvementLevels) {
    if (level >= improvementLevel) {
      decisions.push({ level: improvementLevel, kind: "ability-or-feat" });
    }
  }

  return decisions.sort((a, b) => a.level - b.level);
}

/** The levels at which this character must choose an improvement or a feat. */
export function improvementLevels(entry: LevellingClass, level: number): number[] {
  return entry.improvementLevels.filter((improvementLevel) => level >= improvementLevel);
}

/** Whether the character still has a decision waiting at some level. */
export function unansweredImprovementLevels(
  entry: LevellingClass,
  level: number,
  choices: Record<number, LevelChoice>,
): number[] {
  return improvementLevels(entry, level).filter((improvementLevel) => {
    const choice = choices[improvementLevel];
    if (!choice) return true;
    if (choice.kind === "feat") return !choice.featId;
    return pointsSpent(choice.bonuses) < pointsPerImprovement;
  });
}

/** How many of an improvement's two points a set of raises uses. */
export function pointsSpent(bonuses: AbilityBonusMap): number {
  return Object.values(bonuses).reduce((sum, amount) => sum + (amount ?? 0), 0);
}

/** Why an improvement is not a legal one. */
export type ImprovementProblem =
  | { reason: "too-many-points"; spent: number }
  | { reason: "too-much-in-one"; ability: AbilityId; amount: number }
  | { reason: "negative"; ability: AbilityId; amount: number }
  | { reason: "over-cap"; ability: AbilityId; total: number };

/**
 * Check one improvement against the rules that govern it.
 *
 * Deliberately not silent clamping: a player who tries to put three points in
 * Strength has misread something, and correcting them without saying so leaves
 * them with a sheet that does not match what they think they built.
 */
export function improvementProblems(
  bonuses: AbilityBonusMap,
  scoresBefore?: Partial<Record<AbilityId, number>>,
): ImprovementProblem[] {
  const problems: ImprovementProblem[] = [];
  const entries = Object.entries(bonuses) as Array<[AbilityId, number]>;

  for (const [ability, amount] of entries) {
    if (amount < 0) problems.push({ reason: "negative", ability, amount });
    else if (amount > maxPointsPerAbility) {
      problems.push({ reason: "too-much-in-one", ability, amount });
    }

    const before = scoresBefore?.[ability];
    if (before !== undefined && before + amount > abilityScoreCap) {
      problems.push({ reason: "over-cap", ability, total: before + amount });
    }
  }

  const spent = pointsSpent(bonuses);
  if (spent > pointsPerImprovement) problems.push({ reason: "too-many-points", spent });

  return problems;
}

/**
 * The scores every level choice adds up to.
 *
 * A feat contributes whatever half-feat bonus it carries, which the player
 * records alongside the feat: the index has no machine-readable statement of
 * what a feat grants, and inventing one would be worse than asking.
 */
/**
 * The raises the improvements contribute — improvements only.
 *
 * A feat's own increase is deliberately **not** counted here, even though a
 * feat choice can still carry one from an older draft. A feat's raise belongs
 * to the feat, wherever it was taken from: at a level, from a background, or
 * from the variant human, and only the first of those has a level slot to live
 * in. `bonusesFromFeats` is the single path, and excluding feats here is what
 * makes it impossible to count the same point twice — which is the failure this
 * codebase has hit more than once.
 */
export function bonusesFromChoices(choices: Record<number, LevelChoice>): AbilityBonusMap {
  return mergeBonuses(
    ...Object.values(choices).map((choice) => (choice.kind === "improvement" ? choice.bonuses : {})),
  );
}

/** The feats taken across the levels, in level order, without blanks. */
export function featsFromChoices(choices: Record<number, LevelChoice>): string[] {
  return Object.entries(choices)
    .sort(([a], [b]) => Number(a) - Number(b))
    .flatMap(([, choice]) => (choice.kind === "feat" && choice.featId ? [choice.featId] : []));
}
