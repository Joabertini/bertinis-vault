/**
 * A draft, resolved.
 *
 * Both the Living Record and the Ritual need the same three things: the
 * canonical build, the payload it converts to, and the list of picks that
 * could not be resolved. Deriving them in one place means the sheet cannot
 * show a character the export would refuse.
 *
 * Deriving is not always possible. `characterBuildInputSchema` requires a
 * species, a class and a background — `canonicalIdSchema` is `min(1)`, so an
 * empty id is a validation error, not a blank. A draft that has not answered
 * those yet therefore cannot be derived at all, and asking anyway throws a
 * ZodError straight through the render. So the result is a discriminated one:
 * either the draft is ready and everything is real, or it is unforged and the
 * sheet shows dashes.
 *
 * Placeholders were the alternative and are worse. Standing in a default class
 * to keep the numbers flowing would put a confident, wrong hit point total on
 * screen, which is the exact failure the project already documents as worse
 * than no answer at all.
 */

import type { CharacterBuild, ImportPayload } from "@bertinis-vault/contracts";
import { parseGearLine } from "./gear-lines";
import {
  RefResolver,
  buildToPayload,
  collections,
  describeFailure,
  rulesVersionOfBuild,
  type ResolutionFailure,
} from "@bertinis-vault/vetools-index";

import { isCoverImage } from "./cover-image";
import { resolveGearId, resolveSpellId } from "@bertinis-vault/data-engine";

import { buildCanonicalSnapshot, type BuilderState } from "./builder";

/** A required pick the draft still owes, in the order the Forge asks. */
export type MissingPiece = "linaje" | "clase" | "trasfondo" | "nombre";

export type ResolvedDraft =
  | { status: "unforged"; missing: MissingPiece[] }
  | {
      status: "ready";
      missing: MissingPiece[];
      snapshot: CharacterBuild;
      /** Null when a reference the payload requires could not be resolved. */
      payload: ImportPayload | null;
      failures: ResolutionFailure[];
      /** Human-readable reasons, for the Ritual to show before it refuses. */
      problems: string[];
    };

/**
 * One resolver per edition.
 *
 * Indexing 4336 rows on every keystroke would be waste, and the draft changes
 * on every keystroke, so the resolver is cached by the only thing it depends
 * on.
 */
const resolverCache = new Map<string, RefResolver>();

function resolverFor(rulesVersion: "2014" | "2024"): RefResolver {
  let resolver = resolverCache.get(rulesVersion);
  if (!resolver) {
    resolver = new RefResolver(rulesVersion, collections);
    resolverCache.set(rulesVersion, resolver);
  }
  return resolver;
}

/** The required picks a draft is still missing, in the order it asks for them. */
export function missingPieces(state: BuilderState): MissingPiece[] {
  const missing: MissingPiece[] = [];
  if (!state.raceId) missing.push("linaje");
  if (!state.classId) missing.push("clase");
  if (!state.backgroundId) missing.push("trasfondo");
  if (!state.characterName.trim()) missing.push("nombre");
  return missing;
}

/**
 * Whether the draft carries enough to be derived at all.
 *
 * The name is not part of this: the builder substitutes a placeholder label
 * for an unnamed draft, so the numbers can be computed while the player is
 * still deciding what to call them.
 */
function isDerivable(state: BuilderState): boolean {
  return Boolean(state.raceId && state.classId && state.backgroundId);
}

/**
 * The payload with the cover the player uploaded riding in its identity, so the
 * Foundry module can make it the actor's portrait. `buildToPayload` works from
 * the canonical snapshot, which has no picture in it.
 */
function withPortrait(payload: ImportPayload | null, cover: string): ImportPayload | null {
  if (!payload || !isCoverImage(cover)) return payload;
  return { ...payload, identity: { ...payload.identity, portrait: cover } };
}

export function resolveDraft(state: BuilderState): ResolvedDraft {
  const missing = missingPieces(state);
  if (!isDerivable(state)) return { status: "unforged", missing };

  const snapshot = buildCanonicalSnapshot(state);
  const rulesVersion = rulesVersionOfBuild(snapshot);
  const conversion = buildToPayload(snapshot, resolverFor(rulesVersion));

  return {
    status: "ready",
    missing,
    snapshot,
    payload: withPortrait(conversion.payload ?? null, state.coverImage),
    failures: conversion.failures,
    problems: conversion.failures.map((failure) => describeProblem(failure, state)),
  };
}

