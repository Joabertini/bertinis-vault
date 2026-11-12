/**
 * What the character is actually carrying, against what they can.
 *
 * The bag weighed itself and nothing compared the total to anything, so a
 * character could walk out of the Forge under three times what the rules allow
 * with nothing on the page saying so.
 *
 * Three things are carried and the bag was only one of them: the weapon and
 * the armour are single picks with real weight, and a suit of plate is 65 lb
 * on its own — more than half of what a Strength 8 wizard can carry. Counting
 * only the bag would have reported a load the character does not have.
 *
 * The rule lives in the domain package; this only decides what goes on the
 * scale.
 */

import {
  carryingCapacity,
  loadStateFor,
  type CarryingCapacity,
  type CreatureSize,
  type LoadState,
} from "@bertinis-vault/domain";
import type { RulesVersion } from "@bertinis-vault/vetools-ref";

import type { BuilderState } from "./builder-state";
import { collapseGearLines } from "./gear-lines";
import { factsFor } from "./item-facts";
import { toLines } from "./grants";

export type CarriedLoad = {
  pounds: number;
  /** How many of the carried lines the index could weigh, and how many there are. */
  weighed: number;
  lines: number;
  limits: CarryingCapacity;
  state: LoadState;
};

export function carriedLoadFor(
  state: BuilderState,
  rulesVersion: RulesVersion,
  strength: number,
  size?: CreatureSize,
): CarriedLoad {
  const bag = collapseGearLines(toLines(state.extraEquipmentText));
  /*
   * The weapon and the armour count once each. They are ids the same catalog
   * knows, so they go through the same lookup rather than a second one.
   */
  const singles = [state.weaponId, state.armorId]
    .filter(Boolean)
    .map((id) => ({ id, quantity: 1 }));
  const carried = [...bag, ...singles];

  let pounds = 0;
  let weighed = 0;

  for (const entry of carried) {
    const facts = factsFor(entry.id, rulesVersion, state.sourceBooks[`item:${entry.id}`]);
    // A line the index does not know is left off the scale rather than guessed
    // at, and counted so the total can say it is partial. Twenty arrows weigh
    // twenty arrows.
    if (!facts || facts.row.weight === null || facts.row.weight === undefined) continue;
    pounds += facts.row.weight * entry.quantity;
    weighed += 1;
  }

  const limits = carryingCapacity(strength, size);

  return {
    pounds: Math.round(pounds * 100) / 100,
    weighed,
    lines: carried.length,
    limits,
    state: loadStateFor(pounds, limits),
  };
}
