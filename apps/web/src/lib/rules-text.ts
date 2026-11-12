/**
 * The full text of rules entities, fetched when a player first looks at one.
 *
 * `public/rules/<kind>.json` is written by `scripts/build-rules-text.mjs` from the 5etools data
 * Plutonium ships. One file per kind, so looking at a spell fetches spells and nothing else, and
 * everything fetched is kept for the rest of the visit.
 *
 * Entries keep 5etools' own markup — `{@condition incapacitated}` — because those tags are what
 * turn a word in a description into a link to its own description. `tags.ts` reads them.
 */

import type { RuleRef } from "@/lib/rules-markup";
import type { Edition, RulesKind, RulesRecord } from "@bertinis-vault/forge/rules-kinds";

export type { Edition, RulesKind, RulesRecord } from "@bertinis-vault/forge/rules-kinds";

type Table = Record<string, RulesRecord>;

const loaded = new Map<RulesKind, Table>();
const pending = new Map<RulesKind, Promise<Table>>();
const byName = new Map<RulesKind, Map<string, string[]>>();

/** Fetch one kind, once. A failure is not cached, so a dropped connection can be retried. */
export function loadKind(kind: RulesKind): Promise<Table> {
  const have = loaded.get(kind);
  if (have) return Promise.resolve(have);

  const inFlight = pending.get(kind);
  if (inFlight) return inFlight;

  const request = fetch(`/rules/${kind}.json`)
    .then((response) => {
      if (!response.ok) throw new Error(`rules/${kind}.json: ${response.status}`);
      return response.json() as Promise<Table>;
    })
    .then((table) => {
      loaded.set(kind, table);
      const names = new Map<string, string[]>();
      for (const key of Object.keys(table)) {
        const name = key.split("|")[0] ?? key;
        const list = names.get(name);
        if (list) list.push(key);
        else names.set(name, [key]);
      }
      byName.set(kind, names);
      return table;
    })
    .finally(() => pending.delete(kind));

  pending.set(kind, request);
  return request;
}

/**
 * The books a 2014 and a 2024 character read from, best first.
 *
 * 2024 rewrote most rules text and reprinted it under X-prefixed books; a 2014 character wants the
 * Player's Handbook wording. Anything else is a fallback so a supplement-only entity still opens.
 */
const PREFERRED: Record<Edition, string[]> = {
  "2014": ["phb", "dmg", "mm", "xge", "tce", "scag", "vgm", "mtf", "ftd", "ggr", "erlw"],
  "2024": ["xphb", "xdmg", "xmm", "phb", "dmg", "mm", "tce", "xge"],
};

/**
 * Find an entity in a loaded kind.
 *
 * With a book named, that exact entry; otherwise the best book for the edition, and any book at
 * all as a last resort. Names are compared lowercase, which is how the keys were written.
 */
export function findIn(
  kind: RulesKind,
  name: string,
  source: string | undefined,
  edition: Edition,
  extra: string[] = [],
): RulesRecord | null {
  const table = loaded.get(kind);
  if (!table) return null;

  const base = [name, ...extra].join("|").toLowerCase();
  if (source) {
    const exact = table[`${base}|${source.toLowerCase()}`];
    if (exact) return exact;
  }

  const candidates = (byName.get(kind)?.get(name.toLowerCase()) ?? []).filter((key) =>
    key.startsWith(`${base}|`),
  );
  if (candidates.length === 0) return null;

  for (const book of PREFERRED[edition]) {
    const key = candidates.find((candidate) => candidate.endsWith(`|${book}`));
    if (key) return table[key] ?? null;
  }
  const first = candidates[0];
  return first ? (table[first] ?? null) : null;
}

/** A feature is told apart by its class and level, which its name alone does not do. */
function findFeature(ref: RuleRef, edition: Edition): RulesRecord | null {
  const table = loaded.get(ref.kind);
  if (!table) return null;

  const keys = byName.get(ref.kind)?.get(ref.name.toLowerCase()) ?? [];
  const wanted = (value: unknown, expected: string | undefined) =>
    !expected || String(value ?? "").toLowerCase() === expected.toLowerCase();

  const matches = keys
    .map((key) => table[key])
    .filter((record): record is RulesRecord => {
      if (!record) return false;
      if (!wanted(record["className"], ref.className)) return false;
      if (ref.level !== undefined && record["level"] !== ref.level) return false;
      if (ref.kind === "subclassFeature" && !wanted(record["subclassShortName"], ref.subclass)) return false;
      return true;
    });

  if (matches.length === 0) return null;

  // The book the reference names, then the one that belongs to the class's own book, then the edition's.
  const order = [ref.source, ref.classSource, ...PREFERRED[edition]].filter(Boolean) as string[];
  for (const book of order) {
    const hit = matches.find((record) => record.source.toLowerCase() === book.toLowerCase());
    if (hit) return hit;
  }
  return matches[0] ?? null;
}

/** Resolve a link target to its record, fetching the kind first. */
export async function resolve(ref: RuleRef, edition: Edition): Promise<RulesRecord | null> {
  try {
    await loadKind(ref.kind);
  } catch {
    return null;
  }
  if (ref.kind === "classFeature" || ref.kind === "subclassFeature") return findFeature(ref, edition);
  return findIn(ref.kind, ref.name, ref.source, edition, ref.extra ?? []);
}

/** Load a kind and find in it. Null when the text does not exist in any book we hold. */
export async function lookup(
  kind: RulesKind,
  name: string,
  source: string | undefined,
  edition: Edition,
  extra: string[] = [],
): Promise<RulesRecord | null> {
  try {
    await loadKind(kind);
  } catch {
    return null;
  }
  return findIn(kind, name, source, edition, extra);
}

/** Forget everything fetched. For tests. */
export function resetRulesText(): void {
  loaded.clear();
  pending.clear();
  byName.clear();
}

/** Put a table in directly. For tests. */
export function seedRulesText(kind: RulesKind, table: Table): void {
  loaded.set(kind, table);
  const names = new Map<string, string[]>();
  for (const key of Object.keys(table)) {
    const name = key.split("|")[0] ?? key;
    names.set(name, [...(names.get(name) ?? []), key]);
  }
  byName.set(kind, names);
}
