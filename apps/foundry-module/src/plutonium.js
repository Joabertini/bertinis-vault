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
 * Import one reference onto an actor.
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
