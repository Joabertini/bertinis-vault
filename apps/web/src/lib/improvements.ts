/**
 * Where a character's ability scores grow after the dice.
 *
 * Three sources, and until now the front applied none of them:
 *
 *   the species    +2 Constitution to a dwarf, and so on
 *   the levels     two points at 4, 8, 12, 16, 19 — or a feat instead
 *   half-feats     the +1 that Resilient and Fey Touched carry
 *
 * All three land in `applyAbilityBonuses` inside `buildCanonicalSnapshot`, so
 * a character missing them exports with the scores they rolled and nothing
 * else — a level 12 fighter with a 15 Strength.
 */

import { characterLevel } from "./classing";
import {
  abilityScoreCap,
  bonusesFromChoices,
  bonusesFromFeats,
  improvementLevels,
  maxPointsPerAbility,
  pointsPerImprovement,
  suggestedAbilityBonuses,
  unansweredImprovementLevels,
  type AbilityBonusMap,
  type LevelChoice,
  featPrerequisiteProblems,
  type FeatCandidate,
  type FeatPrerequisiteProblem,
} from "@bertinis-vault/domain";
import type { RulesVersion } from "@bertinis-vault/vetools-ref";

import { ABILITY_IDS, type AbilityId } from "./abilities";
import { takenFeatsFor, type BuilderState } from "./builder";
import {
  classInfoFor,
  subclassInfoFor,
  featPrerequisitesFor,
  originAbilityChoiceFor,
  levellingFor,
  optionById,
  speciesBonusFromIndex,
  subraceBonusFromIndex,
} from "./index-options";
import { parseLineList, uniqueEntries } from "./builder";

export { maxPointsPerAbility, pointsPerImprovement };

/**
 * What the species starts a character with, as a suggestion.
 *
 * The index is asked first — it knows all 160 species where the hand-written
 * table knows a handful. Both can come back with nothing, and often do:
 *
 *   2014  most species have a fixed bonus, so the seed is the real answer
 *   2024  every species records `null`, because the edition moved the
 *         increase to the background and the player assigns it
 *
 * So this is a starting point, not a verdict, and the editor lets it be
 * changed. Returning an empty map is a normal outcome, not a failure.
 */
export function seedSpeciesBonus(
  state: BuilderState,
  rulesVersion: RulesVersion,
): AbilityBonusMap {
  if (!state.raceId) return {};

  const fromIndex = speciesBonusFromIndex(
    state.raceId,
    rulesVersion,
    state.sourceBooks[`race:${state.raceId}`],
  );

  const base =
    fromIndex && Object.keys(fromIndex).length > 0
      ? (fromIndex as AbilityBonusMap)
      : suggestedAbilityBonuses(state.raceId, state.subraceId || undefined);

  /*
   * The subrace's own increase, added on top.
   *
   * The index keeps the two apart and expects them summed: `Dwarf (Hill)`
   * holds `{wis: 1}` and `Dwarf` holds `{con: 2}`. Reading only the race — as
   * this did — gave every 2014 subrace character less than the rules grant: a
   * mountain dwarf short two Strength, a high elf short one Intelligence.
   */
  if (!state.subraceId) return base;

  const fromSubrace = subraceBonusFromIndex(
    state.subraceId,
    rulesVersion,
    state.sourceBooks[`subrace:${state.subraceId}`],
  );

  if (!fromSubrace) return base;

  const combined: AbilityBonusMap = { ...base };
  for (const [ability, amount] of Object.entries(fromSubrace)) {
    if (typeof amount !== "number") continue;
    const key = ability as keyof AbilityBonusMap;
    combined[key] = (combined[key] ?? 0) + amount;
  }

  return combined;
}

/**
 * Whether the bonus is the species' own, or something the player assigns.
 *
 * Drives the label: telling a 2024 player their species grants nothing is
 * confusing, while telling them the increase comes from their background is
 * the rule.
 */
export function bonusOrigin(rulesVersion: RulesVersion): "especie" | "trasfondo" {
  return rulesVersion === "2024" ? "trasfondo" : "especie";
}

