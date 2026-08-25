/**
 * The seam with Plutonium.
 *
 * Everything here was read from the Plutonium 2.17.2 bundle, which ships
 * unminified. See docs/PLUTONIUM-INTEGRATION.md.
 *
 * Nothing in this file builds a document. Plutonium resolves a reference into
 * the real `dnd5e` item — with its activities, damage and icon — and hands it
 * back for `import.js` to put on an actor.
 */

export const PLUTONIUM_ID = "plutonium";

export class PlutoniumUnavailableError extends Error {
  constructor(reason) {
    super(reason);
    this.name = "PlutoniumUnavailableError";
  }
}

export class EntityNotFoundError extends Error {
  constructor(ref) {
    super(`Could not load "${ref.hash}" (${ref.source}) from ${ref.page}.`);
    this.name = "EntityNotFoundError";
    this.ref = ref;
  }
}

/**
 * Plutonium's public API, or an explanation of why it is not there.
 *
 * Checked rather than assumed: a player without Plutonium, or with it disabled,
 * should be told which of those it is instead of hitting a TypeError.
 */
export function getPlutoniumApi() {
  const module = game.modules?.get(PLUTONIUM_ID);

  if (!module) throw new PlutoniumUnavailableError("Plutonium is not installed.");
  if (!module.active) throw new PlutoniumUnavailableError("Plutonium is installed but not enabled in this world.");

  // `module.api` is assigned by `Api.init()`, which Plutonium runs at the very
  // end of its own `ready` handler. Foundry fires module hooks in id order and
  // "bertinis-vault" sorts before "plutonium", so reading `module.api` at ready
  // finds nothing and reports a module that is plainly installed as missing.
  //
  // `globalThis.plutonium` is the same object, assigned as a top-level
  // statement when the bundle is evaluated — before any hook runs. It is the
  // one that is always there.
  const api = globalThis.plutonium ?? game.plutonium ?? module.api;

  if (!api?.importer) {
    throw new PlutoniumUnavailableError("Plutonium is active but has not finished starting up. Try again in a moment.");
  }

  return api;
}

/** Whether Plutonium is present and ready, without throwing. */
export function isPlutoniumReady() {
  try {
    getPlutoniumApi();
    return true;
  } catch {
    return false;
  }
}

/**
 * Load the 5etools entity a reference points at.
 *
 * `DataLoader` is exposed on `globalThis` by Plutonium and is the same path its
 * own drag-and-drop import takes.
 *
 * The prop is tried before the page. `DataLoader` keys its cache by prop
 * always, and by page only for props that appear in its `_PROP_TO_HASH_PAGE`
 * map — `subclass` does not, which is why Plutonium's own code loads classes
 * and subclasses by prop and never by `classes.html`. The page is kept as a
 * fallback so a reference naming a page we have no prop for still resolves.
 */
export async function loadEntity(ref) {
  const loader = globalThis.DataLoader;
  if (!loader?.pCacheAndGet) {
    throw new PlutoniumUnavailableError("Plutonium's data loader is not available.");
  }

  const entity =
    (ref.prop ? await loader.pCacheAndGet(ref.prop, ref.source, ref.hash, { isSilent: true }) : null) ??
    (await loader.pCacheAndGet(ref.page, ref.source, ref.hash, { isSilent: true }));

  if (!entity) throw new EntityNotFoundError(ref);

  return entity;
}

/**
 * The class a subclass hangs off, which its converter needs alongside it.
 *
 * A subclass document is built from the pair: the class supplies the name the
 * identifier is derived from, the edition it is checked against, and the image
 * fallback. `DataLoader` keys classes by prop, and the subclass entity already
 * carries which class and which book it belongs to.
 */
async function parentClassOf(subclass) {
  const hash = globalThis.UrlUtil.URL_TO_HASH_BUILDER["class"]({
    name: subclass.className,
    source: subclass.classSource,
  });

  const cls = await globalThis.DataLoader.pCacheAndGet("class", subclass.classSource, hash);
  if (!cls) {
    throw new Error(`Could not load "${subclass.className}" (${subclass.classSource}).`);
  }

  return cls;
}

/**
 * The `dnd5e` document for a reference.
 *
 * This calls Plutonium's *converters* and never its importers. That distinction
 * is the whole of it, and it took three attempts to find:
 *
 * - `DataConverter*.pGetDocumentJson*` are pure functions. Entity in, finished
 *   `dnd5e` document JSON out — with activities, damage parts, side-loaded
 *   effects and a real icon, which is the entire reason this project resolves
 *   references instead of fabricating items. They open nothing.
 * - `Importer*.pImportEntry` is the interactive pipeline wrapped around them.
 *   Every attempt to drive it quietly failed against a different window:
 *   `isDataOnly` is read by `ImporterBase` and by no other importer, so class
 *   and feat ignored it; `isTemp` avoids the Charactermancer but the pipeline
 *   still has its own prompts. It is not built to be driven headlessly, so it
 *   is not used.
 *
 * `pGetImporter` is still how we reach a converter — `_DataConverter` is a
 * static on the importer class, and the public API exposes no other door — but
 * only `pInit` runs, which builds a folder-path state manager and shows
 * nothing.
 *
 * No actor is passed. The converters use it only to name an actor item
 * differently from a world one, and passing it turns on `isActorItem` branches
 * we have no use for.
 *
 * `dataOpts` reaches the converter untouched. That is how a choice the builder
 * already made is supplied rather than asked for: `level` becomes the class
 * item's `system.levels`, `proficiencyImportMode` decides whether the class
 * contributes its starting or its multiclass proficiencies.
 */
