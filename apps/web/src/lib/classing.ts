/**
 * A character's classes, when there is more than one.
 *
 * The first class is not one of a list. The book gives it two things it never
 * gives a second one: the saving throws, and the starting equipment. A second
 * class hands over the shorter "multiclassing" block instead — some armour,
 * some weapons, and for four classes one skill. Modelling every class as an
 * equal entry would quietly hand a rogue 2 the fighter's proficiency in
 * Constitution saves, which is a number wrong on the sheet rather than a field
 * missing from it.
 *
 * So the draft keeps `classId` / `subclassId` / `level` as the first class,
 * exactly as it always had them, and the rest live here. Every chamber that
 * asks "what class is this character" keeps reading the first one and keeps
 * being right.
 *
 * The arithmetic itself is not here: `packages/domain/src/multiclass.ts` owns
 * it, and this file only builds the entries that module reads.
 */

import type { AbilityId, CasterProgression, ClassEntry } from "@bertinis-vault/contracts";

import { hitDieFor } from "./catalog";
import type { ExtraClass } from "./builder-state";
import { classInfoFor, subclassInfoFor } from "./index-options";
import type { RulesVersion } from "@bertinis-vault/vetools-ref";

/**
 * The character's level: every class's levels added up.
 *
 * This is the number the proficiency bonus and the improvement levels read, so
 * a fighter 5 / wizard 3 is level 8 for both — not a level 5 fighter who also
 * knows some spells.
 */
export function characterLevel(primaryLevel: number, extras: ExtraClass[]): number {
  const total = extras.reduce((sum, extra) => sum + extra.level, primaryLevel);
  return Math.min(20, total);
}

const CASTER_PROGRESSIONS = new Set<string>(["full", "1/2", "1/3", "artificer", "pact"]);
const ABILITIES = new Set<string>(["str", "dex", "con", "int", "wis", "cha"]);

/**
 * The ability a class casts with — the subclass's when the class has none.
 *
 * An Eldritch Knight casts off Intelligence, and the fighter it is built on
 * casts off nothing. Reading only the class leaves the character with a third
 * of a caster's spell slots and no save DC to use them with, which is how the
 * sheet ends up saying a spellcaster cannot cast.
 */
function castingAbilityOf(
  row: { spellcastingAbility?: string | null } | null,
  subclass: { spellcastingAbility?: string | null } | null,
): AbilityId | null {
  const value = subclass?.spellcastingAbility ?? row?.spellcastingAbility;
  return value && ABILITIES.has(value) ? (value as AbilityId) : null;
}

/** The index's progression string, kept only when it is one the rules know. */
function progressionOf(value: string | null | undefined): CasterProgression | null {
  return value && CASTER_PROGRESSIONS.has(value) ? (value as CasterProgression) : null;
}

/**
 * One class as the contract wants it, with the index's numbers attached.
 *
 * The rules layer has hand-written tables to fall back on, but carrying the
 * index's answer is what keeps the editions apart without a rule of its own —
 * the 2014 paladin is a half-caster and the 2024 paladin rounds its levels up
 * like an artificer, and neither file has to know that.
 */
export function classEntryFor(
  entry: { classId: string; subclassId: string; level: number },
  rulesVersion: RulesVersion,
): ClassEntry {
  const row = classInfoFor(entry.classId, rulesVersion);
  const subclass = entry.subclassId
    ? subclassInfoFor(entry.subclassId, entry.classId, rulesVersion)
    : null;
  const hitDie = row?.hitDie ?? hitDieFor(entry.classId, rulesVersion);
  const castingAbility = castingAbilityOf(row, subclass);

  return {
    classId: entry.classId,
    ...(entry.subclassId ? { subclassId: entry.subclassId } : {}),
    level: entry.level,
    casterProgression: progressionOf(row?.casterProgression),
    subclassCasterProgression: progressionOf(subclass?.casterProgression),
    ...(hitDie ? { hitDie } : {}),
    ...(castingAbility ? { spellcastingAbility: castingAbility } : {}),
    ...(row?.multiclassRequirements?.length
      ? { multiclassRequirements: row.multiclassRequirements }
      : {}),
  } as ClassEntry;
}

/** Every class the character has, first one first. */
export function classEntriesFor(
  primary: { classId: string; subclassId: string; level: number },
  extras: ExtraClass[],
  rulesVersion: RulesVersion,
): ClassEntry[] {
  return [primary, ...extras.filter((extra) => extra.classId)].map((entry) =>
    classEntryFor(entry, rulesVersion),
  );
}

/**
 * How the sheet names the character's classes.
 *
 * One class reads as it always did — just its name, because a level 5 fighter
 * does not need to be told they are a fighter 5. More than one has to spell
 * out the split: "Nivel 8 · Guerrero" is not a shorter way of saying what this
 * character is, it is a different character. The player needs to see which
 * five levels are the fighter's.
 */
export function classingLabel(
  primary: { classId: string; level: number },
  extras: ExtraClass[],
  labelOf: (classId: string) => string,
): string {
  const taken = extras.filter((extra) => extra.classId && extra.level >= 1);
  if (taken.length === 0) return labelOf(primary.classId);

  return [primary, ...taken]
    .map((entry) => `${labelOf(entry.classId)} ${entry.level}`)
    .join(" / ");
}

export type { ExtraClass };
export { coerceExtraClasses, emptyExtraClass } from "./builder-state";
