/**
 * What the Forge's chambers show.
 *
 * The index holds 160 species and 31 classes across 32 books. That is a search
 * result, not a wall of cards. So each chamber splits the catalog in two: the
 * handful the edition's own Player's Handbook prints, which get sigil cards,
 * and everything else, which stays behind a search.
 *
 * The split is by book, not by a hand-kept list of favourites — asking which
 * rows came from PHB or XPHB is a question the index already answers, so it
 * cannot drift as books are added.
 */

import {
  collections,
  forRulesVersion,
  searchByName,
  type ClassRow,
  type IndexRow,
  type SubclassRow,
} from "@bertinis-vault/vetools-index";
import type { RulesVersion } from "@bertinis-vault/vetools-ref";

import { slugOf } from "./index-options";

/** The book each edition's core options come from. */
const coreBook: Record<RulesVersion, string> = {
  "2014": "PHB",
  "2024": "XPHB",
};

export type CatalogEntry = {
  /** The slug a build stores. */
  id: string;
  label: string;
  /** The book it came from, which a build records so a shared name resolves. */
  source: string;
  /** True when this name also exists in another book legal for the edition. */
  shared: boolean;
};

function toEntries(rows: IndexRow[]): CatalogEntry[] {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.name, (counts.get(row.name) ?? 0) + 1);

  return rows.map((row) => ({
    id: slugOf(row.name),
    label: row.name,
    source: row.source,
    shared: (counts.get(row.name) ?? 0) > 1,
  }));
}

/**
 * The options the edition's core book prints, in print order.
 *
 * These are the cards. Nine for 2014, ten for 2024, twelve classes either way
 * — small enough to look at, which is the whole point of showing them as art
 * rather than as a list.
 */
export function coreOptions(
  prop: "race" | "class",
  rulesVersion: RulesVersion,
): CatalogEntry[] {
  const legal = forRulesVersion(collections[prop] ?? [], rulesVersion);
  const core = legal.filter((row) => row.source === coreBook[rulesVersion]);

  return toEntries(core).sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Every option the edition allows, in one list.
 *
 * Splitting a catalog into "the nine on cards" and "the other hundred and
 * fifty behind a search box" makes the second set feel like an appendix, and
 * a player who does not already know the core book cannot tell which half
 * their species is in. One list, with the core book first because that is
 * still where most tables start.
 *
 * Sorted so the shelf can filter it without re-sorting on every keystroke.
 */
export function allOptions(
  prop: "race" | "class" | "background",
  rulesVersion: RulesVersion,
): CatalogEntry[] {
  const legal = forRulesVersion(collections[prop] ?? [], rulesVersion);
  const core = coreBook[rulesVersion];

  return toEntries(legal).sort((a, b) => {
    if ((a.source === core) !== (b.source === core)) return a.source === core ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
}

/**
 * Everything else the edition allows, searched.
 *
 * Excludes the core book, because those are already on screen as cards and
 * listing them twice makes the search look broken.
 */
export function searchBeyondCore(
  prop: "race" | "class" | "background",
  rulesVersion: RulesVersion,
  query: string,
  limit = 24,
): CatalogEntry[] {
  const legal = forRulesVersion(collections[prop] ?? [], rulesVersion);
  const beyond =
    prop === "background" ? legal : legal.filter((row) => row.source !== coreBook[rulesVersion]);

  return toEntries(searchByName(beyond, query, limit));
}

/** Every option the edition allows, searched — used where there are no cards. */
export function searchAll(
  prop: "race" | "class" | "background" | "subclass" | "subrace",
  rulesVersion: RulesVersion,
  query: string,
  limit = 24,
): CatalogEntry[] {
  const legal = forRulesVersion(collections[prop] ?? [], rulesVersion);
  return toEntries(searchByName(legal, query, limit));
}

/**
 * The subraces of one species.
 *
 * Matched on the name shape — "Dwarf (Hill)", "Elf (Drow)" — rather than on
 * the `raceName` field the rows also carry, because the name is what the
 * player reads and what `slugOf` turns into the stored id. The two agree; if
 * they ever stop, the name is the one the rest of this front is keyed to.
 *
 * Those bare rows are dropped. "Dragonborn" listed among Dragonborn's own
 * subraces means "no subrace", which the empty selection already says, and
 * offering it as a choice would let a player pick their species twice.
 *
 * The prefix is matched with the "(" attached so that "Elf" does not swallow
 * "Half-Elf (Variant)" — the two are separate species with separate lists.
 */
export function subracesFor(
  raceLabel: string,
  rulesVersion: RulesVersion,
  query = "",
  limit = 40,
): CatalogEntry[] {
  if (!raceLabel) return [];

  const legal = forRulesVersion(collections.subrace ?? [], rulesVersion);
  const prefix = `${raceLabel} (`;
  const mine = legal.filter((row) => row.name.startsWith(prefix));

  return toEntries(searchByName(mine, query, limit)).map((entry) => ({
    ...entry,
    // Shown inside the species' own section, so the species half of the name
    // is redundant: "Dwarf (Hill)" reads as "Hill".
    label: entry.label.slice(prefix.length).replace(/\)$/, ""),
  }));
}

/**
 * The subclasses of one class.
 *
 * These do carry their parent, so the match is exact rather than by name
 * shape.
 */
export function subclassesFor(
  classLabel: string,
  rulesVersion: RulesVersion,
  query = "",
  limit = 40,
): CatalogEntry[] {
  if (!classLabel) return [];

  const legal = forRulesVersion(collections.subclass ?? [], rulesVersion) as SubclassRow[];
  const mine = legal.filter((row) => row.className === classLabel);

  return toEntries(searchByName(mine, query, limit));
}

/** The entry a stored id refers to, so a saved draft can show its label. */
export function entryById(
  prop: "race" | "class" | "background" | "subclass" | "subrace",
  rulesVersion: RulesVersion,
  id: string,
  sourceBook?: string,
): CatalogEntry | null {
  if (!id) return null;

  const legal = forRulesVersion(collections[prop] ?? [], rulesVersion);
  const matches = legal.filter((row) => slugOf(row.name) === id);
  if (matches.length === 0) return null;

  const picked = (sourceBook && matches.find((row) => row.source === sourceBook)) || matches[0];
  if (!picked) return null;

  return { id, label: picked.name, source: picked.source, shared: matches.length > 1 };
}

/** The hit die a class rolls, for the sheet. */
export function hitDieFor(classId: string, rulesVersion: RulesVersion): number | null {
  const legal = forRulesVersion(collections.class ?? [], rulesVersion) as ClassRow[];
  const row = legal.find((entry) => slugOf(entry.name) === classId);
  return row?.hitDie ?? null;
}
