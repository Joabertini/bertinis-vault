/**
 * What the sheet will do to a character who picks gear they cannot use.
 *
 * A player is allowed to strap on plate they never trained in — the rules say
 * so, and a wizard who finds a suit of it on the floor may well want to. What
 * the rules do not do is let it pass quietly: the penalty lands on nearly every
 * roll they make, and it lands in Foundry too, because the proficiency set
 * travels with the character.
 *
 * So this warns and never blocks. The wording says what happens rather than
 * what is missing — "no proficiency" tells a player nothing they can act on.
 */

import type { ItemRow } from "@bertinis-vault/vetools-index";

import type { GearProficiencies } from "./gear-proficiencies";
import { foundryWeaponId } from "./weapon-mastery";

/** The armour category codes 5etools writes, as dnd5e spells them. */
const ARMOR_CATEGORY: Record<string, string> = {
  LA: "lgt",
  MA: "med",
  HA: "hvy",
  S: "shl",
};

/**
 * A row's armour category, or null if it is not armour.
 *
 * The type carries the book after a pipe on 2024 rows — `"HA|XPHB"` — and the
 * category is the half in front of it.
 */
export function armorCategoryOf(row: Pick<ItemRow, "type">): string | null {
  const code = (row.type ?? "").split("|")[0] ?? "";
  return ARMOR_CATEGORY[code] ?? null;
}

/**
 * The warning for armour the character is not trained in, or null.
 *
 * The shield is worth its own sentence: it is the one piece of armour a player
 * picks up expecting a flat +2, and a shield without proficiency carries the
 * same penalty as a breastplate without one.
 */
export function armorWarningFor(
  row: Pick<ItemRow, "type" | "name">,
  proficiencies: GearProficiencies | null,
): string | null {
  const category = armorCategoryOf(row);
  if (!category || !proficiencies) return null;
  if (proficiencies.foundryArmorIds.includes(category)) return null;

  const piece = category === "shl" ? "Con este escudo" : "Con esta armadura";

  return `${piece} tu personaje no tiene competencia: desventaja en toda tirada de Fuerza y Destreza —pruebas, salvaciones y ataques— y no puede lanzar conjuros mientras la lleve puesta.`;
}

/**
 * The warning for a weapon the character is not trained in, or null.
 *
 * A magic weapon is left alone. Its row name is the magic item's — "Scimitar of
 * Speed" — and dnd5e checks proficiency against the base item underneath, which
 * this cannot see from here. Warning on it would be a guess, and a wrong one
 * for anyone who is proficient with scimitars.
 */
export function weaponWarningFor(
  row: Pick<ItemRow, "name" | "weaponCategory" | "rarity">,
  proficiencies: GearProficiencies | null,
): string | null {
  if (!row.weaponCategory || !proficiencies) return null;
  if (row.rarity && row.rarity !== "none") return null;

  const category = row.weaponCategory === "martial" ? "mar" : "sim";
  if (proficiencies.foundryWeaponIds.includes(category)) return null;
  if (proficiencies.foundryWeaponIds.includes(foundryWeaponId(row.name))) return null;

  return "Tu personaje no tiene competencia con esta arma: ataca sin sumar el bonificador de competencia.";
}
