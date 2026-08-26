/**
 * The browsing index the web builder queries.
 *
 * Rows carry only what a picker needs to list, search and filter. Opening a
 * single entity is a separate, lazy concern: the full text of every category
 * is roughly twenty times this size, and the player only ever reads one entry
 * at a time.
 *
 * Rows are data, not references. Call `refOf` to turn a chosen row into the
 * `{page, source, hash}` triple Plutonium imports.
 */

import {
  buildRef,
  buildSubclassRef,
  isSourceAllowed,
  rulesVersionOf,
  type RulesVersion,
  type VetoolsProp,
  type VetoolsRef,
} from "@bertinis-vault/vetools-ref";

/** Fields every indexed row carries. */
export type IndexRow = {
  name: string;
  source: string;
};

export type SpellRow = IndexRow & {
  level: number;
  school: string;
  time: string | null;
  /** A printable distance, e.g. "120 feet", "self", "touch". */
  range: string | null;
  /** Flattened component flags, e.g. "vsm". */
  components: string;
  concentration: 0 | 1;
  ritual: 0 | 1;
  /**
   * The class lists this spell is on, as `"Wizard|PHB"`.
   *
   * A spell belongs to a class list by the class's say-so, not its own, and
   * the class's source keeps the editions apart: Fire Bolt is on both
   * `Wizard|PHB` and `Wizard|XPHB`, which are different documents.
   */
  classes: string[];
};

export type ItemRow = IndexRow & {
  type: string | null;
  rarity: string | null;
  weight: number | null;
  value: number | null;
  attunement: 0 | 1;
  damage: string | null;
  damageType: string | null;
  versatileDamage: string | null;
  /** Property codes, e.g. "V", "F", "2H". */
  properties: string[];
  /** 2024 weapon mastery names, e.g. "Topple". Null for everything else. */
  mastery: string[] | null;
  /** Base armour class, for armour and shields. */
  ac: number | null;
  /** Minimum Strength the armour asks for, as a string of digits. */
  strength: string | null;
  stealthDisadvantage: 0 | 1;
};

export type AbilityBonuses = Record<string, number>;

export type RaceRow = IndexRow & {
  size: string | null;
  /** The fixed part of the species bonus. Null when the player chooses it. */
  ability: AbilityBonuses | null;
  speed: number | null;
  /** Natural armour: a tortle shell, lizardfolk scales, a loxodon hide. */
  armorClass: ArmorClassOption[];
};

export type SubraceRow = IndexRow & {
  raceName: string;
  raceSource: string;
  ability: AbilityBonuses | null;
};

/**
 * The ability increase a feat carries.
 *
 * A fixed grant names the ability outright. A choice offers a pool: `count`
 * different abilities from `from`, each raised by `amount`. Both default to
 * one, which covers the ordinary half-feat — "+1 to Intelligence, Wisdom or
 * Charisma".
 */
export type FeatAbilityGrant =
  | { kind: "fixed"; bonuses: AbilityBonuses }
  | { kind: "choice"; from: string[]; amount: number; count: number };

export type FeatRow = IndexRow & {
  /**
   * What taking this feat raises. Empty for the 116 that raise nothing.
   *
   * This is half of why a half-feat is worth taking: on an odd score it buys
   * the effect *and* the modifier point a plain improvement would have bought.
   * Nothing recorded it until now, so it was being lost in silence.
   */
  ability: FeatAbilityGrant[];
  /**
   * Whether this feat *is* the ability score improvement.
   *
   * 2024 folded the improvement into the feat list, so "raise two scores" and
   * "take a feat" stopped being alternatives — the former is a feat named
   * "Ability Score Improvement". Its own increase is not a half-feat's bonus
   * and is not in `ability`, because asking for it would ask the same question
   * twice.
   */
  isAbilityScoreImprovement: 0 | 1;
  /**
   * Proficiencies this feat doubles. Empty for all but seven.
   *
   * Skill Expert is the one worth naming: it grants a skill proficiency and
   * expertise in a skill you are proficient in, and the skill it just granted
   * counts, so the two halves are read in order.
   */
  expertise: ExpertiseSet[];
};

/** One feat a background offers, already scoped to the book it comes from. */
export type FeatOption = {
  name: string;
  source: string;
  /**
   * A sub-choice the background already made, e.g. Magic Initiate's spell
   * list. Part of the label, not of the reference.
   */
  qualifier?: string;
};

/**
 * The feat a background grants, as a single choice.
 *
 * One option is a feat the background simply gives. Several are alternatives —
 * Ruined offers Alert, Skilled or Tough. `isOpen` means the background also
 * allows a feat it does not name, so the whole feat list is fair game.
 */
