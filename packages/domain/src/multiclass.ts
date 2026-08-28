/**
 * What a character made of more than one class actually has.
 *
 * `classing.classes` has been an array since the first commit and everything
 * downstream read `classes[0]`. So a wizard 3 / cleric 2 was given a wizard 3's
 * spell slots and a wizard's hit points for all five levels — not a number
 * missing from the sheet, a wrong one printed on it.
 *
 * The rule that makes this its own file is that a multiclass spellcaster's
 * slots are not the sum of what each class would have alone. They come from
 * one combined caster level read against the full-caster table, and the
 * contribution each class makes to that level is *not* the same arithmetic as
 * the class's own table:
 *
 *   A ranger 5 alone reads the table at 3 — four first-level slots and two
 *   second. A ranger 5 multiclassing contributes 2. Rounded up for its own
 *   table, rounded down for the shared one.
 *
 * That difference is the single easiest thing to get wrong here, and getting
 * it wrong hands out slots the character does not have.
 */

import type { AbilityId } from "@bertinis-vault/contracts";

import { hitDiceByLevel, hitPointsFor, type HitPointMethod } from "./combat.js";
import { spellSlotsFullCasterTable, warlockPactSlotCountByLevel, warlockPactSlotLevelByClassLevel } from "./dnd5e-2014.js";

/**
 * How a class advances spellcasting, in 5etools' own vocabulary.
 *
 * Taken from the index rather than named here, so the editions stay apart
 * without a rule: the 2014 paladin is `"1/2"` and the 2024 paladin is
 * `"artificer"`, because 2024 moved it to casting from level 1.
 */
export type CasterProgression = "full" | "1/2" | "1/3" | "artificer" | "pact";

/** One class a character has levels in. */
export type MulticlassEntry = {
  classId: string;
  level: number;
  /** The class's own progression, from the index. */
  casterProgression?: CasterProgression | null | undefined;
  /** A third-caster subclass's progression, which the class itself has none of. */
  subclassCasterProgression?: CasterProgression | null | undefined;
  hitDie?: number | undefined;
  spellcastingAbility?: AbilityId | undefined;
};

/** The progression that governs an entry: the subclass's if it has one. */
export function progressionOf(entry: MulticlassEntry): CasterProgression | null {
  return entry.subclassCasterProgression ?? entry.casterProgression ?? null;
}

/**
 * What one class contributes to the shared caster level.
 *
 * Full casters contribute every level. Half-casters contribute half, and the
 * two roundings are both real: the 2014 paladin and ranger round down, and the
 * artificer rounds up because Tasha's says so in as many words. Third-casters
 * round down. A warlock contributes nothing — pact magic is a separate
 * resource that recharges on a short rest, and mixing it into the table would
 * hand the character slots twice.
 */
export function casterLevelContribution(entry: MulticlassEntry): number {
  switch (progressionOf(entry)) {
    case "full":
      return entry.level;
    case "artificer":
      return Math.ceil(entry.level / 2);
    case "1/2":
      return Math.floor(entry.level / 2);
    case "1/3":
      return Math.floor(entry.level / 3);
    default:
      return 0;
  }
}

/** Every class's contribution added up. */
export function multiclassCasterLevel(entries: MulticlassEntry[]): number {
  return entries.reduce((total, entry) => total + casterLevelContribution(entry), 0);
}

/** The pact slots a character's warlock levels give, if any. */
export function pactSlotsOf(entries: MulticlassEntry[]): { count: number; level: number } | null {
  const warlockLevels = entries
    .filter((entry) => progressionOf(entry) === "pact")
    .reduce((total, entry) => total + entry.level, 0);
  if (warlockLevels < 1) return null;

  const count = warlockPactSlotCountByLevel[warlockLevels] ?? 0;
  const level = warlockPactSlotLevelByClassLevel[warlockLevels] ?? 0;
  if (count === 0 || level === 0) return null;

  return { count, level };
}

/** Slots by the level they are, plus the level a warlock casts pact slots at. */
export type MulticlassSlots = {
  slots: Record<string, number>;
  pactLevel?: number;
};