/** How many points 2024 hands out through the background. */
export const speciesBonusBudget = 3;

/**
 * The target the editor counts against.
 *
 * The two editions mean different things by this number. In 2024 it is a real
 * budget: the background grants three points and the player assigns them, so
 * anything other than three is unfinished. In 2014 the species grants a fixed
 * increase — +2/+1 for most, +2/+2 for a mountain dwarf, +1 across the board
 * for a human — and there is nothing to spend. Counting those against a flat
 * three showed a correct mountain dwarf as "4 / 3" in alarm colour.
 *
 * So for 2014 the target is whatever the species itself grants, and the
 * warning colour then means what it says: this no longer matches the book.
 */
export function speciesBonusBudgetFor(
  state: BuilderState,
  rulesVersion: RulesVersion,
): number {
  if (rulesVersion === "2024") return speciesBonusBudget;

  const granted = pointsSpent(seedSpeciesBonus(state, rulesVersion));
  return granted > 0 ? granted : speciesBonusBudget;
}

/** Where one ability's points came from. */
export type AbilitySource = {
  /** The rolled, bought or arrayed score, before anything is added. */
  base: number;
  /** The species increase in 2014, the background's in 2024. */
  species: number;
  /** Points spent at level 4, 8, 12 and the rest. */
  improvements: number;
  /** The +1 that Resilient, Fey Touched and Telekinetic carry. */
  feats: number;
  /** After the cap. Not always `base + species + improvements + feats`. */
  final: number;
  /**
   * Whether the 20 cap swallowed some of the above.
   *
   * Worth saying out loud: a player who puts an improvement into a 20 gets
   * nothing for it, and the sheet showing an unchanged 20 looks like a bug
   * rather than the rule it is.
   */
  capped: boolean;
};

/**
 * Every ability, broken into the four things that made it.
 *
 * The Living Record already showed how far a score had been raised; it never
 * showed by what. A player looking at a 17 Constitution cannot tell whether it
 * is a 15 with a species +2, a 13 with an improvement, or a 16 with a
 * half-feat — and those are different decisions to make next.
 *
 * Built from the same three functions `buildCanonicalSnapshot` uses, in the
 * same order, so the sum here and the `final` the export sends cannot drift
 * apart. If they ever do, the sum is the one that is wrong.
 */
export function abilitySources(state: BuilderState): Record<AbilityId, AbilitySource> {
  const fromLevels = bonusesFromChoices(state.levelChoices);
  const fromFeats = bonusesFromFeats(takenFeatsFor(state));

  const out = {} as Record<AbilityId, AbilitySource>;
  for (const ability of ABILITY_IDS) {
    // The same six numbers `buildCanonicalSnapshot` calls `baseScores`. Read
    // off the state rather than taken as an argument, so a caller cannot hand
    // this a spread the export never saw.
    const base = state[ability];
    const species = state.abilityBonuses[ability] ?? 0;
    const improvements = fromLevels[ability] ?? 0;
    const feats = fromFeats[ability] ?? 0;

    // The same clamp `applyAbilityBonuses` applies. Summing without it would
    // show a 22 Strength on the sheet and export a 20 — the two numbers
    // disagreeing is worse than either being wrong.
    const raw = base + species + improvements + feats;
    const final = Math.min(abilityScoreCap, Math.max(1, raw));

    out[ability] = { base, species, improvements, feats, final, capped: raw > final };
  }

  return out;
}

/**
 * The shape a species increase currently has, as a player would say it.
 *
 * "+2 / +1", "+1 / +1 / +1". Tasha's Cauldron made the distribution the
 * player's to choose while keeping the total fixed, so the shape is the thing
 * being chosen and worth stating back.
 */
export function bonusShape(bonuses: AbilityBonusMap): string {
  const amounts = ABILITY_IDS.map((ability) => bonuses[ability] ?? 0)
    .filter((amount) => amount > 0)
    .sort((a, b) => b - a);

  return amounts.length === 0 ? "sin repartir" : amounts.map((n) => `+${n}`).join(" / ");
}