export type FeatChoice = {
  options: FeatOption[];
  isOpen?: boolean;
};

/**
 * A bounded skill pick: choose `count` from `options`.
 *
 * `isOpen` means the source names no shortlist — "any 3 skills" — in which
 * case `options` is already every skill rather than an empty list a caller
 * would have to special-case. It is kept only so the UI can say "any skill"
 * instead of naming all eighteen.
 */
export type SkillChoice = {
  options: string[];
  count: number;
  isOpen?: boolean;
};

export type BackgroundRow = IndexRow & {
  /** Null for the 2014 backgrounds, none of which grant a feat. */
  featChoice: FeatChoice | null;
  /** Skills the background grants outright, with no choice involved. */
  skillsGranted: string[];
  /**
   * A bounded skill choice stacked on top of `skillsGranted`, if the
   * background offers one (a handful of SCAG backgrounds grant one skill
   * outright and a choice of a second).
   */
  skillChoice: SkillChoice | null;
  /**
   * Tools the background grants outright.
   *
   * Category-scoped grants ("any gaming set", "any musical instrument") are
   * not included: they are already a player choice with no single name to
   * pre-fill, and the free-text proficiency field takes whatever is typed.
   */
  toolsGranted: string[];
};

/**
 * A choice a class makes the player answer as it levels.
 *
 * Fighting styles, eldritch invocations, metamagic, maneuvers, runes, arcane
 * shots, elemental disciplines, artificer infusions and the pact boon are all
 * this shape: a pool named by `featureType`, and a count that grows with level.
 *
 * It comes from the class's own `optionalfeatureProgression`, which is why the
 * editions need no rule to keep apart — the 2024 sorcerer's metamagic
 * progression differs from the 2014 one, and the 2024 paladin has no fighting
 * style because fighting styles became feats, which appears here as the entry
 * simply not existing.
 */
export type OptionalFeatureProgression = {
  /** What the class calls it, e.g. "Eldritch Invocations". */
  name: string;
  /** The pools it draws from, e.g. `["EI"]`. */
  featureType: string[];
  /**
   * How many are known at each level, from 1 to 20, as a running total.
   *
   * 5etools states this as a sparse object for most classes and a dense array
   * for the warlock and the artificer. Both arrive here as the same 20 numbers.
   */
  countByLevel: number[];
};

/**
 * One way of taking an expertise grant.
 *
 * A grant offers a list of these as *alternatives*: the 2014 rogue's is "two
 * skills" or "one skill and thieves' tools", and the wizard's Scholar is six
 * sets of one fixed skill, which is how the data says "pick one of six".
 *
 * `anySkill` and `anyTool` draw from what the character is *already*
 * proficient in — expertise doubles a proficiency, it does not grant one — so
 * the pool cannot be listed here and depends on the build.
 */
export type ExpertiseSet = {
  /** How many already-proficient skills this set lets you double. */
  anySkill: number;
  /** How many already-proficient tools this set lets you double. */
  anyTool: number;
  /** Skills this set doubles outright, by canonical name. */
  skills: string[];
  /** Tools this set doubles outright, by name. */
  tools: string[];
};

/**
 * A way of computing armour class that replaces the default 10 + Dexterity.
 *
 * Unarmored Defense, draconic scales, a tortle's shell. Read from the feature
 * text, because for the barbarian, the monk and the 2024 dancing bard there is
 * nowhere else: 5etools' Foundry companion file records an `ac.calc` override
 * for the sorcerer and six species and nothing for those three, which rely on
 * the game system's own SRD class items.
 */
export type ArmorClassOption = {
  name: string;
  source: string;
  level: number;
  isVariant: boolean;
  /** 10 for Unarmored Defense, 13 for draconic scales, 17 for a shell. */
  base: number;
  /** What is added on top, in the order the feature names them. */
  abilities: string[];
  /** A monk loses this while holding a shield; a barbarian does not. */
  allowsShield: boolean;
  requiresNoArmor: boolean;
  /** What `dnd5e` calls the calculation, when it has a name for it. */
  calc: string | null;
};

/** An expertise grant, and the feature that hands it out. */
export type ExpertiseGrant = {
  name: string;
  source: string;
  level: number;
  /**
   * Whether the feature is an optional replacement rather than a given.
   *
   * Deft Explorer is Tasha's replacement for the 2014 ranger's Natural
   * Explorer. A ranger who did not take the option does not get its expertise,
   * so a builder that applied every grant would hand out a doubled skill the
   * character never chose.
   */
  isVariant: boolean;
  /** The alternatives on offer. One set with no `any` is not a choice at all. */
  sets: ExpertiseSet[];
};

