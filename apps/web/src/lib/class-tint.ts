/**
 * The light a class casts on the Forge.
 *
 * The index carries no colour — it describes rules, not mood — so the tint
 * lives here, keyed by the same slug a build stores.
 *
 * Values are chosen to hold up against the Void (#030202): the palette the
 * first draft used was pitched for a lighter ground, and several tints
 * (a #5C4033 rogue, a #2E5FA3 wizard) went nearly black against this one.
 *
 * A class from a book with no tint of its own falls back to gold, which is the
 * Vault's own colour and reads as "unmarked" rather than as a wrong guess.
 */

export const VAULT_GOLD = "#B08A3E";

const TINTS: Record<string, string> = {
  barbarian: "#B03A2E",
  bard: "#D4A73C",
  cleric: "#DCC990",
  druid: "#4E9C63",
  fighter: "#98A0AC",
  monk: "#5FA3DC",
  paladin: "#E6DFCE",
  ranger: "#6B8F5E",
  rogue: "#8A6A47",
  sorcerer: "#E25822",
  warlock: "#9B5DE0",
  wizard: "#4A7FC1",
  artificer: "#7FA39B",
};

export function tintFor(classId: string): string {
  return TINTS[classId] ?? VAULT_GOLD;
}