export type ImprovementPlan = {
  /** Every level that grants an increase and has been reached. */
  levels: number[];
  /** Those still unanswered — no choice, or a partial one. */
  unanswered: number[];
};

export function improvementPlan(
  state: BuilderState,
  rulesVersion: RulesVersion,
): ImprovementPlan {
  const levelling = levellingFor(state.classId, rulesVersion);

  return {
    levels: improvementLevels(levelling, state.level),
    unanswered: unansweredImprovementLevels(levelling, state.level, state.levelChoices),
  };
}

/** The points a bonus map spends in total. */
export function pointsSpent(bonuses: AbilityBonusMap): number {
  return Object.values(bonuses).reduce((sum, amount) => sum + (amount ?? 0), 0);
}

/**
 * The scores a level's improvement is applied on top of.
 *
 * Needed for the cap: two points into a 19 is illegal, and a stepper that
 * lets it happen produces a 21 the schema will refuse.
 *
 * `exceptLevel` is what makes this "before" rather than "after", and leaving it
 * out is a bug the players found. The editor for level 4 asks this what the
 * scores are, then adds the points it is holding on top — so if the answer
 * already contains those same points, they are counted twice. A character with
 * an 18 placed one point, was told they now had 19, and had the second point
 * refused for reaching 20. 18 + 2 = 20 is legal, and the sheet also showed a
 * number the character did not have.
 *
 * Feats count. A feat taken at level 4 that raises Strength raises the floor
 * the level 8 improvement starts from, and omitting it let a stepper push a
 * score past 20 — the same cap failing the other way.
 */
export function scoresBefore(
  state: BuilderState,
  exceptLevel?: number,
): Record<AbilityId, number> {
  const raw: Record<AbilityId, number> = {
    str: state.str,
    dex: state.dex,
    con: state.con,
    int: state.int,
    wis: state.wis,
    cha: state.cha,
  };

  const choices =
    exceptLevel === undefined
      ? state.levelChoices
      : Object.fromEntries(
          Object.entries(state.levelChoices).filter(([level]) => Number(level) !== exceptLevel),
        );

  const fromLevels = bonusesFromChoices(choices);
  const fromFeats = bonusesFromFeats(takenFeatsFor(state));

  for (const ability of Object.keys(raw) as AbilityId[]) {
    raw[ability] +=
      (state.abilityBonuses[ability] ?? 0) +
      (fromLevels[ability] ?? 0) +
      (fromFeats[ability] ?? 0);
  }

  return raw;
}

/** The choice recorded at a level, defaulted to an empty improvement. */
export function choiceAt(state: BuilderState, level: number): LevelChoice {
  return state.levelChoices[level] ?? { kind: "improvement", bonuses: {} };
}


/* ---------------- what a feat asks of the character ---------------- */

/**
 * The character as a feat prerequisite sees them.
 *
 * Built once and handed to every check, because the questions overlap: half a
 * dozen feats ask after the same score and the same class list.
 *
 * The scores are the final ones — a feat taken at level 8 is checked against
 * the character who reaches level 8, raises included. They come from
 * `abilitySources` rather than from `buildCanonicalSnapshot`, which throws on a
 * draft that is not derivable yet. A player half way through the Forge should
 * still be told that Grappler wants a 13 in Strength.
 *
 * Every class the character has, because a prerequisite can name one. A feat
 * that asks for a Spellcasting feature is met by a fighter 5 / wizard 1, and
 * reading only the first class would refuse it to them.
 *
 * The level is the character's, not the first class's: "4th level" in a
 * prerequisite has always meant the character's level.
 */
