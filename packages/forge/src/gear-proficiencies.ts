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

import { collections, forRulesVersion, legalRowsFor } from "@bertinis-vault/vetools-index";
import {
  classProficienciesFor,
  type ResolvedClassProficiencies,
} from "@bertinis-vault/domain";
import type { RulesVersion } from "@bertinis-vault/vetools-ref";

import { FOUNDRY_WEAPON_IDS, foundryWeaponId } from "./weapon-mastery";

/**
 * What the species contributes, and the name to credit it under.
 *
 * A dwarf is proficient with the warhammer whatever they take levels in, and a
 * dwarf wizard swinging one swings it at their proficiency bonus. Left out of
 * the class table on purpose: it is not a class's to grant.
 */
export type SpeciesGrant = {
  /** The id `grantedBy` credits — the species slug the sheet can label. */
  id: string;
  /** "light", "medium", as the books print them. */
  armor: string[];
  /** Weapon names as the books print them, e.g. "light hammer". */
  weaponItems: string[];
  weaponClauses: string[];
};

/**
 * What a feat contributes, and the name to credit it under.
 *
 * Read per rules version by the caller, not here: the shield changes hands
 * between editions — 2014 puts it on Moderately Armored, 2024 on Lightly
 * Armored — so the grant that arrives is already the one this character's
 * books print.
 */
export type FeatGrant = {
  /** The feat slug `grantedBy` credits. */
  id: string;
  /** The feat's name, for a sheet that has to say where a shield came from. */
  label: string;
  /** "light", "medium", "heavy", "shield". */
  armor: string[];
  /** "simple", "martial". */
  weaponCategories: string[];
  weaponClauses: string[];
};

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
  /**
   * The weapons the species grants by name, as base-item ids.
   *
   * Separate from the clause ids only so the caller can tell where each came
   * from. Both are proficiencies no class document carries, so both have to
   * reach Foundry from here.
   */
  speciesWeaponIds: string[];
  /**
   * Everything Foundry can check, in one set: `sim`, `mar`, and base-item ids.
   *
   * The lines above are for reading — one of them is a whole sentence, because
   * a rule is not a list. This is for writing, so the sentence is left out and
   * what it expands to is included.
   */
  foundryWeaponIds: string[];
  /** `lgt`, `med`, `hvy`, `shl`. */
  foundryArmorIds: string[];
};

const ARMOR_LABEL: Record<string, string> = {
  lgt: "Armadura ligera",
  med: "Armadura media",
  hvy: "Armadura pesada",
  shl: "Escudos",
};

/** The books say "light"; dnd5e says "lgt". Species and feats both arrive in the books' words. */
const ARMOR_KEY: Record<string, string> = {
  light: "lgt",
  medium: "med",
  heavy: "hvy",
  shield: "shl",
};

