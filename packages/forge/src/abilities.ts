/**
 * The six, in the order every sheet in the game prints them.
 *
 * Re-exported from one place so the Forge, the Living Record and the printed
 * sheet cannot disagree about order or spelling.
 */

export const ABILITY_IDS = ["str", "dex", "con", "int", "wis", "cha"] as const;

export type AbilityId = (typeof ABILITY_IDS)[number];

/**
 * Spanish names. The one source: `builder-state` re-exports these, so this
 * file imports nothing — the Gate reaches it and must not reach the index.
 */
export const abilityLabels: Record<AbilityId, string> = {
  str: "Fuerza",
  dex: "Destreza",
  con: "Constitucion",
  int: "Inteligencia",
  wis: "Sabiduria",
  cha: "Carisma",
};
