/**
 * Which magic items the character is actually attuned to.
 *
 * The bag already tells the player an item requires attunement — a small
 * marker beside its name — and then nothing asked the question. So every magic
 * item reached Foundry unattuned, which for most of them means it does
 * nothing: a Cloak of Protection grants no bonus and a Belt of Giant Strength
 * sets no score until somebody ticks the box on the sheet.
 *
 * The rule lives in the domain package. This only decides what is on the list:
 * the bag, the weapon and the armour, because a +1 longsword is a weapon slot
 * and a Cloak of Elvenkind is armour, and asking only about the bag would miss
 * both.
 */

import { attunementFor, type AttunementState } from "@bertinis-vault/domain";
import type { RulesVersion } from "@bertinis-vault/vetools-ref";

import type { BuilderState } from "./builder-state";
import { collapseGearLines } from "./gear-lines";
import { factsFor, nameFor } from "./item-facts";
import { toLines } from "./grants";

/**
 * Everything carried that asks for attunement, by the id the draft stores.
 *
 * A hand-typed line the index has never heard of is left out rather than
 * offered: it has no `attunement` flag to read, and offering every note in the
 * bag as a magic item would bury the two that are.
 */
export function attunableItemsFor(state: BuilderState, rulesVersion: RulesVersion) {
  const bag = collapseGearLines(toLines(state.extraEquipmentText));
  const singles = [state.weaponId, state.armorId].filter(Boolean).map((id) => ({ id, quantity: 1 }));

  return [...bag, ...singles]
    .filter((entry) => factsFor(entry.id, rulesVersion, state.sourceBooks[`item:${entry.id}`])?.attunement)
    .map((entry) => ({ id: entry.id, label: nameFor(entry.id, rulesVersion) }));
}

export function attunementStateFor(
  state: BuilderState,
  rulesVersion: RulesVersion,
): AttunementState {
  return attunementFor({
    offered: attunableItemsFor(state, rulesVersion),
    attuned: state.attunedItemIds,
  });
}
