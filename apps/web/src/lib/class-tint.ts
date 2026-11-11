/**
 * The light a class casts on the Forge.
 *
 * The index carries no colour — it describes rules, not mood — so the tint
 * lives here, keyed by the same slug a build stores.
 *
 * Values are chosen to read at 7:1 or better against the Void (#000000): the palette the
 * first draft used was pitched for a lighter ground, and several tints
 * (a #5C4033 rogue, a #2E5FA3 wizard) went nearly black against this one.
 *
 * A class from a book with no tint of its own falls back to gold, which is the
 * Vault's own colour and reads as "unmarked" rather than as a wrong guess.
 */

export const VAULT_GOLD = "#F2C14E";

const TINTS: Record<string, string> = {
  barbarian: "#FF6A55",
  bard: "#D4A73C",
  cleric: "#DCC990",
  druid: "#6FD38A",
  fighter: "#B8C2CF",
  monk: "#6CC4FF",
  paladin: "#FFFFFF",
  ranger: "#9BE08F",
  rogue: "#D9A86C",
  sorcerer: "#FF8A4C",
  warlock: "#C08CFF",
  wizard: "#6FB2FF",
  artificer: "#7FD6C4",
};

export function tintFor(classId: string): string {
  return TINTS[classId] ?? VAULT_GOLD;
}