/**
 * The spell slots a whole character has, every class counted.
 *
 * A single class is not a special case: one full caster's contribution is its
 * own level, so the combined table gives it the same row its own table would.
 * The one place they diverge is a lone half-caster at level 1 under the 2014
 * rules, which the caller handles by passing that class's own table — see
 * `spellSlotsForPayload`. Here a caster level of zero means no slots, which is
 * the same answer.
 */
export function multiclassSpellSlots(entries: MulticlassEntry[]): MulticlassSlots {
  const casterLevel = multiclassCasterLevel(entries);
  const slots: Record<string, number> = {};

  if (casterLevel >= 1) {
    const table = spellSlotsFullCasterTable[Math.min(casterLevel, 20)] ?? [];
    table.forEach((count, index) => {
      if (count > 0) slots[String(index + 1)] = count;
    });
  }

  const pact = pactSlotsOf(entries);
  if (!pact) return { slots };

  // Pact slots live under their own key rather than being added to the level
  // they cast at: they recharge on a short rest and the sheet tracks them
  // separately. Adding them in would make a warlock 2 / sorcerer 3 look like
  // it had five second-level slots that all came back on a long rest.
  return { slots: { ...slots, pact: pact.count }, pactLevel: pact.level };
}

/**
 * The hit points a multiclass character has.
 *
 * Which die a level uses depends on the class it was taken in, so a barbarian
 * 1 / wizard 4 is a d12 at maximum plus four d6 levels, not five d12s. That
 * list of dice is the only thing this adds to the rule, which lives in
 * `hitPointsFor` — including the choice between rolling and taking the
 * average, and the fact that only the character's very first level is a
 * maximum.
 *
 * The first class in the list is the one taken at level 1. That is a fact
 * about the character rather than something to derive, and it is also what
 * decides saving throw proficiencies and starting equipment.
 */
export function multiclassHitPoints({
  entries,
  constitutionModifier,
  defaultHitDie = 8,
  method,
  rolls,
}: {
  entries: MulticlassEntry[];
  constitutionModifier: number;
  defaultHitDie?: number;
  method?: HitPointMethod;
  rolls?: Array<number | null | undefined>;
}): number {
  return hitPointsFor({
    dice: hitDiceByLevel(entries, defaultHitDie),
    constitutionModifier,
    ...(method ? { method } : {}),
    ...(rolls ? { rolls } : {}),
  });
}

/**
 * A score a class asks for, or a set of them.
 *
 * A list of these is a list of alternatives: `[{str: 13}, {dex: 13}]` is
 * "Strength or Dexterity", `[{dex: 13, wis: 13}]` is "Dexterity and Wisdom".
 */
export type AbilityRequirement = Record<string, number>;

/** Whether a set of scores satisfies any one of the alternatives on offer. */
export function meetsRequirement(
  options: AbilityRequirement[],
  scores: Record<string, number>,
): boolean {
  // A class that asks for nothing is met by anything. Two classes in the data
  // state no requirement at all, and refusing them would be inventing a rule.
  if (options.length === 0) return true;

  return options.some((option) =>
    Object.entries(option).every(([ability, minimum]) => (scores[ability] ?? 0) >= minimum),
  );
}

/** A class the character has levels in but does not qualify for. */
export type MulticlassRequirementProblem = {
  classId: string;
  /** What it asks for, so the report can say which score is short. */
  requirements: AbilityRequirement[];
};

/**
 * Every class whose ability-score requirement the character does not meet.
 *
 * The requirement binds only on a multiclass character, and then it binds on
 * *every* class including the first: the rule is that you must qualify for the
 * class you are leaving as well as the one you are entering. A single-class
 * character has no requirement to meet, which is why a Strength 8 wizard is
 * legal and a Strength 8 wizard 4 / fighter 1 is not.
 *
 * Reported rather than refused. The builder is a tool for a person who may be
 * playing with a table that ignores this, and a warning they can read beats a
 * build they cannot make.
 */
export function multiclassRequirementProblems({
  entries,
  scores,
}: {
  entries: (MulticlassEntry & { multiclassRequirements?: AbilityRequirement[] | undefined })[];
  scores: Record<string, number>;
}): MulticlassRequirementProblem[] {
  if (entries.length < 2) return [];

  return entries
    .filter((entry) => !meetsRequirement(entry.multiclassRequirements ?? [], scores))
    .map((entry) => ({
      classId: entry.classId,
      requirements: entry.multiclassRequirements ?? [],
    }));
}
