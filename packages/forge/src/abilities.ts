/**
 * The six, in the order every sheet in the game prints them.
 *
 * Re-exported from one place so the Forge, the Living Record and the printed
 * sheet cannot disagree about order or spelling.
 */

import { abilityLabels as builderAbilityLabels } from "./builder";

export const ABILITY_IDS = ["str", "dex", "con", "int", "wis", "cha"] as const;

export type AbilityId = (typeof ABILITY_IDS)[number];

/** Spanish names, taken from the repo's builder rather than restated here. */
export const abilityLabels: Record<AbilityId, string> = {
  str: builderAbilityLabels.str ?? "Fuerza",
  dex: builderAbilityLabels.dex ?? "Destreza",
  con: builderAbilityLabels.con ?? "Constitucion",
  int: builderAbilityLabels.int ?? "Inteligencia",
  wis: builderAbilityLabels.wis ?? "Sabiduria",
  cha: builderAbilityLabels.cha ?? "Carisma",
};
