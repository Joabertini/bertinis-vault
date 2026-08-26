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
 * The hit points a multiclass character has, at the builder's fixed average.
 *
 * The first class level is its die at maximum; every level after that is the
 * die's average rounded up, which is the number the rules offer instead of
 * rolling. Which die depends on the class the level was taken in, so a
 * barbarian 1 / wizard 4 is 12 + three d6 levels + one d6 level, not five d12s.
 *
 * The first class in the list is the one taken at level 1. That is a fact
 * about the character rather than something to derive, and it is also what
 * decides saving throw proficiencies and starting equipment.
 */
export function multiclassHitPoints({
  entries,
  constitutionModifier,
  defaultHitDie = 8,
}: {
  entries: MulticlassEntry[];
  constitutionModifier: number;
  defaultHitDie?: number;
}): number {
  let total = 0;
  let isFirstLevel = true;

  for (const entry of entries) {
    const die = entry.hitDie ?? defaultHitDie;

    for (let taken = 0; taken < entry.level; taken += 1) {
      total += (isFirstLevel ? die : Math.floor(die / 2) + 1) + constitutionModifier;
      isFirstLevel = false;
    }
  }

  // A character with a bad Constitution still has hit points; the rules floor
  // a level's contribution at 1 rather than letting a total go negative.
  return Math.max(total, entries.reduce((sum, entry) => sum + entry.level, 0));
}