/**
 * A resolution failure, said accurately.
 *
 * A chosen subrace always fails today, and `describeFailure` reports it as
 * "not found", which reads as the player's mistake. It is not: the subrace is
 * in the index and resolves cleanly under the `subrace` prop, but
 * `buildToPayload` looks it up under `race`, where subraces do not live — and
 * `PROP_TO_PAGE` has no `subrace` entry, so even the corrected lookup would
 * yield a reference with no `page` and fail the payload schema.
 *
 * Both of those are in the repo's packages, so this front cannot fix them. It
 * can at least not blame the player for them.
 */
function describeProblem(failure: ResolutionFailure, state: BuilderState): string {
  const isSubrace =
    failure.prop === "race" &&
    state.subraceId.length > 0 &&
    failure.query === state.subraceId;

  if (isSubrace) {
    return "La subraza queda registrada pero todavia no cruza a Foundry: el conversor la busca entre las razas base.";
  }

  // `describeFailure` answers in English, names the internal slug rather than
  // what the player typed, and prints book codes — "XPHB" — that appear
  // nowhere in this front. Accurate, and unreadable to the person who has to
  // act on it.
  const what = `${labelForProp(failure.prop)} "${asTyped(failure, state)}"`;
  const where = (failure.availableIn ?? []).map(bookLabel).join(", ");

  switch (failure.reason) {
    case "wrong-edition":
      return where
        ? `${what} no pertenece a esta edicion. Figura en ${where}.`
        : `${what} no pertenece a esta edicion.`;
    case "ambiguous":
      return `${what} aparece en ${where}. Elegi de cual.`;
    case "not-found":
      return `${what} no figura en el indice. Revisa como esta escrito.`;
    default:
      return describeFailure(failure);
  }
}

/**
 * The words the player actually wrote, where they can be recovered.
 *
 * `failure.query` is the slug the resolver looked up, not the input: someone
 * who typed "Raciones" is told about `"rations"` and goes looking through
 * their own sheet for a word that is not on it. The free-text fields still
 * hold the original lines, so the one whose slug matches is found and shown.
 *
 * Falls back to the slug — being told the internal name beats being told
 * nothing.
 */
function asTyped(failure: ResolutionFailure, state: BuilderState): string {
  const lines = (value: string) =>
    value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

  if (failure.prop === "item") {
    const written = lines(state.extraEquipmentText).find(
      (line) => resolveGearId(parseGearLine(line).id) === failure.query,
    );
    if (written) return written;
  }

  if (failure.prop === "spell") {
    const written = [...lines(state.cantripsText), ...lines(state.spellsText)]
      // Levelled lines are stored as "Nv3: Fireball"; the spell is the tail.
      .map((line) => line.replace(/^Nv\d+:\s*/i, "").trim())
      .find((line) => resolveSpellId(line) === failure.query);
    if (written) return written;
  }

  return failure.query;
}

/** What the player calls the thing, where the index calls it a `prop`. */
function labelForProp(prop: string): string {
  const labels: Record<string, string> = {
    race: "La especie",
    subrace: "La subraza",
    class: "La clase",
    subclass: "La subclase",
    background: "El trasfondo",
    feat: "La dote",
    optionalfeature: "El don",
    spell: "El conjuro",
    item: "El objeto",
  };

  return labels[prop] ?? "La eleccion";
}

/** Book codes as the books are actually called. */
function bookLabel(code: string): string {
  const books: Record<string, string> = {
    PHB: "el Manual del Jugador (2014)",
    XPHB: "el Manual del Jugador (2024)",
    DMG: "la Guia del Dungeon Master (2014)",
    XDMG: "la Guia del Dungeon Master (2024)",
    MM: "el Manual de Monstruos (2014)",
    XMM: "el Manual de Monstruos (2024)",
    TCE: "Caldero de Todo de Tasha",
    XGE: "Guia de Todo de Xanathar",
    SCAG: "Guia del Costa de la Espada",
    MTF: "Tomo de Enemigos de Mordenkainen",
    VGM: "Guia de Monstruos de Volo",
  };

  return books[code] ?? code;
}