export async function documentForRef({ ref, api, dataOpts = {} }) {
  try {
    const importer = await api.importer.pGetImporter({ prop: ref.prop, page: ref.page });
    if (!importer) {
      return { ref, ok: false, reason: `Plutonium has no importer for "${ref.prop}".` };
    }

    const converter = importer.constructor?._DataConverter;
    if (!converter) {
      return { ref, ok: false, reason: `Plutonium has no converter for "${ref.prop}".` };
    }

    const entity = await loadEntity(ref);
    const document = await documentFor({ converter, entity, prop: ref.prop, dataOpts });

    if (!document) {
      return { ref, ok: false, reason: `Plutonium returned no document for "${entity.name}".` };
    }

    // The converters return plain JSON. The guard is for the day one of them
    // returns a Document instead, which `createEmbeddedDocuments` will not take.
    const data = typeof document.toObject === "function" ? document.toObject() : document;

    return { ref, ok: true, name: entity.name, document: data };
  } catch (error) {
    return { ref, ok: false, reason: error?.message ?? String(error) };
  }
}

/**
 * Which converter call a prop takes.
 *
 * Classes are the exception in Plutonium's data model and so they are here:
 * `DataConverterClass` has no `pGetDocumentJson` at all. It has
 * `pGetDocumentJsonClass`, and `pGetDocumentJsonSubclass`, which takes the pair.
 */
async function documentFor({ converter, entity, prop, dataOpts }) {
  // `isActorItem` says this document is destined for a character sheet rather
  // than the Items directory. It is not cosmetic: without it the converters
  // append the book to the name — "Fireball (PHB)" — and `findByRef` matches
  // imported items back to their reference by name, so equipped and prepared
  // state would stop landing. Three of the converters also key
  // `flags.plutonium.isDirectImport` off it.
  const opts = { isActorItem: true, ...dataOpts };

  if (prop === "class") {
    return converter.pGetDocumentJsonClass(entity, opts);
  }

  if (prop === "subclass") {
    const cls = await parentClassOf(entity);
    // The entity came from `DataLoader`, which returns subclasses with their
    // features already dereferenced; saying so stops the converter fetching the
    // same thing again.
    return converter.pGetDocumentJsonSubclass(cls, entity, { isScDereferenced: true, ...opts });
  }

  return converter.pGetDocumentJson(entity, opts);
}

/**
 * Mark a document as already imported, so Plutonium leaves it alone.
 *
 * This is the one that mattered. Plutonium registers a `preCreateItem` hook per
 * prop — `class`, `subclass`, `race`, `background`, `feat`, `item`,
 * `optionalfeature`, which is every prop a character payload carries. Any item
 * created on an actor carrying Plutonium's own `propDroppable` flag is
 * intercepted, and the player is asked whether to use the importer, and then
 * the Charactermancer opens.
 *
 * The documents the converters build carry that flag, because they are
 * Plutonium's documents. So it did not matter how quietly they were built: the
 * window came from the *write*, not the build, and three attempts at making the
 * build silent could never have reached it.
 *
 * The hook's own escape is `flags.plutonium.isDirectImport`:
 *
 * ```js
 * if (flags.isStandardDragDrop || flags.isDirectImport) return;
 * ```
 *
 * Some converters set it from `isActorItem` already. Setting it here covers the
 * ones that do not, and does not depend on which.
 */
export function markAsDirectImport(document) {
  const flags = { ...(document.flags ?? {}) };
  flags[PLUTONIUM_ID] = { ...(flags[PLUTONIUM_ID] ?? {}), isDirectImport: true };

  return { ...document, flags };
}

/**
 * How a class contributes proficiencies, as `DataConverterClass` numbers them.
 *
 * The interactive import asks this with `Charactermancer_Class_Proficiency
 * ImportModeSelect`. Leaving it unset is not neutral: `_getClassAdvancements`
 * matches neither mode and builds the class with no proficiency advancement at
 * all, so the character arrives without the armour, weapon and save
 * proficiencies its own class grants.
 */
export const PROFICIENCY_IMPORT_MODE = {
  multiclass: 0,
  primary: 1,
  none: 2,
};
