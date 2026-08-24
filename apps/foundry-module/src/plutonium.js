/**
 * The seam with Plutonium.
 *
 * Everything here was read from the Plutonium 2.17.2 bundle, which ships
 * unminified. See docs/PLUTONIUM-INTEGRATION.md.
 *
 * Nothing in this file builds a document. Plutonium resolves a reference into
 * the real `dnd5e` item — with its activities, damage and icon — and we hand it
 * an actor to put it on.
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
  if (!module.api?.importer) {
    throw new PlutoniumUnavailableError("Plutonium is active but has not finished starting up. Try again in a moment.");
  }

  return module.api;
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
 */
export async function loadEntity(ref) {
  const loader = globalThis.DataLoader;
  if (!loader?.pCacheAndGet) {
    throw new PlutoniumUnavailableError("Plutonium's data loader is not available.");
  }

  const entity = await loader.pCacheAndGet(ref.page, ref.source, ref.hash);
  if (!entity) throw new EntityNotFoundError(ref);

  return entity;
}

/**
 * Import one reference onto an actor, letting Plutonium apply it.
 *
 * This is the interactive path: the importer prompts for any choice the entity
 * carries and writes its own actor updates. It is kept as a fallback behind the
 * `importMode` setting — see `documentForRef` for the one we use by default and
 * for why.
 *
 * Returns what happened rather than throwing, so one unavailable spell does not
 * abandon a character halfway through being built.
 */
export async function importRefOntoActor({ ref, actor, api, helper }) {
  try {
    const importer = await api.importer.pGetImporter({ prop: ref.prop, page: ref.page });
    if (!importer) {
      return { ref, ok: false, reason: `Plutonium has no importer for "${ref.prop}".` };
    }

    const entity = await loadEntity(ref);

    await importer.pImportEntry(
      entity,
      new api.importer.ImportOpts({ actor, actorMultiImportHelper: helper }),
    );

    return { ref, ok: true, name: entity.name };
  } catch (error) {
    return { ref, ok: false, reason: error?.message ?? String(error) };
  }
}

/**
 * The `dnd5e` document for a reference, without applying anything.
 *
 * `isDataOnly` is honoured by Plutonium's base importer immediately after
 * `_pImportEntry_preImport` and before `_pImportEntry_pImportToActor`, where it
 * returns `DataConverter.pGetDocumentJson(...)` and stops. Everything we do not
 * want lives in the part it skips:
 *
 * - `Charactermancer_FeatureOptionsSelect.pGetUserInput`, which opens a picker
 *   for every choice the entity carries — choices the builder already asked.
 * - `_pImportEntry_pFillAbilities`, which *adds* a species ability bonus to
 *   whatever the actor already has. The builder bakes that bonus into
 *   `abilities.final` before sending it, so letting this run applies it twice.
 *
 * What comes back is still a real document, with activities, damage and icons,
 * which is the whole reason this project resolves references instead of
 * fabricating items. We create it ourselves, so what reaches the sheet is ours
 * to decide.
 *
 * The actor is passed through because the converters use it for context —
 * naming an actor item differently from a world one, resolving consumption
 * targets — and not as something to write to. Read from the Plutonium 2.17.2
 * bundle; see docs/PLUTONIUM-INTEGRATION.md.
 */
export async function documentForRef({ ref, actor, api }) {
  try {
    const importer = await api.importer.pGetImporter({ prop: ref.prop, page: ref.page });
    if (!importer) {
      return { ref, ok: false, reason: `Plutonium has no importer for "${ref.prop}".` };
    }

    const entity = await loadEntity(ref);

    const summary = await importer.pImportEntry(
      entity,
      new api.importer.ImportOpts({ actor, isDataOnly: true }),
    );

    const document = summary?.imported?.[0]?.document;
    if (!document) {
      return { ref, ok: false, reason: `Plutonium returned no document for "${entity.name}".` };
    }

    return { ref, ok: true, name: entity.name, document };
  } catch (error) {
    return { ref, ok: false, reason: error?.message ?? String(error) };
  }
}
