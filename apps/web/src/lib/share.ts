/**
 * Sharing a character, without the ritual around it.
 *
 * A code used to come out of the Ritual: pick a realm, watch the circle turn,
 * read the code off the arrival screen. That is the right ceremony for sending
 * a character to Foundry and the wrong one for answering "pasame el link" in a
 * group chat — the same three screens, to copy one line.
 *
 * So the code is its own thing now. One call publishes the character and hands
 * back the address that opens it, and the Ritual keeps the ceremony for the
 * crossing it is actually about.
 *
 * The code is also stable. `share` carries the code the character already has
 * and the token that proves it is this Codex's to overwrite, so pressing share
 * twice republishes in place instead of minting a second code — see
 * `apps/worker/src/code.ts`.
 */

import type { CharacterShare } from "@bertinis-vault/contracts";

import { resolveDraft, type ResolvedDraft } from "./derive";
import { shareLinkFor } from "./share-link";
import { VaultRequestError, publishBuild } from "./vault-client";
import type { BuilderState } from "./builder-state";

export type ShareResult =
  | { kind: "shared"; code: string; link: string; share: CharacterShare }
  | { kind: "refused"; reason: string };

/**
 * Why a character cannot leave yet, said in one sentence.
 *
 * Lives here rather than in the Ritual because both places refuse for the same
 * reasons, and two copies of this wording is how a player ends up being told
 * two different things about one character.
 */
export function reasonUnready(resolved: ResolvedDraft): string | null {
  if (resolved.status !== "ready") {
    return `Este personaje todavia no esta completo. Falta: ${resolved.missing.join(", ")}.`;
  }

  if (resolved.payload) return null;

  // Every blocking reason, not just the first: a character held back by three
  // unresolved picks would otherwise be fixed one refusal at a time.
  const shown = resolved.problems.slice(0, 3).join(" ");
  const rest = resolved.problems.length - 3;

  if (!shown) {
    return "Faltan datos obligatorios: linaje, clase o trasfondo no se pudieron resolver.";
  }

  return rest > 0 ? `${shown} Y ${rest} mas.` : shown;
}

/**
 * Publish a character and return the address that opens it.
 *
 * `share` is what the Codex already knows about this character's code. Passing
 * it is what makes the code stable; passing nothing mints a new one.
 */
export async function shareCharacter(
  state: BuilderState,
  share?: CharacterShare,
): Promise<ShareResult> {
  const resolved = resolveDraft(state);

  const refusal = reasonUnready(resolved);
  if (refusal) return { kind: "refused", reason: refusal };

  // Narrowed by `reasonUnready`, which returns a string for every case where
  // this is absent.
  const payload = (resolved as Extract<ResolvedDraft, { status: "ready" }>).payload!;

  try {
    const published = await publishBuild(payload, state, share);

    return {
      kind: "shared",
      code: published.code,
      link: shareLinkFor(published.code),
      // A republish returns no token: the character keeps the one it had.
      share: { code: published.code, writeToken: published.writeToken ?? share?.writeToken ?? "" },
    };
  } catch (error) {
    return {
      kind: "refused",
      reason:
        error instanceof VaultRequestError
          ? error.message
          : "No se pudo alcanzar el almacen. Revisa la conexion.",
    };
  }
}
