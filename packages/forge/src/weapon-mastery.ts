/**
 * Weapon mastery: which weapons this character has learned to use *well*.
 *
 * 2024 only, and only five classes grant it. It is not a property you pick —
 * it is a list of weapon **types**. A fighter who masters the longsword gets
 * that weapon's own mastery property (Sap) whenever they swing one, and gets
 * nothing extra from a longsword +1 they find later: mastery is of the kind,
 * not of the object.
 *
 * That is also how Foundry stores it. `traits.weaponProf.mastery.value` is a
 * set it checks with `has(item.type.baseItem)`, so the values have to be
 * dnd5e's base-item ids — `longsword`, not "Longsword" and not "Sap".
 */

import { collections, forRulesVersion } from "@bertinis-vault/vetools-index";
import type { RulesVersion } from "@bertinis-vault/vetools-ref";

import { classInfoFor } from "./index-options";

/** One weapon a character could take mastery of. */
export type MasteryOption = {
  /** The dnd5e base-item id, which is what Foundry reads. */
  id: string;
  label: string;
  /** The property mastering it grants — Sap, Vex, Topple. */
  mastery: string;
  melee: boolean;
};

export type MasteryPlan = {
  /** How many weapons this character may master. Zero means the panel hides. */
  count: number;
  /** True when every class granting mastery restricts it to melee. */
  meleeOnly: boolean;
  options: MasteryOption[];
};

/**
 * A weapon's name as dnd5e ids spell it: lowercase, nothing but letters.
 *
 * Measured rather than assumed: this maps the index's 38 base weapons onto
 * dnd5e 5.3.3's 38 `weaponIds` with no misses in either direction. The test
 * pins that, so an index that renames a weapon fails loudly instead of
 * exporting a mastery Foundry ignores.
 */
export function foundryWeaponId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * The weapons dnd5e 5.3.3 has a base-item id for, read off `CONFIG.DND5E.weaponIds`
 * in the installed system.
 *
 * This is the contract with Foundry, not a preference. A mastery exported for
 * anything outside this list lands in a set Foundry checks with
 * `has(item.type.baseItem)` and matches nothing — the player would see the
 * choice they made simply not happen. The index carries eleven more weapons
 * with a mastery property (the modern firearms, the Soulknife's Psychic Blade,
 * two spellcasting staves); none is a base item dnd5e knows, so none is
 * offered. The test pins both directions.
 */
export const FOUNDRY_WEAPON_IDS: ReadonlySet<string> = new Set([
  "battleaxe", "blowgun", "club", "dagger", "dart", "flail", "glaive", "greataxe",
  "greatclub", "greatsword", "halberd", "handaxe", "handcrossbow", "heavycrossbow",
  "javelin", "lance", "lightcrossbow", "lighthammer", "longbow", "longsword", "mace",
  "maul", "morningstar", "musket", "pike", "pistol", "quarterstaff", "rapier",
  "scimitar", "shortsword", "sickle", "spear", "shortbow", "sling", "trident",
  "warpick", "warhammer", "whip",
]);

/**
 * Whether a weapon is one you swing rather than one you fire or throw.
 *
 * The index writes the kind and the book together — `"M|XPHB"`, `"R|XPHB"` —
 * so the letter is the head of the field, not the whole of it.
 */
function isMelee(row: { type?: string | null }): boolean {
  return (row.type ?? "").split("|")[0] !== "R";
}

/**
 * Every base weapon that carries a mastery property.
 *
 * Magic weapons are excluded on purpose. Mastery is of a kind of weapon, so
 * "Dagger of Venom" is not a choice — "dagger" is, and it already covers it.
 */
