/**
 * What armour and weapons a character may use, and where each came from.
 *
 * Two things live here that used to live inside the Foundry exporter, and both
 * had to move: the Forge never showed the player their own proficiencies, and
 * a table the exporter alone can read is a table the Forge cannot show.
 *
 * The vocabulary is dnd5e's, not the book's. Foundry decides whether a
 * character is proficient with a piece of armour by asking
 * `traits.armorProf.value.has("lgt")` — the key from `DND5E.armorProficiencies`
 * — and with a weapon by asking `traits.weaponProf.value` for either
 * `"sim"`/`"mar"` or the weapon's own base-item id. Writing "light" or
 * "simple, martial" there reads as nothing at all: the character wears their
 * armour non-proficiently, which in dnd5e means disadvantage on every Strength
 * and Dexterity roll and no spellcasting, and swings every weapon without
 * their proficiency bonus.
 *
 * The lists themselves are read off 5etools' `startingProficiencies` and
 * `multiclassing.proficienciesGained`, per class *and per edition*, because
 * the two editions genuinely differ. A 2014 wizard is proficient with five
 * named weapons; a 2024 wizard is proficient with every simple weapon.
 */

import { normalizeClassId } from "./dnd5e-2014.js";

/** The four keys `DND5E.armorProficiencies` accepts. */
export type ArmorProficiencyId = "lgt" | "med" | "hvy" | "shl";

/** The two keys `DND5E.weaponProficiencies` accepts. */
export type WeaponCategoryId = "sim" | "mar";

export type ClassProficiencyGrant = {
  armor: ArmorProficiencyId[];
  /** Whole categories: every simple weapon, every martial one. */
  weaponCategories: WeaponCategoryId[];
  /**
   * Named weapons, as dnd5e base-item ids. Foundry checks these against
   * `item.type.baseItem`, so they are `handcrossbow`, never "Hand Crossbow".
   */
  weaponItems: string[];
  /**
   * What the book prints as a rule instead of a list — the 2024 rogue's
   * "martial weapons that have the Finesse or Light property". It is a real
   * proficiency and it cannot be written as a category, so it travels as the
   * sentence until something holding the weapon table expands it.
   */
  weaponClauses: string[];
};

const NOTHING: ClassProficiencyGrant = {
  armor: [],
  weaponCategories: [],
  weaponItems: [],
  weaponClauses: [],
};

function grant(
  armor: ArmorProficiencyId[],
  weaponCategories: WeaponCategoryId[],
  weaponItems: string[] = [],
  weaponClauses: string[] = [],
): ClassProficiencyGrant {
  return { armor, weaponCategories, weaponItems, weaponClauses };
}

/** What a class hands over when it is the character's *first*. */
const FIRST_CLASS_PROFS: Record<"2014" | "2024", Record<string, ClassProficiencyGrant>> = {
  "2014": {
    artificer: grant(["lgt", "med", "shl"], ["sim"]),
    barbarian: grant(["lgt", "med", "shl"], ["sim", "mar"]),
    bard: grant(["lgt"], ["sim"], ["handcrossbow", "longsword", "rapier", "shortsword"]),
    cleric: grant(["lgt", "med", "shl"], ["sim"]),
    // The druid's ten weapons are a list, not a category: a druid is not
    // proficient with every simple weapon, only with these.
    druid: grant(
      ["lgt", "med", "shl"],
      [],
      [
        "club",
        "dagger",
        "dart",
        "javelin",
        "mace",
        "quarterstaff",
        "scimitar",
        "sickle",
        "sling",
        "spear",
      ],
    ),
    fighter: grant(["lgt", "med", "hvy", "shl"], ["sim", "mar"]),
    monk: grant([], ["sim"], ["shortsword"]),
    paladin: grant(["lgt", "med", "hvy", "shl"], ["sim", "mar"]),
    ranger: grant(["lgt", "med", "shl"], ["sim", "mar"]),
    rogue: grant(["lgt"], ["sim"], ["handcrossbow", "longsword", "rapier", "shortsword"]),
    sorcerer: grant([], [], ["dagger", "dart", "sling", "quarterstaff", "lightcrossbow"]),
    warlock: grant(["lgt"], ["sim"]),
    wizard: grant([], [], ["dagger", "dart", "sling", "quarterstaff", "lightcrossbow"]),
  },
  "2024": {
    // The artificer has no 2024 printing. Its 2014 block is the only one there
    // is, and a 2024 table missing the class would hand an artificer nothing.
    artificer: grant(["lgt", "med", "shl"], ["sim"]),
    barbarian: grant(["lgt", "med", "shl"], ["sim", "mar"]),
    // 2024 traded the bard's four named weapons for every simple weapon, and
    // did the same to the druid, the sorcerer and the wizard.
    bard: grant(["lgt"], ["sim"]),
    cleric: grant(["lgt", "med", "shl"], ["sim"]),
    druid: grant(["lgt", "shl"], ["sim"]),
    fighter: grant(["lgt", "med", "hvy", "shl"], ["sim", "mar"]),
    monk: grant([], ["sim"], [], ["Martial weapons that have the Light property"]),
    paladin: grant(["lgt", "med", "hvy", "shl"], ["sim", "mar"]),
    ranger: grant(["lgt", "med", "shl"], ["sim", "mar"]),
    rogue: grant(["lgt"], ["sim"], [], ["Martial weapons that have the Finesse or Light property"]),
    sorcerer: grant([], ["sim"]),
    warlock: grant(["lgt"], ["sim"]),
    wizard: grant([], ["sim"]),
  },
};

/**
 * What a class hands over when it is *not* the first one.
 *
 * A second class grants a shorter list than a first: a fighter who dips gets
 * light and medium armour and shields, never heavy. A class with no entry
 * grants nothing, which is what the book says by printing nothing — the 2024
 * monk, sorcerer and wizard each print no multiclass proficiencies at all.
 */
