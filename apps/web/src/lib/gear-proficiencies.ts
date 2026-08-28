/**
 * What this character may wear and what they may swing.
 *
 * The sheet listed skills, saves and tools and never once said whether the
 * character could use the sword in their bag. It is the question a player
 * answers at the shop and at the first fight, and until now the only place it
 * existed was inside the Foundry exporter — a table the Forge could not read.
 *
 * Three shapes come out of the books and all three are shown, because the
 * player reads them differently: "armas simples" is a category, "espada
 * ropera" is one weapon a class names, and "armas marciales sutiles o ligeras"
 * is a rule. The rule is expanded here into the weapons it actually names —
 * Foundry has nowhere to store a rule, and a player standing in front of a
 * scimitar wants to know about that scimitar.
 */

import { collections, forRulesVersion } from "@bertinis-vault/vetools-index";
import {
  classProficienciesFor,
  type ResolvedClassProficiencies,
} from "@bertinis-vault/domain";
import type { RulesVersion } from "@bertinis-vault/vetools-ref";

import { FOUNDRY_WEAPON_IDS, foundryWeaponId } from "./weapon-mastery";

export type ProficiencyLine = {
  /** The dnd5e key or base-item id this line stands for. */
  id: string;
  label: string;
  /** The class ids that granted it. A dip is worth explaining. */
  from: string[];
  /** What a rule expands to, spelled out. Absent for anything but a clause. */
  detail?: string;
};

export type GearProficiencies = {
  armor: ProficiencyLine[];
  weapons: ProficiencyLine[];
  /**
   * The base-item ids the clauses expand to.
   *
   * These have to reach Foundry as ids: `traits.weaponProf.value` is checked
   * with `has(item.type.baseItem)`, and the sentence they came from is checked
   * against nothing at all.
   */
  clauseWeaponIds: string[];
};

const ARMOR_LABEL: Record<string, string> = {
  lgt: "Armadura ligera",
  med: "Armadura media",
  hvy: "Armadura pesada",
  shl: "Escudos",
};

const CATEGORY_LABEL: Record<string, string> = {
  sim: "Armas simples",
  mar: "Armas marciales",
};

/**
 * The property codes the index writes, by the English word a clause uses.
 *
 * Only the ones a printed clause actually names. A code added here without a
 * clause that mentions it would never be reached.
 */
const PROPERTY_CODE: Record<string, string> = {
  light: "L",
  finesse: "F",
  heavy: "H",
  versatile: "V",
  thrown: "T",
  reach: "R",
};

const PROPERTY_LABEL: Record<string, string> = {
  light: "ligeras",
  finesse: "sutiles",
  heavy: "pesadas",
  versatile: "versatiles",
  thrown: "arrojadizas",
  reach: "de alcance",
};

/**
 * The properties a rule names, in the order the rule names them.
 *
 * The sentence's own order, not the table's: the book prints "Finesse or
 * Light", and a player checking the sheet against the page should read the
 * same two words in the same two places.
 */
function propertyWordsIn(clause: string): string[] {
  return Object.keys(PROPERTY_CODE)
    .map((word) => ({ word, at: clause.search(new RegExp(`\\b${word}\\b`, "i")) }))
    .filter((entry) => entry.at >= 0)
    .sort((left, right) => left.at - right.at)
    .map((entry) => entry.word);
}

/** A weapon's name as dnd5e ids spell it, and as the index spells it. */
type WeaponRow = {
  name: string;
  type?: string | null;
  rarity?: string | null;
  properties?: string[];
  weaponCategory?: string | null;
};

/**
 * The weapons a printed rule names.
 *
 * "Martial weapons that have the Finesse or Light property" is read the way it
 * is written: a category, then the properties, then whether the rule wants any
 * of them or all of them. Anything the sentence does not say — a category with
 * no properties, or properties with no category — expands to nothing rather
 * than to a guess, and the sentence is still shown to the player.
 */
