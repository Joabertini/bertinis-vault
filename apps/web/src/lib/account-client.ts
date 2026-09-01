/**
 * Talking to the account.
 *
 * Four calls: who is signed in, sign out, sync the Codex, and the URL that
 * starts a sign-in. The last one is a link rather than a request, because
 * signing in is a trip to Discord and back and a `fetch` cannot leave the page.
 *
 * Every request carries `credentials: "include"`. The session is a cookie the
 * page cannot read — that is the point of it — so the browser has to be told
 * to attach it, and the Worker has to name this origin back. Without both, the
 * request arrives as an anonymous one and the answer is "nobody is signed in".
 */

import type { Account, StoredCharacter } from "@bertinis-vault/contracts";

import { vaultBaseUrl } from "./vault-client";

export type SyncResult = {
  characters: StoredCharacter[];
  added: number;
  updated: number;
  kept: number;
  burned: number;
};

/**
 * Where signing in starts.
 *
 * `redirect` is a path on this site and nothing else — the Worker refuses
 * anything that is not, and it refuses it there rather than trusting this.
 */
export function signInUrl(returnPath = "/codex"): string {
  return `${vaultBaseUrl()}/auth/discord/start?redirect=${encodeURIComponent(returnPath)}`;
}

/**
 * Whether this store keeps accounts at all, and who is signed in if it does.
 *
 * Two different answers that a single `Account | null` collapsed into one, and
 * the collapse was visible: a store with no accounts wired answers 501, a page
 * served from an origin the store does not name answers 403, and both showed
 * the player an "Entrar con Discord" button that could not work. Nobody signed
 * in is an ordinary answer; no accounts here is not an answer to that question.
 */
export type AccountStatus =
  /** The store keeps accounts. `account` is null when nobody is signed in. */
  | { available: true; account: Account | null }
  /** The store does not offer accounts to this page. Nothing to offer. */
  | { available: false };

export async function fetchAccountStatus(): Promise<AccountStatus> {
  try {
    const response = await fetch(`${vaultBaseUrl()}/auth/me`, { credentials: "include" });
    if (!response.ok) return { available: false };

    const body = (await response.json()) as { account: Account | null };
    return { available: true, account: body.account ?? null };
  } catch {
    // Offline, or no store reachable. The Codex still works; it is local, and
    // an offer to sign in that cannot reach anything is worse than no offer.
    return { available: false };
  }
}

export async function signOut(): Promise<void> {
  try {
    await fetch(`${vaultBaseUrl()}/auth/logout`, { method: "POST", credentials: "include" });
  } catch {
    // Nothing to do about it and nothing to say: the cookie either went or the
    // network did, and either way this machine forgets who it was.
  }
}

export class SyncError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "SyncError";
  }
}

/**
 * Hand the account this machine's Codex, and take back the merged one.
 *
 * One call rather than a create, an update and a list, because the front does
 * not have three questions. `burned` travels separately because a newest-wins
 * merge can only ever add: without it, a character deleted here arrives back
 * from the server on the next sync.
 */
export async function syncCodex(
  characters: StoredCharacter[],
  burned: string[] = [],
): Promise<SyncResult> {
  const response = await fetch(`${vaultBaseUrl()}/codex/sync`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ characters, burned }),
  });

  if (!response.ok) {
    throw new SyncError(messageForStatus(response.status), response.status);
  }

  return (await response.json()) as SyncResult;
}

/** What went wrong, said to the person waiting rather than to a log. */
function messageForStatus(status: number): string {
  if (status === 401) return "La sesion vencio. Volve a entrar.";
  if (status === 409) return "La cuenta esta llena de personajes.";
  if (status === 413) return "Un personaje pesa mas de lo que la cuenta acepta.";
  if (status === 422) return "El Codice no paso la validacion del almacen.";
  if (status === 501) return "Este almacen guarda builds por codigo y no lleva cuentas.";
  if (status >= 500) return "El almacen fallo del otro lado. Volve a intentar en un momento.";

  return "El almacen no acepto el Codice.";
}
