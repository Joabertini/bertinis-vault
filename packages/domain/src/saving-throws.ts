/**
 * Saving throw proficiencies, which every class grants two of at level one.
 *
 * The payload has carried a `savingThrows` list since it was written, and
 * nothing ever filled it: the builder classified a proficiency as a skill, a
 * tool, a weapon, an armour or "other", and had no way to say "saving throw".
 * So every character exported so far reached Foundry proficient in none.
 */

import type { AbilityId } from "@bertinis-vault/contracts";

export const classSavingThrows: Record<string, [AbilityId, AbilityId]> = {
  artificer: ["con", "int"],
  barbarian: ["str", "con"],
  bard: ["dex", "cha"],
  cleric: ["wis", "cha"],
  druid: ["int", "wis"],
  fighter: ["str", "con"],
  monk: ["str", "dex"],
  paladin: ["wis", "cha"],
  ranger: ["str", "dex"],
  rogue: ["dex", "int"],
  sorcerer: ["con", "cha"],
  warlock: ["wis", "cha"],
  wizard: ["int", "wis"],
};

/**
 * The saves a class is proficient in.
 *
 * On a multiclass character only the first class grants saves, which is why
 * this takes one class rather than a list.
 */
export function savingThrowsForClass(classId: string): AbilityId[] {
  return classSavingThrows[classId.toLowerCase()] ?? [];
}
