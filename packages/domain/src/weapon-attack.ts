/**
 * What a weapon rolls: which ability swings it, the attack bonus, the damage.
 *
 * Nothing in this repository computed this. `derive.ts` produces the *spell*
 * attack bonus and stops there, so a character sheet had every number except
 * the line a player actually rolls on their turn.
 *
 * Both editions state the same three rules and this models exactly those:
 * a melee weapon uses Strength, a ranged weapon uses Dexterity, and a Finesse
 * weapon lets the wielder choose. Nothing here decides *whether* a character
 * is proficient — that is asked of the proficiency layer and arrives as a
 * boolean, because the categories a class grants are its own question.
 */

import { abilityModifier } from "./abilities.js";

/** The two abilities a weapon can be swung with. */
export type WeaponAbility = "str" | "dex";

/**
 * A weapon, as little of it as the arithmetic needs.
 *
 * Deliberately not the index's row type: this package does not depend on the
 * index, and the caller already holds the row. Every field is optional
 * because the catalogue leaves each of them out somewhere.
 */
export type WeaponLike = {
  /**
   * 5etools' item type, which may carry a source: `"M"`, `"M|XPHB"`, `"R"`.
   *
   * Measured across the 325 weapons in the catalogue: `M` and `M|XPHB` for
   * melee, `R` and `R|XPHB` for ranged, and then `SCF`, `WD`, `RD` and
   * **26 rows with no type at all** — every one of those a magic staff, rod
   * or wand that deals 1d6 and is swung by hand. So the reading is: ranged
   * when the head of the type is `R`, and melee otherwise. Testing for
   * `type === "M"` would have called all 73 XPHB melee weapons ranged.
   */
  type?: string | null;
  /** Property codes: `F` finesse, `T` thrown, `V` versatile, `2H`, `L`, `H`. */
  properties?: string[] | null;
  /** The damage die, `"1d8"`. Null for the one weapon that states none. */
  damage?: string | null;
  /** The larger die a Versatile weapon rolls in two hands. */
  versatileDamage?: string | null;
  /** `"S"`, `"P"`, `"B"` — kept as the catalogue writes it. */
  damageType?: string | null;
};

export type WeaponAttack = {
  /** Which ability swings it, once the Finesse choice is settled. */
  ability: WeaponAbility;
  /** True when the wielder had a choice and this is the better half of it. */
  finesse: boolean;
  ranged: boolean;
  /** Ability modifier plus proficiency, when proficient. */
  attackBonus: number;
  /** The ability modifier alone, which is what damage adds. */
  damageModifier: number;
  /** `"1d8 + 3"`, or `"1d8 - 1"`. Null when the weapon states no damage. */
  damage: string | null;
  /** The same for two hands, when the weapon is Versatile. Null otherwise. */
  versatileDamage: string | null;
  /** Whether proficiency was counted, echoed so a sheet can say so. */
  proficient: boolean;
};

/** The head of a `"code|SOURCE"` pair, or the code itself. */
function codeOf(value: string): string {
  return value.split("|")[0] ?? value;
}

function hasProperty(weapon: WeaponLike, code: string): boolean {
  return (weapon.properties ?? []).some((entry) => codeOf(entry) === code);
}

/** Ranged when the type says so; melee for everything else. See `WeaponLike`. */
export function isRangedWeapon(weapon: WeaponLike): boolean {
  return codeOf(weapon.type ?? "") === "R";
}

/**
 * Which ability this weapon uses, given the scores.
 *
 * Finesse is the wielder's choice and this takes the better modifier, which
 * is what every sheet defaults to and what the choice is for. Thrown does not
 * change it: a thrown handaxe is still a Strength weapon, and a thrown dagger
 * is still Finesse.
 */
export function weaponAbilityFor(
  weapon: WeaponLike,
  modifiers: { str: number; dex: number },
): { ability: WeaponAbility; chosen: boolean } {
  if (hasProperty(weapon, "F")) {
    return { ability: modifiers.dex > modifiers.str ? "dex" : "str", chosen: true };
  }

  return { ability: isRangedWeapon(weapon) ? "dex" : "str", chosen: false };
}

const signed = (value: number) => (value < 0 ? `- ${Math.abs(value)}` : `+ ${value}`);

/** `"1d8 + 3"`, and just `"1d8"` when the modifier is zero. */
function damageLine(dice: string | null | undefined, modifier: number): string | null {
  if (!dice) return null;
  return modifier === 0 ? dice : `${dice} ${signed(modifier)}`;
}

export function weaponAttackFor(input: {
  weapon: WeaponLike;
  /** Final scores, after species, improvements and half-feats. */
  scores: { str: number; dex: number };
  proficiencyBonus: number;
  /** Asked of the proficiency layer, never guessed here. */
  proficient: boolean;
}): WeaponAttack {
  const modifiers = {
    str: abilityModifier(input.scores.str),
    dex: abilityModifier(input.scores.dex),
  };

  const { ability, chosen } = weaponAbilityFor(input.weapon, modifiers);
  const damageModifier = modifiers[ability];

  return {
    ability,
    finesse: chosen,
    ranged: isRangedWeapon(input.weapon),
    attackBonus: damageModifier + (input.proficient ? input.proficiencyBonus : 0),
    damageModifier,
    damage: damageLine(input.weapon.damage, damageModifier),
    versatileDamage: damageLine(input.weapon.versatileDamage, damageModifier),
    proficient: input.proficient,
  };
}
