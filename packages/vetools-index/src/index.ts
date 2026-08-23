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
  range: string | null;
  /** Flattened component flags, e.g. "vsm". */
  components: string;
  concentration: 0 | 1;
  ritual: 0 | 1;
};

export type ItemRow = IndexRow & {
  type: string | null;
  rarity: string | null;
  weight: number | null;
  value: number | null;
  attunement: 0 | 1;
};

export type RaceRow = IndexRow & { size: string | null };
export type FeatRow = IndexRow;
export type BackgroundRow = IndexRow;
export type ClassRow = IndexRow;

/** The props this index covers, and the row type each yields. */
export type IndexedProp = "spell" | "item" | "feat" | "race" | "background" | "class";

export type RowFor = {
  spell: SpellRow;
  item: ItemRow;
  feat: FeatRow;
  race: RaceRow;
  background: BackgroundRow;
  class: ClassRow;
};

/** The reference for a row, ready to hand to Plutonium. */
export function refOf<P extends IndexedProp>(prop: P, row: RowFor[P]): VetoolsRef {
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
