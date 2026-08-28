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
import type {
  LanguageGrant,
  RaceRow,
  SpeciesProficiencies,
  SubraceRow,
} from "@bertinis-vault/vetools-index";
import type { RulesVersion } from "@bertinis-vault/vetools-ref";

import { slugOf } from "./index-options";

/** The race row and the subrace row, either of which may be missing. */
function rowsFor(
  raceId: string,
  subraceId: string,
  rulesVersion: RulesVersion,
  books?: SourceBooks,
): { race: RaceRow | null; subrace: SubraceRow | null } {
  const races = forRulesVersion(collections.race ?? [], rulesVersion) as RaceRow[];
  const race = pickRow(races, raceId, books?.[`race:${raceId}`]);
  if (!subraceId) return { race, subrace: null };

  const subraces = forRulesVersion(collections.subrace ?? [], rulesVersion) as SubraceRow[];
  return { race, subrace: pickRow(subraces, subraceId, books?.[`subrace:${subraceId}`]) };
}

/** Which book each pick came from, keyed by `"<prop>:<id>"`, as a build stores it. */
export type SourceBooks = Record<string, string>;

/**
 * The row the player actually picked, and not merely one of that name.
 *
 * Twenty-five species names appear in more than one book legal for the same
 * edition, and taking the first match is taking whichever the index happened
 * to sort first. Measured: four books print an Elf legal in 2024, and the
 * first of them is Lorwyn's — which grants nothing. So the 2024 elf's choice
 * of Insight, Perception or Survival reached no character, and neither did
 * their traits or their speed.
 *
 * Falling back to the first match when the draft names no book is what every
 * build written before `sourceBooks` existed needs, and it is no worse than
 * what those builds already had.
 */
function pickRow<Row extends { name: string; source: string }>(
  rows: Row[],
  id: string,
  book: string | undefined,
): Row | null {
  const named = rows.filter((row) => slugOf(row.name) === id);
  if (!named.length) return null;
  return named.find((row) => row.source === book) ?? named[0] ?? null;
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
  books?: SourceBooks,
): string[] {
  const { race, subrace } = rowsFor(raceId, subraceId, rulesVersion, books);
  const traits: string[] = [];

  for (const name of [...(race?.traits ?? []), ...(subrace?.traits ?? [])]) {
    if (!traits.includes(name)) traits.push(name);
  }

  return traits;
}

/**
 * What the species grants, race and subrace together.
 *
 * Added rather than replaced, the same rule as traits: a hill dwarf keeps the
 * dwarf's warhammer and the dwarf's choice of artisan's tools.
 *
 * The choices are kept as a list and never merged into one. Two choices are
 * two budgets — a species offering one skill and its subspecies offering
 * another is two picks, and folding them into "choose 2" would let the player
 * take both from the same list and neither from the other.
 */
export function speciesProficienciesFor(
  raceId: string,
  subraceId: string,
  rulesVersion: RulesVersion,
  books?: SourceBooks,
): SpeciesProficiencies | null {
  const { race, subrace } = rowsFor(raceId, subraceId, rulesVersion, books);
  const grants = [race?.speciesProficiencies, subrace?.speciesProficiencies].filter(
    (grant): grant is SpeciesProficiencies => Boolean(grant),
  );
  if (!grants.length) return null;

  const merged: SpeciesProficiencies = {
    armor: [],
    weaponItems: [],
    weaponClauses: [],
    skills: { granted: [], choices: [] },
    tools: { granted: [], choices: [] },
  };

  const add = (into: string[], values: string[]) => {
    for (const value of values) if (!into.includes(value)) into.push(value);
  };

  for (const grant of grants) {
    add(merged.armor, grant.armor);
    add(merged.weaponItems, grant.weaponItems);
    add(merged.weaponClauses, grant.weaponClauses);
    // A row built before these fields existed carries neither.
    add(merged.skills.granted, grant.skills?.granted ?? []);
    add(merged.tools.granted, grant.tools?.granted ?? []);
    merged.skills.choices.push(...(grant.skills?.choices ?? []));
    merged.tools.choices.push(...(grant.tools?.choices ?? []));
  }

  return merged;
}

/**
 * The languages the species grants, race and subrace together.
 *
 * Added, not replaced — the same rule as traits. A deep gnome speaks
 * Undercommon on top of the Common and Gnomish every gnome speaks, and 5etools
 * merges the two lists exactly this way when it builds the subspecies.
 *
 * Null when neither grants any, which is every 2024 species: that edition moved
 * languages off the species and onto the background.
 */
export function speciesLanguagesFor(
  raceId: string,
  subraceId: string,
  rulesVersion: RulesVersion,
  books?: SourceBooks,
): LanguageGrant | null {
  const { race, subrace } = rowsFor(raceId, subraceId, rulesVersion, books);
  const grants = [race?.languages, subrace?.languages].filter(
    (grant): grant is LanguageGrant => Boolean(grant),
  );
  if (!grants.length) return null;

  return {
    fixed: Array.from(new Set(grants.flatMap((grant) => grant.fixed))),
    anyStandard: grants.reduce((total, grant) => total + grant.anyStandard, 0),
    other: grants.reduce((total, grant) => total + grant.other, 0),
    choose: grants.flatMap((grant) => grant.choose),
  };
}