/** What a second class hands over, which is less than a first one does. */
export type MulticlassGrants = {
  /** "light", "medium", "shield". */
  armor: string[];
  /** "simple", "martial", or a named weapon — the 2014 monk gets shortswords. */
  weapons: string[];
  /** One skill from a shortlist, for the four classes that offer one. */
  skillChoice: SkillChoice | null;
  /** Tools granted outright, by name. */
  tools: string[];
  /** A category to choose a tool from, e.g. "Musical Instrument". */
  toolChoice: string | null;
};

/** A prerequisite that can be checked against a build rather than read. */
export type OptionalFeaturePrerequisite =
  | { kind: "level"; level: number; className: string | null; classSource: string | null }
  | { kind: "pact"; pact: string }
  /** A spell that must already be known, e.g. `"eldritch blast#c"`. */
  | { kind: "spell"; spell: string }
  /** Another optional feature that must already be taken. */
  | { kind: "optionalfeature"; name: string; source: string | null };

export type OptionalFeatureRow = IndexRow & {
  /** The pools this belongs to. A class offering that pool can pick it. */
  featureType: string[];
  prerequisites: OptionalFeaturePrerequisite[];
  /**
   * The prerequisites that are prose rather than data.
   *
   * 5etools writes two kinds for a person rather than a machine — a required
   * item ("A suit of armor (requires attunement)") and an `otherSummary`
   * ("Dragonmarked House Renown 25+"). Checking them would mean guessing, so
   * they are shown and the player judges.
   */
  prerequisiteText: string[];
};

export type ClassRow = IndexRow & {
  hitDie: number | null;
  /** The two abilities the class grants saving throw proficiency in. */
  savingThrows: string[];
  spellcastingAbility: string | null;
  casterProgression: string | null;
  preparedSpells: string | null;
  /**
   * The levels this class grants an ability score improvement at.
   *
   * Read from the class's own feature list rather than assumed, because the
   * common [4, 8, 12, 16, 19] is wrong for three of the classes in every
   * edition: the fighter also improves at 6 and 14, the rogue at 10, and 2024
   * dropped the level 19 improvement in favour of an epic boon.
   */
  improvementLevels: number[];
  /**
   * The level this class chooses a subclass at.
   *
   * 2014 ranges from 1 (cleric, sorcerer, warlock) through 2 (druid, wizard)
   * to 3; 2024 moved every class to 3.
   */
  subclassLevel: number | null;
  /** The skills this class picks from at level 1. Null for the handful with none. */
  skillChoice: SkillChoice | null;
  /** The choices this class makes the player answer as it levels. */
  optionalFeatureProgression: OptionalFeatureProgression[];
  /**
   * The expertise this class grants, by level.
   *
   * Read from 5etools' Foundry companion data rather than the class text,
   * where it is only prose. Empty for every class but the bard, the rogue, the
   * ranger, the 2024 wizard and Tasha's expert sidekick.
   */
  expertise: ExpertiseGrant[];
  /** Unarmored Defense, for the two classes that have it in every edition. */
  armorClass: ArmorClassOption[];
  /**
   * The scores a character needs before taking a level in this class.
   *
   * A list of alternatives: `[{str: 13}, {dex: 13}]` is "Strength or
   * Dexterity", `[{dex: 13, wis: 13}]` is "Dexterity and Wisdom". The two
   * editions state it in different fields and reach the same answer.
   */
  multiclassRequirements: Record<string, number>[];
  /**
   * What taking a level in this class grants someone who already has one.
   *
   * Not the same list as its starting proficiencies. A rogue's first level
   * gives four skills and thieves' tools; a rogue level taken second gives one
   * skill and thieves' tools. Null for the classes that state no block.
   */
  multiclassGrants: MulticlassGrants | null;
};

export type SubclassRow = IndexRow & {
  shortName: string | null;
  className: string | null;
  classSource: string | null;
  /** Choices the subclass grants on top of its class's. */
  optionalFeatureProgression: OptionalFeatureProgression[];
  /**
   * How the subclass advances spellcasting, when the class does not.
   *
   * The eldritch knight and the arcane trickster are the only two, and they
   * are the reason this cannot be read off the class: a fighter casts nothing
   * and an eldritch knight casts a third.
   */
  casterProgression: string | null;
  spellcastingAbility: string | null;
  /** Expertise the subclass grants on top of its class's. */
  expertise: ExpertiseGrant[];
  /** The draconic sorcerer's scales, and the 2024 dancing bard's defence. */
  armorClass: ArmorClassOption[];
};

