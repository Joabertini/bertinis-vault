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
  type IndexRow,
  type ItemRow,
  type SpellRow,
} from "@bertinis-vault/vetools-index";
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
  prop: "race" | "background" | "feat" | "item";
  rulesVersion: RulesVersion;
  search: string;
  limit?: number | undefined;
  /** Narrow items to the weapons, which is all the weapon picker wants. */
  weaponsOnly?: boolean | undefined;
};

/**
 * The options matching a search, legal for the ruleset.
 *
 * Capped, because 1773 rows is not a list anyone reads. The search ranks names
 * that start with the query above names that merely contain it, so typing
 * "long" surfaces Longsword before Hooked Longsword.
 */
export function optionsFor({ prop, rulesVersion, search, limit = 40, weaponsOnly }: OptionQuery): IndexOption[] {
  const all = collections[prop] ?? [];
  const legal = forRulesVersion(all, rulesVersion);
  const scoped = weaponsOnly ? legal.filter((row) => isWeapon(row as ItemRow)) : legal;

  return toOptions(searchByName(scoped, search, limit));
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
