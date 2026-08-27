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

/** 5etools separates the parts of a multi-part hash with this. */
export const HASH_PART_SEP = ",";

/** 5etools separates a sub-hash key from its values with this. */
export const HASH_SUB_KV_SEP = ":";

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
  /*
   * A subrace has no page of its own, the way a subclass does not. But unlike
   * a subclass it needs no special hash: 5etools merges subraces into the race
   * list at load, so "Aasimar (Fallen)" is an entry on `races.html` with its
   * own source, and the generic `name_source` builder finds it.
   *
   * Absent from this table, `subrace` was not a prop at all, and the build
   * resolved every subrace against `race` — where it does not exist. Every
   * hill dwarf reached Foundry as a plain dwarf.
   */
  subrace: "races.html",
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
 * Almost every prop a character build touches uses 5etools' generic hash
 * builder, `encodeArrayForHash(name, source)`. Subclasses are the exception —
 * see `buildSubclassRef`. Pages with their own builders — deities, adventures,
 * books — are deliberately absent from `PROP_TO_PAGE`.
 */
export function buildRef(prop: VetoolsProp, name: string, source: string): VetoolsRef {
  return {
    page: PROP_TO_PAGE[prop],
    source,
    hash: encodeArrayForHash(name, source),
    prop,
  };
}

/** What identifies a subclass: itself, plus the class it hangs off. */
export type SubclassRefInput = {
  name: string;
  source: string;
  className: string;
  classSource: string;
  /** `shortName` in the data, e.g. "Abjuration" for "School of Abjuration". */
  shortName?: string | undefined;
};

/**
 * Build a subclass reference.
 *
 * A subclass is the one thing a build references that has no page of its own:
 * it is a piece of state on its class's page. So its hash is the class's hash
 * followed by a state part naming the subclass, rather than the generic
 * `name_source`. From `UrlUtil.URL_TO_HASH_BUILDER["subclass"]` in the
 * Plutonium bundle:
 *
 *     `${classHash},state:${encodeArrayForHash("sub", shortName, source)}=b1`
 *
 * where `b1` is `UrlUtil.mini.compress(true)` and the whole hash is lowercased
 * by `Hist.util.getCleanHash`.
 *
 * The class part uses the subclass's `classSource`, not its own source: the
 * 2014 School of Abjuration is attached to both the 2014 and the 2024 Wizard,
 * and those are two different hashes for the same document.
 */
export function buildSubclassRef(subclass: SubclassRefInput): VetoolsRef {
  const classHash = encodeArrayForHash(subclass.className, subclass.classSource);
  const stateKey = encodeArrayForHash("sub", subclass.shortName || subclass.name, subclass.source);
  const hash = `${classHash}${HASH_PART_SEP}state${HASH_SUB_KV_SEP}${stateKey}=b1`;

  return {
    page: PROP_TO_PAGE.subclass,
    source: subclass.source,
    hash,
    prop: "subclass",
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
