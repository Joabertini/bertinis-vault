/**
 * 5etools entity references.
 *
 * Plutonium identifies every entity by the triple `{page, source, hash}` and
 * resolves it through `DataLoader.pCacheAndGet(page, source, hash)`. This
 * package builds that triple so a character build can travel as a list of
 * references rather than as fabricated item bodies.
 *
 * The hash algorithm below mirrors 5etools' `UrlUtil`, read from the
 * distributed Plutonium bundle. See docs/PLUTONIUM-INTEGRATION.md.
 */

/** 5etools joins hash components with this separator. */
export const HASH_LIST_SEP = "_";

/**
 * `String.prototype.toUrlified` in 5etools.
 *
 * The trailing lowercase is not redundant: `encodeURIComponent` emits
 * uppercase hex, so "Tasha's" and any accented name would otherwise produce a
 * hash that never matches.
 */
export function encodeForHash(value: string): string {
  return encodeURIComponent(value.toLowerCase()).toLowerCase();
}

/** `UrlUtil.encodeArrayForHash`. */
export function encodeArrayForHash(...values: string[]): string {
  return values.map(encodeForHash).join(HASH_LIST_SEP);
}

/**
 * The 5etools props a character build can reference, mapped to the page that
 * owns them. Plutonium accepts either the prop or the page when selecting an
 * importer.
 */
export const PROP_TO_PAGE = {
  spell: "spells.html",
  item: "items.html",
  baseitem: "items.html",
  magicvariant: "items.html",
  class: "classes.html",
  subclass: "classes.html",
  race: "races.html",
  background: "backgrounds.html",
  feat: "feats.html",
  optionalfeature: "optionalfeatures.html",
} as const;

export type VetoolsProp = keyof typeof PROP_TO_PAGE;

export type VetoolsRef = {
  /** The 5etools page, e.g. `spells.html`. */
  page: string;
  /** The book code, e.g. `PHB`. Case is preserved; the hash lowercases it. */
  source: string;
  /** The 5etools URL hash, e.g. `fire bolt_phb` once decoded. */
  hash: string;
  /** Retained so consumers can pick an importer without reversing the page. */
  prop: VetoolsProp;
};

/**
 * A 5etools entity, narrowed to the fields that determine its reference.
 *
 * `inherits` matters for magic item variants, whose source lives on the parent
 * rather than on the variant itself.
 */
export type VetoolsEntity = {
  name: string;
  source?: string;
  inherits?: { source?: string };
};

/** `SourceUtil.getEntitySource`. */
export function getEntitySource(entity: VetoolsEntity): string | undefined {
  return entity.source ?? entity.inherits?.source;
}

export class MissingSourceError extends Error {
  constructor(prop: VetoolsProp, name: string) {
    super(`Cannot build a ${prop} reference for "${name}": no source on the entity or its parent.`);
    this.name = "MissingSourceError";
  }
}

/**
 * Build a reference from a name and source directly.
 *
 * Every prop a character build touches uses 5etools' generic hash builder,
 * `encodeArrayForHash(name, source)`. Pages with their own builders — deities,
 * adventures, books — are deliberately absent from `PROP_TO_PAGE`.
 */
export function buildRef(prop: VetoolsProp, name: string, source: string): VetoolsRef {
  return {
    page: PROP_TO_PAGE[prop],
    source,
    hash: encodeArrayForHash(name, source),
    prop,
  };
}

/** Build a reference from a raw 5etools entity. */
export function refFromEntity(prop: VetoolsProp, entity: VetoolsEntity): VetoolsRef {
  const source = getEntitySource(entity);
  if (!source) throw new MissingSourceError(prop, entity.name);
  return buildRef(prop, entity.name, source);
}

/**
 * An entry in a character build's reference list: what to import, plus the
 * character-specific state Plutonium cannot know.
 */
export type BuildRefEntry = {
  ref: VetoolsRef;
  /** Item stack size. */
  quantity?: number;
  /** Whether the item is worn or wielded. */
  equipped?: boolean;
  /** Whether the spell is prepared. */
  prepared?: boolean;
  /** Class level, for `class` refs. */
  level?: number;
};

/**
 * Deduplicate a reference list, keeping the first occurrence and summing
 * quantities. Two entries collide when they resolve to the same document.
 */
export function dedupeRefs(entries: BuildRefEntry[]): BuildRefEntry[] {
  const byKey = new Map<string, BuildRefEntry>();

  for (const entry of entries) {
    const key = `${entry.ref.page}|${entry.ref.hash}`;
    const seen = byKey.get(key);

    if (!seen) {
      byKey.set(key, { ...entry });
      continue;
    }

    if (entry.quantity != null || seen.quantity != null) {
      seen.quantity = (seen.quantity ?? 1) + (entry.quantity ?? 1);
    }
  }

  return [...byKey.values()];
}

export {
  EDITION_THRESHOLD,
  getSourceMeta,
  isClassicSource,
  isKnownSource,
  isSourceAllowed,
  listSources,
  rulesVersionOf,
  SOURCES,
  sourcesForRulesVersion,
  SRC_XPHB,
  type RulesVersion,
  type SourceMeta,
} from "./sources.js";

import { isSourceAllowed as isSourceAllowedForVersion, type RulesVersion as Rules } from "./sources.js";

/**
 * Split a reference list by whether each entry is legal for the build's
 * ruleset. Mixing editions is the most likely way to end up with a character
 * that imports but plays wrong, so callers should surface `rejected` rather
 * than dropping it silently.
 */
export function partitionByRulesVersion(
  entries: BuildRefEntry[],
  rulesVersion: Rules,
): { allowed: BuildRefEntry[]; rejected: BuildRefEntry[] } {
  const allowed: BuildRefEntry[] = [];
  const rejected: BuildRefEntry[] = [];

  for (const entry of entries) {
    if (isSourceAllowedForVersion(entry.ref.source, rulesVersion)) allowed.push(entry);
    else rejected.push(entry);
  }

  return { allowed, rejected };
}
