/**
 * The Codex, as a file a player can keep.
 *
 * Characters live in `localStorage`, which is not storage so much as a cache
 * the browser is allowed to throw away. Clearing site data, a private window,
 * a different machine, a phone — any of those and the Codex is empty. A player
 * who spent an evening building a party has no way to carry it anywhere.
 *
 * So: a file. Plain JSON, readable, with the full builder state of each
 * character rather than a derived sheet — the same reason the store keeps
 * state and not a snapshot, since a sheet cannot be edited back into choices.
 */

import { coerceBuilderState } from "./builder-state";
import type { SealedCharacter } from "./vault-store";

/** What the file says it is, so a wrong file is refused rather than parsed. */
export const CODEX_FORMAT = "bertinis-vault:codex";

/**
 * Bumped when the file's own shape changes, not when a character's does.
 *
 * A draft that gains a field is handled by `coerceBuilderState`, which is why
 * an old export still opens: the characters are re-read through the same
 * coercion a stored draft goes through.
 */
export const CODEX_VERSION = 1;

export type CodexFile = {
  format: typeof CODEX_FORMAT;
  version: number;
  exportedAt: string;
  characters: SealedCharacter[];
};

/** The Codex as text, ready to be written to a file. */
export function exportCodex(characters: SealedCharacter[]): string {
  const file: CodexFile = {
    format: CODEX_FORMAT,
    version: CODEX_VERSION,
    exportedAt: new Date().toISOString(),
    characters,
  };

  // Indented: a player who opens the file should be able to read it, and the
  // size difference on a few dozen characters is not worth the opacity.
  return JSON.stringify(file, null, 2);
}

export type CodexRead =
  | { ok: true; characters: SealedCharacter[]; skipped: number }
  | { ok: false; reason: string };

/**
 * Read a file back, refusing what is not one rather than half-importing it.
 *
 * Every character is run through `coerceBuilderState`, the same way the store
 * reads what the browser saved. An entry with no id or no state is not a
 * character and is counted rather than repaired: a silent repair here would
 * put a blank human wizard in someone's Codex under a name they recognise.
 */
export function readCodexFile(text: string): CodexRead {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: "Eso no es un archivo del Codice: no se pudo leer." };
  }

  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false, reason: "Eso no es un archivo del Codice." };
  }

  const file = parsed as Partial<CodexFile>;

  if (file.format !== CODEX_FORMAT) {
    return { ok: false, reason: "Eso no es un archivo del Codice." };
  }

  // Refused rather than guessed. A file from a newer build may carry fields
  // this one would drop on the next export, which loses work silently.
  if (typeof file.version !== "number" || file.version > CODEX_VERSION) {
    return {
      ok: false,
      reason: "Ese archivo lo escribio una version mas nueva. Actualiza antes de importarlo.",
    };
  }

  if (!Array.isArray(file.characters)) {
    return { ok: false, reason: "El archivo no trae personajes." };
  }

  const characters: SealedCharacter[] = [];
  let skipped = 0;

  for (const entry of file.characters) {
    const candidate = entry as Partial<SealedCharacter> | null;
    if (!candidate || typeof candidate.id !== "string" || !candidate.id || !candidate.state) {
      skipped += 1;
      continue;
    }

    characters.push({
      id: candidate.id,
      sealedAt: typeof candidate.sealedAt === "string" ? candidate.sealedAt : "",
      state: coerceBuilderState(candidate.state),
    });
  }

  return { ok: true, characters, skipped };
}

export type CodexMerge = {
  characters: SealedCharacter[];
  /** Characters the Codex did not have. */
  added: number;
  /** Characters the file had a newer copy of. */
  updated: number;
  /** Characters the Codex already had a newer copy of, and kept. */
  kept: number;
};

/**
 * Fold an imported Codex into the one already here.
 *
 * Merged, never replaced. Importing a backup must not delete the character
 * someone built this morning, and the common case — carrying a Codex to
 * another machine — is one where both sides have real work in them.
 *
 * Where both have the same character, the one sealed later wins. That is the
 * only rule that cannot lose an edit: taking the file always would undo work
 * done since the backup, and keeping local always would make importing an
 * updated character do nothing at all.
 */
export function mergeCodex(
  existing: SealedCharacter[],
  incoming: SealedCharacter[],
): CodexMerge {
  const merged = [...existing];
  let added = 0;
  let updated = 0;
  let kept = 0;

  for (const character of incoming) {
    const at = merged.findIndex((entry) => entry.id === character.id);

    if (at < 0) {
      merged.push(character);
      added += 1;
      continue;
    }

    // String comparison is the right one here: ISO timestamps sort as text,
    // and a missing one sorts before every real one, which is what an entry
    // with no seal date should lose to.
    if (character.sealedAt > (merged[at]?.sealedAt ?? "")) {
      merged[at] = character;
      updated += 1;
    } else {
      kept += 1;
    }
  }

  // Newest first, the way the Codex already reads.
  merged.sort((left, right) => right.sealedAt.localeCompare(left.sealedAt));

  return { characters: merged, added, updated, kept };
}
