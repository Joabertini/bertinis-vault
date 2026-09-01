/**
 * Resolving a build's picks into 5etools references.
 *
 * The existing `CharacterBuild` identifies everything by slug — `"fire-bolt"`,
 * `"leather-armor"` — with no source. A slug alone cannot become a reference:
 * it does not say which book the entity came from, and most entities exist in
 * both the 2014 and 2024 editions under different sources and different hashes.
 *
 * So resolution is a lookup against the index, scoped to the build's ruleset,
 * and it can fail. It failing loudly is the point: a pick that silently
 * resolves to the wrong edition produces a character that imports cleanly and
 * plays wrong.
 */

import { buildRef, buildSubclassRef, type RulesVersion, type VetoolsProp, type VetoolsRef } from "@bertinis-vault/vetools-ref";

import { forRulesVersion, isSubclassRow, normalizeForSearch, type IndexRow } from "./index.js";

/** Why a pick could not be resolved. */
export type ResolutionFailureReason = "not-found" | "wrong-edition" | "ambiguous";

export type ResolutionFailure = {
  prop: VetoolsProp;
  /** The slug or label that was looked up. */
  query: string;
  reason: ResolutionFailureReason;
  /** Sources the entity does exist under, when that is the problem. */
  availableIn?: string[];
};

export type Resolution<T> =
  | { ok: true; value: T }
  | { ok: false; failure: ResolutionFailure };

/**
 * Match a slug against a row name.
 *
 * Builds store `"fire-bolt"`; the index stores `"Fire Bolt"`. Comparing them
 * casefolded, unaccented and stripped of separators makes the two meet without
 * needing a stored slug on every row.
 */
function slugKey(value: string): string {
  return normalizeForSearch(value).replace(/[^a-z0-9]/g, "");
}

/**
 * Turn a matched row into its reference.
 *
 * A subclass hashes as state on its class's page, so it needs the class it
 * came from as well as itself. Every other prop hashes from name and source
 * alone.
 */
function refForRow(prop: VetoolsProp, row: IndexRow): VetoolsRef {
  if (prop === "subclass" && isSubclassRow(row)) {
    return buildSubclassRef({
      name: row.name,
      source: row.source,
      className: row.className as string,
      classSource: row.classSource as string,
      shortName: row.shortName ?? undefined,
    });
  }

  return buildRef(prop, row.name, row.source);
}

/** An index scoped to one ruleset, keyed for slug lookup. */
export class RefResolver {
  readonly #byProp = new Map<VetoolsProp, Map<string, IndexRow[]>>();

  constructor(
    readonly rulesVersion: RulesVersion,
    collections: Partial<Record<VetoolsProp, IndexRow[]>>,
  ) {
    for (const [prop, rows] of Object.entries(collections)) {
      if (!rows) continue;

      const byKey = new Map<string, IndexRow[]>();
      for (const row of forRulesVersion(rows, rulesVersion)) {
        const key = slugKey(row.name);
        const existing = byKey.get(key);
        if (existing) existing.push(row);
        else byKey.set(key, [row]);
      }

      this.#byProp.set(prop as VetoolsProp, byKey);
    }

    // Rows outside the build's ruleset are kept separately so a pick from the
    // wrong edition can be reported as such rather than as simply missing.
    this.#allByProp = new Map();
    for (const [prop, rows] of Object.entries(collections)) {
      if (!rows) continue;
      const byKey = new Map<string, IndexRow[]>();
      for (const row of rows) {
        const key = slugKey(row.name);
        const existing = byKey.get(key);
        if (existing) existing.push(row);
        else byKey.set(key, [row]);
      }
      this.#allByProp.set(prop as VetoolsProp, byKey);
    }
  }

  readonly #allByProp: Map<VetoolsProp, Map<string, IndexRow[]>>;

  /**
   * Resolve one pick.
   *
   * `preferredSource` settles the case where an entity appears in several books
   * within the same edition; without it, a pick with more than one candidate is
   * ambiguous rather than arbitrarily chosen.
   */
  resolve(prop: VetoolsProp, query: string, preferredSource?: string): Resolution<VetoolsRef> {
    const key = slugKey(query);
    const candidates = this.#byProp.get(prop)?.get(key) ?? [];

    if (candidates.length === 0) {
      const otherEdition = this.#allByProp.get(prop)?.get(key) ?? [];
      if (otherEdition.length > 0) {
        return {
          ok: false,
          failure: {
            prop,
            query,
            reason: "wrong-edition",
            availableIn: [...new Set(otherEdition.map((row) => row.source))],
          },
        };
      }
      return { ok: false, failure: { prop, query, reason: "not-found" } };
    }

    if (preferredSource) {
      const match = candidates.find((row) => row.source === preferredSource);
      if (match) return { ok: true, value: refForRow(prop, match) };
    }

    if (candidates.length > 1) {
      return {
        ok: false,
        failure: {
          prop,
          query,
          reason: "ambiguous",
          availableIn: candidates.map((row) => row.source),
        },
      };
    }

    const only = candidates[0] as IndexRow;
    return { ok: true, value: refForRow(prop, only) };
  }

  /**
   * The indexed row a pick resolves to, rather than a reference to it.
   *
   * `resolve` answers with a page, a hash and a source: enough for Foundry to
   * find the entity and nothing to reason about here. Some decisions need the
   * entity. Whether an item is a weapon, a suit of armour or a cooking pot is
   * a fact 5etools already records, and the alternative is asking the
   * builder's own catalog, which holds a handful of rows and does not know.
   *
   * Null on the cases `resolve` reports as failures — nothing found, or more
   * than one candidate and no book to choose between them — so a caller never
   * reads a row the resolver would have refused.
   */
  rowFor(prop: VetoolsProp, query: string, preferredSource?: string): IndexRow | null {
    const candidates = this.#byProp.get(prop)?.get(slugKey(query)) ?? [];
    if (candidates.length === 0) return null;

    if (preferredSource) {
      const match = candidates.find((row) => row.source === preferredSource);
      if (match) return match;
    }

    return candidates.length === 1 ? (candidates[0] as IndexRow) : null;
  }

  /** Whether a pick resolves, without building the reference. */
  has(prop: VetoolsProp, query: string): boolean {
    return (this.#byProp.get(prop)?.get(slugKey(query))?.length ?? 0) > 0;
  }
}

/** A resolution pass over many picks, collecting every failure. */
export function resolveAll(
  resolver: RefResolver,
  picks: Array<{ prop: VetoolsProp; query: string; source?: string }>,
): { refs: VetoolsRef[]; failures: ResolutionFailure[] } {
  const refs: VetoolsRef[] = [];
  const failures: ResolutionFailure[] = [];

  for (const pick of picks) {
    const result = resolver.resolve(pick.prop, pick.query, pick.source);
    if (result.ok) refs.push(result.value);
    else failures.push(result.failure);
  }

  return { refs, failures };
}