const LATER_CLASS_PROFS: Record<"2014" | "2024", Record<string, ClassProficiencyGrant>> = {
  "2014": {
    artificer: grant(["lgt", "med", "shl"], []),
    barbarian: grant(["shl"], ["sim", "mar"]),
    bard: grant(["lgt"], []),
    cleric: grant(["lgt", "med", "shl"], []),
    druid: grant(["lgt", "med", "shl"], []),
    fighter: grant(["lgt", "med", "shl"], ["sim", "mar"]),
    monk: grant([], ["sim"], ["shortsword"]),
    paladin: grant(["lgt", "med", "shl"], ["sim", "mar"]),
    ranger: grant(["lgt", "med", "shl"], ["sim", "mar"]),
    rogue: grant(["lgt"], []),
    warlock: grant(["lgt"], ["sim"]),
  },
  "2024": {
    artificer: grant(["lgt", "med", "shl"], []),
    // 2024 stopped restating simple weapons in the multiclass blocks: a
    // barbarian taken second grants martial weapons and nothing else.
    barbarian: grant(["shl"], ["mar"]),
    bard: grant(["lgt"], []),
    cleric: grant(["lgt", "med", "shl"], []),
    druid: grant(["lgt", "shl"], []),
    fighter: grant(["lgt", "med", "shl"], ["mar"]),
    paladin: grant(["lgt", "med", "shl"], ["mar"]),
    ranger: grant(["lgt", "med", "shl"], ["mar"]),
    rogue: grant(["lgt"], []),
    warlock: grant(["lgt"], []),
  },
};

/**
 * Which base weapons are simple and which are martial.
 *
 * Only the ones a class block ever names are listed: this pair exists to drop
 * a named weapon a category already covers, not to classify the armoury.
 */
const SIMPLE_WEAPON_IDS = new Set([
  "club",
  "dagger",
  "dart",
  "greatclub",
  "handaxe",
  "javelin",
  "lightcrossbow",
  "lighthammer",
  "mace",
  "quarterstaff",
  "shortbow",
  "sickle",
  "sling",
  "spear",
]);

const MARTIAL_WEAPON_IDS = new Set([
  "handcrossbow",
  "longsword",
  "rapier",
  "scimitar",
  "shortsword",
]);

export type ResolvedClassProficiencies = ClassProficiencyGrant & {
  /**
   * Which classes granted each entry, keyed by the entry itself. A player who
   * dipped cleric wants to know where the shield came from, and one who dipped
   * fighter wants to see that heavy armour is not on the list.
   */
  grantedBy: Record<string, string[]>;
};

function editionOf(rulesVersion: string): "2014" | "2024" {
  return rulesVersion === "5e-2024" ? "2024" : "2014";
}

/** What this class grants a character taking it as their first. */
export function firstClassProficiencyGrant(
  classId: string,
  rulesVersion: string,
): ClassProficiencyGrant {
  return FIRST_CLASS_PROFS[editionOf(rulesVersion)][normalizeClassId(classId)] ?? NOTHING;
}

/**
 * What this class grants a character who already has one.
 *
 * The Forge asks this before the player commits to a dip: "what do I actually
 * get out of one level of cleric?" is a question the book answers in a
 * different table from the one on the class's own page.
 */
export function laterClassProficiencyGrant(
  classId: string,
  rulesVersion: string,
): ClassProficiencyGrant {
  return LATER_CLASS_PROFS[editionOf(rulesVersion)][normalizeClassId(classId)] ?? NOTHING;
}

/**
 * The armour and weapons a whole character may use.
 *
 * Order is the character's own: the first class listed is the first class
 * taken, and only that one reads the starting block.
 */
export function classProficienciesFor(
  classes: ReadonlyArray<{ classId: string }>,
  rulesVersion: string,
): ResolvedClassProficiencies {
  const edition = editionOf(rulesVersion);
  const armor: ArmorProficiencyId[] = [];
  const weaponCategories: WeaponCategoryId[] = [];
  const weaponItems: string[] = [];
  const weaponClauses: string[] = [];
  const grantedBy: Record<string, string[]> = {};

  const remember = (value: string, classId: string) => {
    const seen = grantedBy[value];
    if (!seen) grantedBy[value] = [classId];
    else if (!seen.includes(classId)) seen.push(classId);
  };

  classes.forEach((entry, position) => {
    const classId = normalizeClassId(entry.classId);
    const table = position === 0 ? FIRST_CLASS_PROFS : LATER_CLASS_PROFS;
    const block = table[edition][classId] ?? NOTHING;

    for (const value of block.armor) {
      if (!armor.includes(value)) armor.push(value);
      remember(value, classId);
    }
    for (const value of block.weaponCategories) {
      if (!weaponCategories.includes(value)) weaponCategories.push(value);
      remember(value, classId);
    }
    for (const value of block.weaponItems) {
      if (!weaponItems.includes(value)) weaponItems.push(value);
      remember(value, classId);
    }
    for (const value of block.weaponClauses) {
      if (!weaponClauses.includes(value)) weaponClauses.push(value);
      remember(value, classId);
    }
  });

  // A character proficient with every simple weapon does not also need to be
  // told they may use a dagger. Naming it again would show the player a list
  // twice as long as the one on their sheet.
  const covered = (id: string) =>
    (weaponCategories.includes("sim") && SIMPLE_WEAPON_IDS.has(id)) ||
    (weaponCategories.includes("mar") && MARTIAL_WEAPON_IDS.has(id));

  return {
    armor,
    weaponCategories,
    weaponItems: weaponItems.filter((id) => !covered(id)),
    weaponClauses,
    grantedBy,
  };
}