export function masteryOptionsFor(rulesVersion: RulesVersion): MasteryOption[] {
  const rows = forRulesVersion(collections.item ?? [], rulesVersion) as {
    name: string;
    mastery?: string[] | null;
    rarity?: string | null;
    type?: string | null;
  }[];

  const seen = new Set<string>();
  const options: MasteryOption[] = [];

  for (const row of rows) {
    const mastery = row.mastery?.[0];
    if (!mastery) continue;

    // A magic weapon carries its base weapon's mastery, and taking it as its
    // own option would offer the player the same choice under a rarer name.
    if (row.rarity && row.rarity !== "none") continue;

    const id = foundryWeaponId(row.name);
    if (!FOUNDRY_WEAPON_IDS.has(id) || seen.has(id)) continue;
    seen.add(id);

    options.push({ id, label: row.name, mastery, melee: isMelee(row) });
  }

  return options.sort((left, right) => left.label.localeCompare(right.label));
}

/**
 * How many weapons this character may master, and which ones are on offer.
 *
 * With more than one class that grants mastery, the count is the **highest**,
 * not the sum: each class's table prints a number for a character of that
 * class, and adding two of them invents a number no table prints. The melee
 * restriction only binds when every granting class carries it — a barbarian
 * 3 / fighter 3 masters at the fighter's allowance, and the fighter's is not
 * melee-only.
 */
export function masteryPlanFor(
  classes: { classId: string; level: number }[],
  rulesVersion: RulesVersion,
): MasteryPlan {
  let count = 0;
  let meleeOnly = true;
  let granted = false;

  for (const entry of classes) {
    const progression = classInfoFor(entry.classId, rulesVersion)?.weaponMastery;
    if (!progression) continue;

    const atLevel = progression.countByLevel[Math.min(20, Math.max(1, entry.level)) - 1] ?? 0;
    if (atLevel < 1) continue;

    granted = true;
    count = Math.max(count, atLevel);
    if (!progression.meleeOnly) meleeOnly = false;
  }

  if (!granted) return { count: 0, meleeOnly: false, options: [] };

  const options = masteryOptionsFor(rulesVersion);
  return {
    count,
    meleeOnly,
    options: meleeOnly ? options.filter((option) => option.melee) : options,
  };
}

/** What is wrong with the weapons a player has picked. */
export type MasteryProblem =
  /** More picks than the character's classes allow. */
  | { kind: "over-limit"; picked: number; allowed: number }
  /** A weapon with no mastery property to master. */
  | { kind: "no-property"; itemId: string };

/**
 * The problems with a set of picks, reported rather than silently trimmed.
 *
 * Trimming is the failure this builder keeps finding elsewhere: the player
 * chose four weapons, three were kept, and nothing on the page said which one
 * was dropped or that anything was. A number they can read beats a pick that
 * quietly went missing.
 */
export function masteryProblemsFor(picked: string[], plan: MasteryPlan): MasteryProblem[] {
  const problems: MasteryProblem[] = [];
  const unique = [...new Set(picked)];

  if (unique.length > plan.count) {
    problems.push({ kind: "over-limit", picked: unique.length, allowed: plan.count });
  }

  for (const id of unique) {
    if (!plan.options.some((option) => option.id === id)) {
      problems.push({ kind: "no-property", itemId: id });
    }
  }

  return problems;
}

/**
 * The plan, narrowed to the weapons the character has.
 *
 * Mastery is not a list to pick from: the weapon hands it over. A character
 * masters weapons they own — the ones in the starting kit, the one they
 * picked, whatever they added to the bag — so the choice is among those, and
 * a weapon that is not in the bag is not on offer. `names` are item names as
 * the index writes them; anything that is not a base weapon with a mastery
 * property simply matches nothing.
 */
export function masteryPlanForCarried(plan: MasteryPlan, names: Iterable<string>): MasteryPlan {
  const held = new Set([...names].map((name) => foundryWeaponId(name)));
  return { ...plan, options: plan.options.filter((option) => held.has(option.id)) };
}

/** The picks that are still weapons the character has; the rest left with the weapon. */
export function picksStillCarried(picked: string[], plan: MasteryPlan): string[] {
  return picked.filter((id) => plan.options.some((option) => option.id === id));
}

