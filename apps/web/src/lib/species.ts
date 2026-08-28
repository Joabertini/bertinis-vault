/**
 * What the species itself gives the character.
 *
 * The Forge showed the species' name and its ability bonus and stopped there.
 * Everything else it grants — Stonecunning, Lucky, Breath Weapon, the dwarf's
 * four weapons — existed only inside the reference the export sends to Foundry,
 * so the player choosing between a dwarf and a halfling was choosing between
 * two words.
 *
 * A subrace **adds** to its race here rather than replacing it, which is the
 * opposite of how its size and speed work. A wood elf has Keen Senses, Fey
 * Ancestry and Trance from being an elf *and* Fleet of Foot from being a wood
 * one; it walks at 35 instead of 30, not as well as. Both rules are in the
 * books and mixing them up either doubles a speed or halves a species.
 */

import { collections, forRulesVersion } from "@bertinis-vault/vetools-index";
import type { RaceRow, SpeciesProficiencies, SubraceRow } from "@bertinis-vault/vetools-index";
import type { RulesVersion } from "@bertinis-vault/vetools-ref";

import { slugOf } from "./index-options";

/** The race row and the subrace row, either of which may be missing. */
function rowsFor(
  raceId: string,
  subraceId: string,
  rulesVersion: RulesVersion,
): { race: RaceRow | null; subrace: SubraceRow | null } {
  const races = forRulesVersion(collections.race ?? [], rulesVersion) as RaceRow[];
  const race = races.find((row) => slugOf(row.name) === raceId) ?? null;
  if (!subraceId) return { race, subrace: null };

  const subraces = forRulesVersion(collections.subrace ?? [], rulesVersion) as SubraceRow[];
  return { race, subrace: subraces.find((row) => slugOf(row.name) === subraceId) ?? null };
}

/**
 * Every trait the character has from their species, race first.
 *
 * Deduplicated by name: a few subraces restate a trait their race already
 * printed, and a player reading "Fey Ancestry" twice would reasonably wonder
 * whether they had it twice.
 */
export function speciesTraitsFor(
  raceId: string,
  subraceId: string,
  rulesVersion: RulesVersion,
): string[] {
  const { race, subrace } = rowsFor(raceId, subraceId, rulesVersion);
  const traits: string[] = [];

  for (const name of [...(race?.traits ?? []), ...(subrace?.traits ?? [])]) {
    if (!traits.includes(name)) traits.push(name);
  }

  return traits;
}

/** The armour and weapons the species grants, race and subrace together. */
export function speciesProficienciesFor(
  raceId: string,
  subraceId: string,
  rulesVersion: RulesVersion,
): SpeciesProficiencies | null {
  const { race, subrace } = rowsFor(raceId, subraceId, rulesVersion);
  const grants = [race?.speciesProficiencies, subrace?.speciesProficiencies].filter(
    (grant): grant is SpeciesProficiencies => Boolean(grant),
  );
  if (!grants.length) return null;

  const merged: SpeciesProficiencies = { armor: [], weaponItems: [], weaponClauses: [] };
  for (const grant of grants) {
    for (const value of grant.armor) if (!merged.armor.includes(value)) merged.armor.push(value);
    for (const value of grant.weaponItems) {
      if (!merged.weaponItems.includes(value)) merged.weaponItems.push(value);
    }
    for (const value of grant.weaponClauses) {
      if (!merged.weaponClauses.includes(value)) merged.weaponClauses.push(value);
    }
  }

  return merged;
}