/** The same trade for weapons: the books say "martial", dnd5e says "mar". */
const WEAPON_CATEGORY_KEY: Record<string, string> = {
  simple: "sim",
  martial: "mar",
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

/**
 * The rules that are a category the export has no code for, said in Spanish.
 *
 * The Giff's firearms have read "Firearms" on a Spanish sheet since the species
 * grants landed. Tavern Brawler and Weapon Master would have added two more.
 */
const CLAUSE_LABEL: Record<string, string> = {
  Firearms: "Armas de fuego",
  "Improvised weapons": "Armas improvisadas",
};

/** The same rule, said in Spanish. Falls back to the sentence as printed. */
function clauseLabel(clause: string): string {
  const named = CLAUSE_LABEL[clause];
  if (named) return named;

  /*
   * A pick, not a grant. The count is said because it is the whole rule —
   * Weapon Master is four weapons, the Hobgoblin's is two — and nothing here
   * asks the player which, so the line grants nothing and says so by naming a
   * number the player still owes.
   */
  const choice = /^choose (\d+) (martial|simple) weapons$/i.exec(clause);
  if (choice) {
    const kind = choice[2]?.toLowerCase() === "martial" ? "marciales" : "simples";
    return `${choice[1]} armas ${kind} a eleccion`;
  }

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

/**
 * Whether a category the character already has covers this weapon.
 *
 * Read off the item table rather than from a list written here. A dwarf
 * *fighter* has martial weapons outright, so naming the battleaxe again would
 * be noise; a dwarf *wizard* has nothing of the kind, and the battleaxe is the
 * only reason they can swing one.
 */
type WeaponIndex = {
  /** A base-item id to the category the index files it under. */
  categories: Map<string, string>;
  /** A base-item id back to the name the index prints for it. */
  names: Map<string, string>;
};

const weaponIndexes = new WeakMap<readonly WeaponRow[], WeaponIndex>();

/**
 * Both tables, read off the item table once.
 *
 * They are the same for every character of an edition, and walking 1773 items
 * twice to rebuild them was part of every derivation. Kept against the list of
 * legal items they were read from, so a change of ruleset or of book library
 * gets its own.
 */
function weaponIndexFor(rulesVersion: RulesVersion): WeaponIndex {
  const rows = legalRowsFor(collections.item ?? [], rulesVersion) as readonly WeaponRow[];

  let index = weaponIndexes.get(rows);
  if (!index) {
    index = { categories: new Map<string, string>(), names: new Map<string, string>() };
    for (const row of rows) {
      if (!row.weaponCategory) continue;
      const id = foundryWeaponId(row.name);
      if (!index.categories.has(id)) index.categories.set(id, row.weaponCategory);
      if (!index.names.has(id)) index.names.set(id, row.name);
    }
    weaponIndexes.set(rows, index);
  }
  return index;
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
  species?: SpeciesGrant | null,
  feats?: ReadonlyArray<FeatGrant> | null,
): GearProficiencies {
  const resolved: ResolvedClassProficiencies = classProficienciesFor(
    classes,
    rulesVersion === "2024" ? "5e-2024" : "5e-2014",
  );
  const { names, categories } = weaponIndexFor(rulesVersion);
  const clauseWeaponIds: string[] = [];

  const grantedBy: Record<string, string[]> = { ...resolved.grantedBy };
  const credit = (value: string, granter: string) => {
    const seen = grantedBy[value];
    if (!seen) grantedBy[value] = [granter];
    else if (!seen.includes(granter)) seen.push(granter);
  };

  const armorIds: string[] = [...resolved.armor];
  const categoryIds: string[] = [...resolved.weaponCategories];
  const weaponItemIds = [...resolved.weaponItems];
  const clauses = [...resolved.weaponClauses];
  const speciesWeaponIds: string[] = [];

  /*
   * Feats before the species, because a feat can widen a category and the
   * species check below asks whether a category already covers a named weapon.
   * A dwarf who took Martial Weapon Training does not need the battleaxe
   * listed twice.
   */
  for (const feat of feats ?? []) {
    for (const value of feat.armor) {
      const id = ARMOR_KEY[value];
      if (!id) continue;
      if (!armorIds.includes(id)) armorIds.push(id);
      credit(id, feat.id);
    }

    for (const value of feat.weaponCategories) {
      const id = WEAPON_CATEGORY_KEY[value];
      if (!id) continue;
      if (!categoryIds.includes(id)) categoryIds.push(id);
      credit(id, feat.id);
    }

    for (const clause of feat.weaponClauses) {
      if (!clauses.includes(clause)) clauses.push(clause);
      credit(clause, feat.id);
    }
  }

  if (species) {
    for (const value of species.armor) {
      const id = ARMOR_KEY[value];
      if (!id) continue;
      if (!armorIds.includes(id)) armorIds.push(id);
      credit(id, species.id);
    }

    for (const name of species.weaponItems) {
      const id = foundryWeaponId(name);
      // Only what dnd5e has a base item for; anything else is a name Foundry
      // would check against nothing.
      if (!FOUNDRY_WEAPON_IDS.has(id)) continue;
      // A class that already grants the whole category covers it. A dwarf
      // fighter does not need the battleaxe named; a dwarf wizard does.
      const category = categories.get(id);
      const covered =
        (category === "simple" && categoryIds.includes("sim")) ||
        (category === "martial" && categoryIds.includes("mar"));
      if (!speciesWeaponIds.includes(id)) speciesWeaponIds.push(id);
      if (covered) continue;
      if (!weaponItemIds.includes(id)) weaponItemIds.push(id);
      credit(id, species.id);
    }

    for (const clause of species.weaponClauses) {
      if (!clauses.includes(clause)) clauses.push(clause);
      credit(clause, species.id);
    }
  }

  const line = (id: string, label: string): ProficiencyLine => ({
    id,
    label,
    from: grantedBy[id] ?? [],
  });

  const weapons: ProficiencyLine[] = [
    ...categoryIds.map((id) => line(id, CATEGORY_LABEL[id] ?? id)),
    ...weaponItemIds.map((id) => line(id, names.get(id) ?? id)),
  ];

  for (const clause of clauses) {
    const ids = weaponsMatchingClause(clause, rulesVersion);
    for (const id of ids) if (!clauseWeaponIds.includes(id)) clauseWeaponIds.push(id);

    weapons.push({
      id: clause,
      label: clauseLabel(clause),
      from: grantedBy[clause] ?? [],
      // The rule is the proficiency; the list is what it comes to. Both are
      // shown because the player needs the first to argue with a DM and the
      // second to buy a weapon.
      ...(ids.length ? { detail: ids.map((id) => names.get(id) ?? id).join(", ") } : {}),
    });
  }

  return {
    armor: armorIds.map((id) => line(id, ARMOR_LABEL[id] ?? id)),
    weapons,
    clauseWeaponIds,
    // Kept even when a class category already covers them: the sheet has no
    // need to repeat the battleaxe to a dwarf fighter, but Foundry writes the
    // set from ids and a redundant one costs nothing there.
    speciesWeaponIds,
    foundryWeaponIds: Array.from(
      new Set([
        ...categoryIds,
        ...weaponItemIds,
        ...clauseWeaponIds,
        ...speciesWeaponIds,
      ]),
    ),
    foundryArmorIds: armorIds,
  };
}
