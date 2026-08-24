/**
 * Where a character's ability scores come from after they are rolled.
 *
 * A build carries `base` (what generation produced) and `final` (what the
 * sheet uses). Everything downstream — hit points, armour class, the spell
 * save DC, the attack bonus — reads `final`, so anything that raises a score
 * has to land here or the exported character is wrong.
 *
 * Two things raise scores at build time: the species (2014) or background
 * (2024) bonus, and the choices made on the way up. The second lives in
 * `levelling.ts`, because which levels ask for one is a fact about the class
 * rather than about ability scores.
 */

import type { AbilityId, AbilityScoreMap } from "@bertinis-vault/contracts";

export type AbilityBonusMap = Partial<Record<AbilityId, number>>;

/** The ceiling an improvement can raise a score to. Magic items go past it. */
export const abilityScoreCap = 20;

/**
 * The 2014 species bonuses, for the species whose bonus is fixed.
 *
 * Deliberately partial. Monsters of the Multiverse reprinted most species with
 * a floating bonus the player assigns, and 2024 moved the bonus to the
 * background entirely. So this is a starting point the player can edit, not an
 * answer — which is also the only honest way to treat the 136 species in the
 * index that no table here describes.
 */
export const speciesAbilityBonuses: Record<string, AbilityBonusMap> = {
  dragonborn: { str: 2, cha: 1 },
  dwarf: { con: 2 },
  elf: { dex: 2 },
  gnome: { int: 2 },
  "half-elf": { cha: 2 },
  "half-orc": { str: 2, con: 1 },
  halfling: { dex: 2 },
  human: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
  tiefling: { cha: 2, int: 1 },
};

/** Subspecies bonuses stack on top of the species bonus. */
export const subspeciesAbilityBonuses: Record<string, AbilityBonusMap> = {
  "hill-dwarf": { wis: 1 },
  "mountain-dwarf": { str: 2 },
  "high-elf": { int: 1 },
  "wood-elf": { wis: 1 },
  drow: { cha: 1 },
  "forest-gnome": { dex: 1 },
  "rock-gnome": { con: 1 },
  "lightfoot-halfling": { cha: 1 },
  "stout-halfling": { con: 1 },
};

/** The bonus a species and subspecies grant, as a starting suggestion. */
export function suggestedAbilityBonuses(raceId: string, subraceId?: string): AbilityBonusMap {
  const species = speciesAbilityBonuses[raceId] ?? {};
  const subspecies = subraceId ? subspeciesAbilityBonuses[subraceId] ?? {} : {};

  return mergeBonuses(species, subspecies);
}

/** Add two bonus maps together. */
export function mergeBonuses(...maps: AbilityBonusMap[]): AbilityBonusMap {
  const result: AbilityBonusMap = {};

  for (const map of maps) {
    for (const [ability, amount] of Object.entries(map) as Array<[AbilityId, number]>) {
      result[ability] = (result[ability] ?? 0) + amount;
    }
  }

  return result;
}

/**
 * The scores the sheet uses.
 *
 * Improvements stop at 20, the ceiling the rules put on them. A species bonus
 * is not an improvement and is applied first, so a score can only reach the
 * cap through spending rather than be pushed past it.
 */
export function applyAbilityBonuses(
  base: AbilityScoreMap,
  ...bonuses: AbilityBonusMap[]
): AbilityScoreMap {
  const total = mergeBonuses(...bonuses);
  const result = { ...base };

  for (const [ability, amount] of Object.entries(total) as Array<[AbilityId, number]>) {
    result[ability] = Math.min(abilityScoreCap, Math.max(1, result[ability] + amount));
  }

  return result;
}
