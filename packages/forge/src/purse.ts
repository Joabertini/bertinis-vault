/**
 * The starting coins, minus what the player bought with them.
 *
 * `kitCopper` only ever added. A 2024 fighter who took the 155 gold instead of
 * the gear, then went to the bag and put chain mail, a longsword and a shield
 * in it, left the Forge with all three *and* the 155 gold. A review caught it:
 * the money is the alternative to the gear, and a builder that hands over both
 * is not offering a choice.
 *
 * Nothing records a purchase, and nothing needs to. What the kit granted is
 * known — the granted rows and the answers given — so whatever the character
 * carries beyond that was bought:
 *
 *     bought = (bag + weapon + armour) − kit items − one item per open pick
 *
 * An open pick ("a martial weapon") is the kit too: the longsword a fighter
 * names for it was handed over, not bought. Each pick takes one carried item
 * that fits its category.
 *
 * Prices come off the index (`value`, in copper). About a third of its items
 * carry one; an item without a price does not count against the purse, and is
 * counted so the page can say so instead of pretending the sum is complete.
 *
 * Going below zero is reported, not prevented: whether a table lets a player
 * start in debt is the DM's call, and the builder says the number out loud.
 */

import type { ItemRow } from "@bertinis-vault/vetools-index";
import type { RulesVersion } from "@bertinis-vault/vetools-ref";

import type { BuilderState } from "./builder-state";
import { collapseGearLines } from "./gear-lines";
import { toLines } from "./grants";
import { factsFor } from "./item-facts";
import { kitCopper, startingKitFor, takenOptions, type KitOpenPick } from "./starting-kit";

/** Something the character carries that the kit did not hand over. */
export type Purchase = {
  id: string;
  quantity: number;
  /** What it cost, in copper. Null when the index prints no price. */
  copper: number | null;
};

export type Purse = {
  /** What the kit is worth in coins: the gold option, or the coins a kit adds. */
  startingCopper: number;
  /** The priced purchases, summed. */
  spentCopper: number;
  /** What is left. Negative when the player spent more than they had. */
  balanceCopper: number;
  purchases: Purchase[];
  /** Purchases the index has no price for, and so did not charge. */
  unpriced: number;
};

/** The item type code without its book: `"M|XPHB"` is `"M"`. */
function baseType(row: ItemRow): string {
  return (row.type ?? "").split("|")[0] ?? "";
}

/**
 * Whether a carried item answers an open pick.
 *
 * The categories are the nine the index's kits use, and the five names it
 * prints as items that no item list carries ("holy symbol", "gaming set").
 * Spellcasting foci are not told apart: the index keeps no arcane/druidic/holy
 * mark on an item, and a wizard naming an Amulet for their arcane focus is a
 * table question, not a purchase.
 */
export function fitsOpenPick(row: ItemRow, pick: KitOpenPick): boolean {
  const type = baseType(row);
  const weapon = /^weapon(Simple|Martial)(Melee|Ranged)?$/.exec(pick.category);

  if (weapon) {
    const [, tier = "", reach] = weapon;
    if (row.weaponCategory !== tier.toLowerCase()) return false;
    if (reach === "Melee") return type === "M";
    if (reach === "Ranged") return type === "R";
    return true;
  }

  if (pick.category.startsWith("focusSpellcasting")) return type === "SCF";
  if (pick.category === "instrumentMusical") return type === "INS";
  if (pick.category === "toolArtisan") return type === "AT";
  if (pick.category === "setGaming") return type === "GS";

  if (pick.category === "unresolved") {
    const label = pick.label.toLowerCase();
    if (label.includes("focus") || label.includes("symbol")) return type === "SCF";
    if (label.includes("gaming")) return type === "GS";
    if (label.includes("instrument")) return type === "INS";
  }

  return false;
}

export function purseFor(state: BuilderState, rulesVersion: RulesVersion): Purse {
  const taken = takenOptions(
    startingKitFor(state.classId, state.backgroundId, rulesVersion, state.sourceBooks),
    state.kitChoices,
  );
  const startingCopper = kitCopper(taken);

  // Everything carried, as counts in first-mention order. The weapon and the
  // armour are carried too: a longsword in the weapon slot cost what a
  // longsword in the bag does.
  const order: string[] = [];
  const counts = new Map<string, number>();
  const carry = (id: string, quantity: number) => {
    if (!id) return;
    if (!counts.has(id)) order.push(id);
    counts.set(id, (counts.get(id) ?? 0) + quantity);
  };
  for (const line of collapseGearLines(toLines(state.extraEquipmentText))) carry(line.id, line.quantity);
  carry(state.weaponId, 1);
  carry(state.armorId, 1);

  const rowOf = (id: string) => factsFor(id, rulesVersion, state.sourceBooks[`item:${id}`])?.row ?? null;

  // What the kit put there is not a purchase.
  for (const option of taken) {
    for (const item of option.items) {
      const have = counts.get(item.id) ?? 0;
      if (have > 0) counts.set(item.id, Math.max(0, have - item.quantity));
    }
  }

  // Nor is what the player named for an open pick: one item per pick.
  for (const pick of taken.flatMap((option) => option.openPicks)) {
    const answer = order.find((id) => {
      if ((counts.get(id) ?? 0) < 1) return false;
      const row = rowOf(id);
      return row ? fitsOpenPick(row, pick) : false;
    });
    if (answer) counts.set(answer, (counts.get(answer) ?? 0) - 1);
  }

  const purchases: Purchase[] = [];
  for (const id of order) {
    const quantity = counts.get(id) ?? 0;
    if (quantity < 1) continue;
    const row = rowOf(id);
    // A line the index does not know is a note the player wrote, not an item:
    // there is nothing to charge and nothing to say about it.
    if (!row) continue;
    purchases.push({ id, quantity, copper: row.value === null ? null : row.value * quantity });
  }

  const spentCopper = purchases.reduce((sum, entry) => sum + (entry.copper ?? 0), 0);

  return {
    startingCopper,
    spentCopper,
    balanceCopper: startingCopper - spentCopper,
    purchases,
    unpriced: purchases.filter((entry) => entry.copper === null).length,
  };
}