export function featCandidateFor(state: BuilderState): FeatCandidate {
  const rulesVersion: RulesVersion = state.rulesVersion === "5e-2024" ? "2024" : "2014";
  const sources = abilitySources(state);
  const abilities = {} as Record<AbilityId, number>;
  for (const ability of ABILITY_IDS) abilities[ability] = sources[ability].final;

  const taken = [
    { classId: state.classId, subclassId: state.subclassId, level: state.level },
    ...state.extraClasses.filter((extra) => extra.classId && extra.level >= 1),
  ].filter((entry) => entry.classId);

  const classRows = taken.flatMap((entry) => {
    const row = classInfoFor(entry.classId, rulesVersion);
    return row ? [{ name: row.name, level: entry.level }] : [];
  });

  // Any class that casts, subclasses included: a fighter with the Eldritch
  // Knight subclass has a Spellcasting feature and the fighter alone does not.
  const casts = taken.some((entry) => {
    const row = classInfoFor(entry.classId, rulesVersion);
    if (row?.casterProgression) return true;
    return Boolean(
      entry.subclassId && subclassInfoFor(entry.subclassId, entry.classId, rulesVersion)?.casterProgression,
    );
  });
  // Armour and weapon proficiencies are free text in the builder, so the match
  // is on what the player typed. "medium" is what the books ask for.
  const proficiencies = uniqueEntries(parseLineList(state.proficienciesText)).map((entry) =>
    entry.toLowerCase(),
  );

  return {
    abilities,
    level: characterLevel(state.level, state.extraClasses),
    classes: classRows,
    raceName: optionById("race", rulesVersion, state.raceId)?.label ?? state.raceId,
    ...(state.subraceId
      ? {
          subraceName:
            optionById("subrace", rulesVersion, state.subraceId)?.label ?? state.subraceId,
        }
      : {}),
    backgroundName:
      optionById("background", rulesVersion, state.backgroundId)?.label ?? state.backgroundId,
    featNames: takenFeatsFor(state).map(
      (entry) => optionById("feat", rulesVersion, entry.featId)?.label ?? entry.featId,
    ),
    featureNames: parseLineList(state.featuresText),
    armorProficiencies: proficiencies,
    weaponProficiencies: proficiencies,
    casts,
  };
}

/**
 * What stands between this character and a feat.
 *
 * Reported, never enforced. A table may allow anything, and a builder that
 * refuses is a builder people work around — the same stance the talent
 * prerequisites already take.
 */
export function featPrerequisiteProblemsFor(
  state: BuilderState,
  featId: string,
): FeatPrerequisiteProblem[] {
  if (!featId) return [];

  return featPrerequisiteProblems(
    featPrerequisitesFor(
      featId,
      state.rulesVersion === "5e-2024" ? "2024" : "2014",
      state.sourceBooks[`feat:${featId}`],
    ),
    featCandidateFor(state),
  );
}

/** Every feat this character has taken that it does not qualify for. */
export function unmetFeatPrerequisitesFor(
  state: BuilderState,
): { featId: string; problems: FeatPrerequisiteProblem[] }[] {
  return takenFeatsFor(state)
    .map((entry) => ({
      featId: entry.featId,
      problems: featPrerequisiteProblemsFor(state, entry.featId),
    }))
    .filter((entry) => entry.problems.length > 0);
}

/**
 * Which abilities the origin increase may go into, or null when anything may.
 *
 * 2014 has no such restriction — the species grants what it grants. In 2024
 * every background names three, and the editor offering all six let a player
 * put an Acolyte's +2 into Strength, which is not a choice the book gives.
 *
 * The alternatives all draw from the same three, so the union across them is
 * the answer; the difference between them is how the points are split, which
 * the budget already governs.
 */
export function originAbilityAllowanceFor(
  state: BuilderState,
  rulesVersion: RulesVersion,
): AbilityId[] | null {
  if (rulesVersion !== "2024" || !state.backgroundId) return null;

  const alternatives = originAbilityChoiceFor(
    state.backgroundId,
    rulesVersion,
    state.sourceBooks[`background:${state.backgroundId}`] ?? state.sourceBooks.background,
  );
  if (!alternatives?.length) return null;

  const allowed = new Set(alternatives.flatMap((alternative) => alternative.options));
  const ids = ABILITY_IDS.filter((ability) => allowed.has(ability));

  // A background whose three the index spells in some other vocabulary would
  // otherwise lock the editor to nothing at all. Better to allow everything
  // than to allow nothing.
  return ids.length ? ids : null;
}