export function weaponsMatchingClause(clause: string, rulesVersion: RulesVersion): string[] {
  const category = /\bmartial\b/i.test(clause)
    ? "martial"
    : /\bsimple\b/i.test(clause)
      ? "simple"
      : null;
  if (!category) return [];

  const words = propertyWordsIn(clause);
  if (!words.length) return [];

  // "Finesse or Light" is either; "Finesse and Light" would be both. The books
  // print the first shape today, and reading "and" as "or" would hand out
  // weapons the rule excludes.
  const needsAll = /\band\b/i.test(clause);
  const codes = words.map((word) => PROPERTY_CODE[word] as string);

  const rows = forRulesVersion(collections.item ?? [], rulesVersion) as WeaponRow[];
  const ids: string[] = [];

  for (const row of rows) {
    if (row.weaponCategory !== category) continue;
    // A magic weapon carries its base weapon's properties. Listing "Scimitar
    // of Speed" beside "Scimitar" would say the same thing twice.
    if (row.rarity && row.rarity !== "none") continue;

    const properties = row.properties ?? [];
    const matches = needsAll
      ? codes.every((code) => properties.includes(code))
      : codes.some((code) => properties.includes(code));
    if (!matches) continue;

    // Only what dnd5e has a base item for. Anything else lands in a set
    // Foundry checks with `has(item.type.baseItem)` and matches nothing.
    const id = foundryWeaponId(row.name);
    if (!FOUNDRY_WEAPON_IDS.has(id) || ids.includes(id)) continue;
    ids.push(id);
  }

  return ids.sort();
}

/** The same rule, said in Spanish. Falls back to the sentence as printed. */
function clauseLabel(clause: string): string {
  const category = /\bmartial\b/i.test(clause)
    ? "Armas marciales"
    : /\bsimple\b/i.test(clause)
      ? "Armas simples"
      : null;
  const words = propertyWordsIn(clause);
  if (!category || !words.length) return clause;

  const joiner = /\band\b/i.test(clause) ? " y " : " o ";
  return `${category} ${words.map((word) => PROPERTY_LABEL[word]).join(joiner)}`;
}

/** A base-item id back to the name the index prints for it. */
function weaponNameById(rulesVersion: RulesVersion): Map<string, string> {
  const rows = forRulesVersion(collections.item ?? [], rulesVersion) as WeaponRow[];
  const names = new Map<string, string>();
  for (const row of rows) {
    if (!row.weaponCategory) continue;
    const id = foundryWeaponId(row.name);
    if (!names.has(id)) names.set(id, row.name);
  }
  return names;
}

/**
 * Everything this character may wear and use, ready to read.
 *
 * The order is the order the rules grant it: categories first, then the
 * weapons a class names one by one, then the rules. A player scanning for
 * "can I use this?" reads the widest answer first.
 */
export function gearProficienciesFor(
  classes: ReadonlyArray<{ classId: string }>,
  rulesVersion: RulesVersion,
): GearProficiencies {
  const resolved: ResolvedClassProficiencies = classProficienciesFor(
    classes,
    rulesVersion === "2024" ? "5e-2024" : "5e-2014",
  );
  const names = weaponNameById(rulesVersion);
  const clauseWeaponIds: string[] = [];

  const line = (id: string, label: string): ProficiencyLine => ({
    id,
    label,
    from: resolved.grantedBy[id] ?? [],
  });

  const weapons: ProficiencyLine[] = [
    ...resolved.weaponCategories.map((id) => line(id, CATEGORY_LABEL[id] ?? id)),
    ...resolved.weaponItems.map((id) => line(id, names.get(id) ?? id)),
  ];

  for (const clause of resolved.weaponClauses) {
    const ids = weaponsMatchingClause(clause, rulesVersion);
    for (const id of ids) if (!clauseWeaponIds.includes(id)) clauseWeaponIds.push(id);

    weapons.push({
      id: clause,
      label: clauseLabel(clause),
      from: resolved.grantedBy[clause] ?? [],
      // The rule is the proficiency; the list is what it comes to. Both are
      // shown because the player needs the first to argue with a DM and the
      // second to buy a weapon.
      ...(ids.length ? { detail: ids.map((id) => names.get(id) ?? id).join(", ") } : {}),
    });
  }

  return {
    armor: resolved.armor.map((id) => line(id, ARMOR_LABEL[id] ?? id)),
    weapons,
    clauseWeaponIds,
  };
}
