/**
 * Options drawn from the bundled 5etools index.
 *
 * The hand-written catalog in `data-engine` knows the rules — which skills a
 * class picks from, what a background grants, how armour computes AC — but it
 * only ever listed a fraction of the entities: 24 races against 160, 27
 * backgrounds against 161, 7 feats against 276. What a player can *choose* now
 * comes from the index; what the rules *do* with the choice still comes from
 * the catalog.
 */

import {
  collections,
  forRulesVersion,
  normalizeForSearch,
  searchByName,
  type BackgroundRow,
  type ClassRow,
  type FeatChoice,
  type IndexRow,
  type ItemRow,
  type RaceRow,
  type SkillChoice,
  type SpellRow,
  type SubclassRow,
  type SubraceRow,
} from "@bertinis-vault/vetools-index";
import type { LevellingClass } from "@bertinis-vault/domain";
import type { RulesVersion } from "@bertinis-vault/vetools-ref";

export type IndexOption = {
  /** The slug a build stores. Matches how `RefResolver` looks names up. */
  id: string;
  label: string;
  source: string;
  /** True when the same name exists in another book of this ruleset. */
  shared: boolean;
};

/** The slug for a name, in the shape the rest of the builder writes ids. */
export function slugOf(name: string): string {
  return normalizeForSearch(name)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Item types that count as a weapon in the index's own vocabulary. */
const weaponTypes = new Set(["M", "R"]);

function isWeapon(row: ItemRow): boolean {
  return row.type ? weaponTypes.has(row.type.split("|")[0] ?? "") : false;
}

function toOptions(rows: IndexRow[]): IndexOption[] {
  const nameCounts = new Map<string, number>();
  for (const row of rows) nameCounts.set(row.name, (nameCounts.get(row.name) ?? 0) + 1);

  return rows.map((row) => ({
    id: slugOf(row.name),
    label: row.name,
    source: row.source,
    shared: (nameCounts.get(row.name) ?? 0) > 1,
  }));
}

export type OptionQuery = {
  prop: "race" | "background" | "feat" | "item" | "subclass" | "subrace" | "class";
  rulesVersion: RulesVersion;
  search: string;
  limit?: number | undefined;
  /** Narrow items to the weapons, which is all the weapon picker wants. */
  weaponsOnly?: boolean | undefined;
  /** Narrow items to armour and shields, which carry an armour class. */
  armorOnly?: boolean | undefined;
  /** Narrow subclasses or subraces to the class or species that owns them. */
  parentName?: string | undefined;
};

/**
 * The options matching a search, legal for the ruleset.
 *
 * Capped, because 1773 rows is not a list anyone reads. The search ranks names
 * that start with the query above names that merely contain it, so typing
 * "long" surfaces Longsword before Hooked Longsword.
 */
export function optionsFor({
  prop,
  rulesVersion,
  search,
  limit = 40,
  weaponsOnly,
  armorOnly,
  parentName,
}: OptionQuery): IndexOption[] {
  const all = collections[prop] ?? [];
  const legal = forRulesVersion(all, rulesVersion);

  let scoped = legal;
  if (weaponsOnly) scoped = scoped.filter((row) => isWeapon(row as ItemRow));
  if (armorOnly) scoped = scoped.filter((row) => isArmor(row as ItemRow));
  if (parentName) scoped = scoped.filter((row) => parentOf(row) === parentName);

  return toOptions(searchByName(scoped, search, limit));
}

/** The class a subclass belongs to, or the species a subrace belongs to. */
function parentOf(row: IndexRow): string | null {
  const asSubclass = row as SubclassRow;
  if (asSubclass.className) return asSubclass.className;

  const asSubrace = row as SubraceRow;
  return asSubrace.raceName ?? null;
}

/** Armour and shields, the item types that carry an armour class. */
const armorTypes = new Set(["HA", "MA", "LA", "S"]);

function isArmor(row: ItemRow): boolean {
  return row.type ? armorTypes.has(row.type.split("|")[0] ?? "") : false;
}

/** The option a stored id and book refer to, so a saved draft can show a label. */
export function optionById(
  prop: OptionQuery["prop"],
  rulesVersion: RulesVersion,
  id: string,
  sourceBook?: string,
): IndexOption | null {
  const legal = forRulesVersion(collections[prop] ?? [], rulesVersion);
  const matches = legal.filter((row) => slugOf(row.name) === id);
  if (matches.length === 0) return null;

  const picked = (sourceBook && matches.find((row) => row.source === sourceBook)) || matches[0];
  if (!picked) return null;

  return {
    id,
    label: picked.name,
    source: picked.source,
    shared: matches.length > 1,
  };
}

/** 5etools stores schools as single letters. */
const schoolNames: Record<string, string> = {
  A: "Abjuracion",
  C: "Conjuracion",
  D: "Adivinacion",
  E: "Encantamiento",
  V: "Evocacion",
  I: "Ilusion",
  N: "Nigromancia",
  T: "Transmutacion",
  P: "Psionica",
};

const componentNames: Record<string, string> = {
  v: "verbal",
  s: "somatico",
  m: "material",
};

export type IndexSpellInfo = {
  label: string;
  source: string;
  level: number;
  school: string;
  castingTimeLabel: string;
  rangeLabel: string;
  componentsLabel: string;
  concentration: boolean;
  ritual: boolean;
};

/**
 * What the index knows about a spell.
 *
 * Everything here is bundled, so the panel fills in with no server. What it
 * cannot give is the spell's text: the index deliberately carries only what a
 * picker needs to list and filter, and the full text of every spell is roughly
 * twenty times its size. The range is the shape of the area rather than a
 * distance, because that is all the generator recorded.
 */
export function spellInfoFor(name: string, rulesVersion: RulesVersion, sourceBook?: string): IndexSpellInfo | null {
  const legal = forRulesVersion(collections.spell ?? [], rulesVersion) as SpellRow[];
  const key = slugOf(name);
  const matches = legal.filter((row) => slugOf(row.name) === key);
  const row = (sourceBook && matches.find((entry) => entry.source === sourceBook)) || matches[0];
  if (!row) return null;

  const components = [...row.components]
    .map((letter) => componentNames[letter])
    .filter(Boolean)
    .join(", ");

  return {
    label: row.name,
    source: row.source,
    level: row.level,
    school: schoolNames[row.school] ?? row.school,
    castingTimeLabel: row.time ?? "",
    rangeLabel: row.range ?? "",
    componentsLabel: components,
    concentration: Boolean(row.concentration),
    ritual: Boolean(row.ritual),
  };
}

/**
 * The species bonus the index records.
 *
 * Null means the species leaves the bonus to the player — which Monsters of
 * the Multiverse did to nearly everything it reprinted, and which 2024 did to
 * every species by moving the bonus to the background. A null is an answer,
 * not a gap: it says "ask".
 */
export function speciesBonusFromIndex(
  raceId: string,
  rulesVersion: RulesVersion,
  sourceBook?: string,
): Record<string, number> | null {
  const legal = forRulesVersion(collections.race ?? [], rulesVersion) as RaceRow[];
  const matches = legal.filter((row) => slugOf(row.name) === raceId);
  const row = (sourceBook && matches.find((entry) => entry.source === sourceBook)) || matches[0];

  return row?.ability ?? null;
}

/** The spells one class can cast, for the ruleset, at or below a level. */
export function spellOptionsForClass(
  className: string,
  classSource: string,
  rulesVersion: RulesVersion,
  maxLevel: number,
): SpellRow[] {
  const legal = forRulesVersion(collections.spell ?? [], rulesVersion) as SpellRow[];
  const key = `${className}|${classSource}`;

  return legal
    .filter((row) => row.level <= maxLevel && row.classes.includes(key))
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
}

/** What the index knows about an item: enough to show a weapon or armour. */
export function itemInfoFor(
  id: string,
  rulesVersion: RulesVersion,
  sourceBook?: string,
): ItemRow | null {
  const legal = forRulesVersion(collections.item ?? [], rulesVersion) as ItemRow[];
  const matches = legal.filter((row) => slugOf(row.name) === id);

  return (sourceBook && matches.find((entry) => entry.source === sourceBook)) || matches[0] || null;
}

/** The class row for a class id, which carries its saves and hit die. */
export function classInfoFor(classId: string, rulesVersion: RulesVersion): ClassRow | null {
  const legal = forRulesVersion(collections.class ?? [], rulesVersion) as ClassRow[];
  return legal.find((row) => slugOf(row.name) === classId) ?? null;
}

/**
 * When this class asks its questions, in the shape the rules layer wants.
 *
 * A class the index does not know falls back to the common case rather than to
 * nothing: a build in progress should not lose its improvements because the
 * class field is momentarily empty.
 */
export function levellingFor(classId: string, rulesVersion: RulesVersion): LevellingClass {
  const row = classInfoFor(classId, rulesVersion);
  if (!row) return { improvementLevels: [4, 8, 12, 16, 19], subclassLevel: 3 };

  return { improvementLevels: row.improvementLevels, subclassLevel: row.subclassLevel };
}

/**
 * How a piece of armour computes armour class, in the rules layer's notation.
 *
 * Light adds the whole Dexterity modifier, medium caps it at two, heavy adds
 * none. A shield is not a formula: it stacks its bonus on whatever the armour
 * produced.
 */
export function armorFormulaOf(row: ItemRow): { formula?: string; shield?: boolean } {
  const type = row.type?.split("|")[0] ?? "";
  if (type === "S") return { shield: true };
  if (row.ac == null) return {};

  if (type === "LA") return { formula: `${row.ac}+DEX` };
  if (type === "MA") return { formula: `${row.ac}+DEX2` };
  if (type === "HA") return { formula: `${row.ac}` };

  return {};
}

/** The background row for an id, picking the given book when the name is shared. */
function backgroundRowFor(
  backgroundId: string,
  rulesVersion: RulesVersion,
  sourceBook?: string,
): BackgroundRow | null {
  const legal = forRulesVersion(collections.background ?? [], rulesVersion) as BackgroundRow[];
  const matches = legal.filter((row) => slugOf(row.name) === backgroundId);
  return (sourceBook && matches.find((entry) => entry.source === sourceBook)) || matches[0] || null;
}

/**
 * The feat a background grants, if it grants one.
 *
 * The hand-written catalog knew this for 13 backgrounds out of the 27 it
 * listed, against 161 in the index and 74 that grant a feat. Every 2024
 * background grants an origin feat and none of them were in the catalog, so a
 * 2024 character exported without the feat their background gives them.
 */
export function featChoiceForBackground(
  backgroundId: string,
  rulesVersion: RulesVersion,
  sourceBook?: string,
): FeatChoice | null {
  return backgroundRowFor(backgroundId, rulesVersion, sourceBook)?.featChoice ?? null;
}

/** The label a feat option shows, with the sub-choice the background made. */
export function featOptionLabel(option: { name: string; qualifier?: string }): string {
  return option.qualifier ? `${option.name} (${option.qualifier})` : option.name;
}

/**
 * The skills and tools a background grants, fixed and chosen.
 *
 * The hand-written catalog knew 13 backgrounds out of 161, mixed skills and
 * tools into one flat list, and was wrong about four of the 13 — the tools
 * were listed as skills, and two backgrounds carried the wrong edition's
 * grant. This reads the same data the feat choice above does.
 */
export function proficiencyGrantForBackground(
  backgroundId: string,
  rulesVersion: RulesVersion,
  sourceBook?: string,
): { skillsGranted: string[]; skillChoice: SkillChoice | null; toolsGranted: string[] } {
  const row = backgroundRowFor(backgroundId, rulesVersion, sourceBook);
  return {
    skillsGranted: row?.skillsGranted ?? [],
    skillChoice: row?.skillChoice ?? null,
    toolsGranted: row?.toolsGranted ?? [],
  };
}

/** The skills a class picks from at level 1, if it offers a choice. */
export function skillChoiceForClass(classId: string, rulesVersion: RulesVersion): SkillChoice | null {
  return classInfoFor(classId, rulesVersion)?.skillChoice ?? null;
}