/** The props this index covers, and the row type each yields. */
export type IndexedProp =
  | "spell"
  | "item"
  | "feat"
  | "race"
  | "subrace"
  | "background"
  | "class"
  | "subclass"
  | "optionalfeature";

export type RowFor = {
  spell: SpellRow;
  item: ItemRow;
  feat: FeatRow;
  race: RaceRow;
  subrace: SubraceRow;
  background: BackgroundRow;
  class: ClassRow;
  subclass: SubclassRow;
  optionalfeature: OptionalFeatureRow;
};

/**
 * Whether a row carries the class a subclass hangs off.
 *
 * Rows from the index always do; the check exists because callers reach this
 * through the widened `IndexRow`, where the fields are not visible.
 */
export function isSubclassRow(row: IndexRow): row is IndexRow & SubclassRow {
  const candidate = row as Partial<SubclassRow>;
  return typeof candidate.className === "string" && typeof candidate.classSource === "string";
}

/**
 * The reference for a row, ready to hand to Plutonium.
 *
 * A subclass hashes as state on its class's page rather than as an entity of
 * its own, so it takes a different builder. A subclass row missing its class
 * would hash to something Plutonium cannot resolve, so it fails rather than
 * falling through to the generic builder.
 */
export function refOf<P extends IndexedProp>(prop: P, row: RowFor[P]): VetoolsRef {
  if (prop === "subclass") {
    if (!isSubclassRow(row)) {
      throw new Error(`Subclass "${row.name}" has no class, so it cannot be referenced.`);
    }
    return buildSubclassRef({
      name: row.name,
      source: row.source,
      className: row.className as string,
      classSource: row.classSource as string,
      shortName: row.shortName ?? undefined,
    });
  }

  return buildRef(prop as VetoolsProp, row.name, row.source);
}

/** The ruleset a row belongs to, derived from its source. */
export function rulesVersionOfRow(row: IndexRow): RulesVersion {
  return rulesVersionOf(row.source);
}

/**
 * Keep only the rows legal for a build's ruleset.
 *
 * This is the filter that stops a 2014 character being offered 2024 content,
 * which would import as a different document than the player expects.
 */
export function forRulesVersion<T extends IndexRow>(rows: T[], rulesVersion: RulesVersion): T[] {
  return rows.filter((row) => isSourceAllowed(row.source, rulesVersion));
}

/** Normalise a name for searching: casefolded and stripped of accents. */
export function normalizeForSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Search rows by name.
 *
 * Rows whose name starts with the query rank above rows that merely contain
 * it, so typing "fire" surfaces Fire Bolt before Wall of Fire.
 */
export function searchByName<T extends IndexRow>(rows: T[], query: string, limit = 50): T[] {
  const needle = normalizeForSearch(query.trim());
  if (!needle) return rows.slice(0, limit);

  const prefix: T[] = [];
  const contains: T[] = [];

  for (const row of rows) {
    const name = normalizeForSearch(row.name);
    if (name.startsWith(needle)) prefix.push(row);
    else if (name.includes(needle)) contains.push(row);
    if (prefix.length >= limit) break;
  }

  return [...prefix, ...contains].slice(0, limit);
}

export type SpellFilter = {
  levels?: number[];
  schools?: string[];
  concentration?: boolean;
  ritual?: boolean;
};

/** Filter spells by the axes a picker exposes. Omitted axes do not constrain. */
export function filterSpells(rows: SpellRow[], filter: SpellFilter): SpellRow[] {
  return rows.filter((row) => {
    if (filter.levels?.length && !filter.levels.includes(row.level)) return false;
    if (filter.schools?.length && !filter.schools.includes(row.school)) return false;
    if (filter.concentration != null && Boolean(row.concentration) !== filter.concentration) return false;
    if (filter.ritual != null && Boolean(row.ritual) !== filter.ritual) return false;
    return true;
  });
}

/**
 * Group rows by name so a picker can show one entry per spell with its
 * available sources, instead of listing "Fire Bolt" once per book.
 */
export function groupByName<T extends IndexRow>(rows: T[]): Array<{ name: string; variants: T[] }> {
  const byName = new Map<string, T[]>();

  for (const row of rows) {
    const existing = byName.get(row.name);
    if (existing) existing.push(row);
    else byName.set(row.name, [row]);
  }

  return [...byName.entries()].map(([name, variants]) => ({ name, variants }));
}

export * from "./resolve.js";
export * from "./to-payload.js";
export * from "./data.js";
