/**
 * The attack lines a player rolls on their turn.
 *
 * `packages/domain/weapon-attack.ts` does the arithmetic and knows nothing
 * about this app: it takes a weapon shape, two scores and a boolean. This is
 * the wiring — which of the things in the bag are weapons, what the index says
 * about each, and whether the character is trained in it — so the sheet can
 * print a row instead of assembling one.
 *
 * Proficiency is asked of the proficiency layer, never inferred here. That is
 * the same rule the domain module states, and the reason it takes a boolean.
 */

import { weaponAttackFor, type WeaponAttack } from "@bertinis-vault/domain";
import type { CharacterBuild } from "@bertinis-vault/contracts";
import type { RulesVersion } from "@bertinis-vault/vetools-ref";

import type { GearProficiencies } from "./gear-proficiencies";
import { isWeaponProficient } from "./gear-warnings";
import { itemInfoFor } from "./index-options";

/** How the catalogue spells damage types, in the language the sheet speaks. */
const DAMAGE_TYPE: Record<string, string> = {
  S: "cortante",
  P: "perforante",
  B: "contundente",
};

export type AttackLine = WeaponAttack & {
  /** The weapon's own name, as the catalogue writes it. */
  name: string;
  quantity: number;
  /** "cortante", or the raw code when the catalogue uses one this does not. */
  damageType: string | null;
};

/**
 * Every weapon in the bag, as a line.
 *
 * Order is the bag's own. A character carrying two of something gets one line
 * with a count, because the second scimitar does not roll differently — the
 * off-hand attack is a rule about the action, not about the weapon.
 */
export function attackLinesFor(
  build: CharacterBuild,
  rulesVersion: RulesVersion,
  proficiencies: GearProficiencies | null,
): AttackLine[] {
  const equipment = build.choices.normalized?.equipment ?? [];
  const sourceBooks = build.sourceBooks ?? {};

  const lines: AttackLine[] = [];

  for (const entry of equipment) {
    if (entry.category !== "weapon") continue;

    const id = entry.itemId ?? "";
    const row = id ? itemInfoFor(id, rulesVersion, sourceBooks[`item:${id}`]) : null;
    // A weapon the index does not carry cannot be rolled for: every number on
    // the line comes from its row. Listing it with dashes would be a row that
    // looks like an attack and answers nothing.
    if (!row) continue;

    const attack = weaponAttackFor({
      weapon: {
        type: row.type ?? null,
        properties: row.properties ?? null,
        damage: row.damage ?? null,
        versatileDamage: row.versatileDamage ?? null,
        damageType: row.damageType ?? null,
      },
      scores: { str: build.abilities.final.str, dex: build.abilities.final.dex },
      proficiencyBonus: build.derived.proficiencyBonus,
      proficient: isWeaponProficient(row, proficiencies),
    });

    lines.push({
      ...attack,
      name: row.name,
      quantity: entry.quantity,
      damageType: row.damageType ? (DAMAGE_TYPE[row.damageType] ?? row.damageType) : null,
    });
  }

  return lines;
}

/** `"+5"` — a modifier is read with its sign or it is read as a total. */
export function signed(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}
