/**
 * Armour class when the character is not wearing armour.
 *
 * A barbarian's Unarmored Defense is 10 + Dexterity + Constitution, a monk's
 * is 10 + Dexterity + Wisdom, a lizardfolk's scales are 13 + Dexterity, a
 * tortle's shell is a flat 17. Every one of them replaces the default 10 + Dex
 * rather than adding to it, and the character uses whichever is higher.
 *
 * `calculateArmorClass` has had an `unarmoredAbilityModifier` parameter and a
 * `"special"` formula since the beginning, and nothing has ever passed either.
 * So a barbarian with 16 Constitution was shown three lower than they are —
 * answered wrong rather than left blank, which is worse: nothing on the sheet
 * says a number is missing.
 *
 * What is *not* here is which class gets which formula. That comes off the
 * index, which reads it from the feature text and from 5etools' Foundry
 * companion data.
 */

/** One alternative way of computing armour class, and what it costs to use. */
export type ArmorClassOptionLike = {
  name: string;
  source: string;
  level: number;
  isVariant: boolean;
  /** The flat part: 10 for Unarmored Defense, 13 for draconic scales, 17 for a shell. */
  base: number;
  /** Modifiers added on top, in the order the feature names them. */
  abilities: string[];
  /**
   * Whether a shield still applies.
   *
   * A barbarian "can use a shield and still gain this benefit"; a monk's
   * applies only "while you are wearing no armor and not wielding a shield".
   * Neither Plutonium nor the `dnd5e` system models the difference — both add
   * the shield to a monk's total anyway.
   */
  allowsShield: boolean;
  /** Whether wearing armour switches it off. True for all of them so far. */
  requiresNoArmor: boolean;
  /** What `dnd5e` calls the calculation, when it has a name for it. */
  calc?: string | null | undefined;
};

const ABILITY_IDS = new Set(["str", "dex", "con", "int", "wis", "cha"]);

/** What an option is worth, given the character's modifiers. */
export function armorClassFrom(
  option: ArmorClassOptionLike,
  modifiers: Record<string, number>,
): number {
  return option.abilities.reduce(
    (total, ability) => total + (ABILITY_IDS.has(ability) ? (modifiers[ability] ?? 0) : 0),
    option.base,
  );
}

/**
 * The options a character has actually earned.
 *
 * Same two gates as expertise, in the same order: the level, then whether an
 * optional feature was taken. A species' natural armour is recorded at level 1
 * and so is never gated by the first.
 */
export function activeArmorClassOptions({
  options,
  level,
  variantsTaken = [],
}: {
  options: ArmorClassOptionLike[];
  level: number;
  variantsTaken?: string[];
}): ArmorClassOptionLike[] {
  const taken = new Set(variantsTaken.map((name) => name.toLowerCase()));

  return options
    .filter((option) => option.level <= level)
    .filter((option) => !option.isVariant || taken.has(option.name.toLowerCase()));
}

/** Which armour class a character actually has, and where it comes from. */
export type ArmorClassResult = {
  ac: number;
  /** The feature that produced it, or null when it is the armour they wear. */
  from: ArmorClassOptionLike | null;
};

/**
 * The best armour class available, worn armour and every feature considered.
 *
 * The rules do not make this a choice — a character uses the highest, and a
 * lizardfolk in leather armour is explicitly told to use whichever is better.
 * So it is computed rather than asked, which also means it cannot be left
 * unanswered.
 *
 * A shield is added last and to whichever option won, except where the option
 * says a shield switches it off. In that case the option is simply not
 * available while the shield is held, and the comparison runs without it —
 * which is the rules-correct reading and the one place this deliberately
 * disagrees with what the Foundry sheet will show.
 */
export function bestArmorClass({
  options,
  modifiers,
  wornArmorClass,
  isWearingArmor,
  hasShield = false,
  level,
  variantsTaken = [],
}: {
  options: ArmorClassOptionLike[];
  modifiers: Record<string, number>;
  /** What the character's worn armour (or its absence) is worth, shield aside. */
  wornArmorClass: number;
  isWearingArmor: boolean;
  hasShield?: boolean;
  level: number;
  variantsTaken?: string[];
}): ArmorClassResult {
  const shield = hasShield ? 2 : 0;
  let best: ArmorClassResult = { ac: wornArmorClass + shield, from: null };

  for (const option of activeArmorClassOptions({ options, level, variantsTaken })) {
    if (option.requiresNoArmor && isWearingArmor) continue;
    if (hasShield && !option.allowsShield) continue;

    const ac = armorClassFrom(option, modifiers) + shield;
    if (ac > best.ac) best = { ac, from: option };
  }

  return best;
}
