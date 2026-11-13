/**
 * 5etools sources and the 2014 / 2024 split.
 *
 * A character is built against one ruleset, chosen by the player. Which
 * entities they may pick follows from that choice, because most content exists
 * twice — once in the 2014 books and once in the 2024 revision — under
 * different sources and therefore different hashes.
 */

import { SOURCES, type SourceMeta } from "./sources.generated.js";

export { SOURCES };
export type { SourceMeta };

/** The two rulesets a build can target. */
export type RulesVersion = "2014" | "2024";

/** The 2024 Player's Handbook. Its release date is the edition boundary. */
export const SRC_XPHB = "XPHB";

/**
 * The date 5etools uses to divide the editions.
 *
 * `SourceUtil.isClassicSource` compares each source's release date against the
 * 2024 Player's Handbook rather than consulting a hardcoded list, so sources
 * released after it are automatically treated as 2024 content.
 */
export const EDITION_THRESHOLD = SOURCES[SRC_XPHB]?.date ?? "2024-09-17";

export function getSourceMeta(source: string): SourceMeta | undefined {
  return SOURCES[source];
}

export function isKnownSource(source: string): boolean {
  return source in SOURCES;
}

/**
 * Whether a source belongs to the 2014 ruleset.
 *
 * Mirrors `SourceUtil.isClassicSource`. An unknown or undated source is treated
 * as classic, matching 5etools, where an invalid date compares false against
 * the threshold.
 *
 * Answered once per source. Every filter over the index asks this of every
 * row, and parsing two dates each time was a third of the cost of deriving a
 * character; the table of sources does not change while the program runs.
 */
const classicBySource = new Map<string, boolean>();

export function isClassicSource(source: string): boolean {
  const known = classicBySource.get(source);
  if (known !== undefined) return known;

  const date = SOURCES[source]?.date;
  const classic = date ? new Date(date) < new Date(EDITION_THRESHOLD) : true;
  classicBySource.set(source, classic);
  return classic;
}

/** The ruleset a source belongs to. */
export function rulesVersionOf(source: string): RulesVersion {
  return isClassicSource(source) ? "2014" : "2024";
}

/** The core books of each ruleset: Player's Handbook, Dungeon Master's Guide, Monster Manual. */
export const CORE_SOURCES: Record<RulesVersion, readonly string[]> = {
  "2014": ["PHB", "DMG", "MM"],
  "2024": ["XPHB", "XDMG", "XMM"],
};

/**
 * Which books a table allows besides the edition split.
 *
 * - `edition`: every book of the ruleset, and nothing from the other one.
 * - `core`: the ruleset's core books only; the table said no to supplements.
 * - `all`: every book of the ruleset, and for a 2024 table the older
 *   supplements too (Tasha's, Fizban's, Eberron, Strixhaven...). The 2014 core
 *   books stay out, because the revision replaces them.
 */
export type BookLibrary = "edition" | "core" | "all";

let library: BookLibrary = "edition";

/** Set which books are legal. The builder sets it from the character on the anvil. */
export function setBookLibrary(next: BookLibrary): void {
  library = next;
}

/** The books currently legal. */
export function bookLibrary(): BookLibrary {
  return library;
}

/** Whether a source may be used by a build targeting `rulesVersion`. */
export function isSourceAllowed(source: string, rulesVersion: RulesVersion): boolean {
  if (library === "core") return CORE_SOURCES[rulesVersion].includes(source);
  const edition = rulesVersionOf(source);
  if (edition === rulesVersion) return true;
  return library === "all" && rulesVersion === "2024" && !CORE_SOURCES["2014"].includes(source);
}

/** Every source for a ruleset, sorted by release date, newest first. */
export function sourcesForRulesVersion(rulesVersion: RulesVersion): string[] {
  return Object.keys(SOURCES)
    .filter((source) => rulesVersionOf(source) === rulesVersion)
    .sort((a, b) => (SOURCES[b]?.date ?? "").localeCompare(SOURCES[a]?.date ?? ""));
}

/** Sources listed for a picker: code, title, and release date. */
export function listSources(
  rulesVersion?: RulesVersion,
): Array<{ source: string; full: string; abv: string; date: string | null }> {
  const codes = rulesVersion ? sourcesForRulesVersion(rulesVersion) : Object.keys(SOURCES);
  return codes.map((source) => {
    const meta = SOURCES[source] as SourceMeta;
    return { source, full: meta.full, abv: meta.abv, date: meta.date };
  });
}
