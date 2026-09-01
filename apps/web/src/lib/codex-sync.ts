/**
 * Keeping the shelf and the account in step.
 *
 * "Se sincroniza solo" is a promise with a trap in it: adopting the server's
 * answer changes the Codex, and a hook that syncs whenever the Codex changes
 * would sync forever. So what is watched is a **signature** — the ids, their
 * seal dates and the pending burns — and it is recorded after every sync,
 * including the one whose answer caused the change.
 *
 * Everything here fails quietly on purpose. The Codex is local first: a player
 * with no network still has their characters, and a red banner over a shelf
 * that works would be lying about what is broken.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import type { StoredCharacter } from "@bertinis-vault/contracts";

import { fetchAccountStatus, signOut, syncCodex, SyncError } from "./account-client";
import { useVault, type SealedCharacter } from "./vault-store";

export type SyncStatus =
  | { state: "idle" }
  | { state: "working" }
  | { state: "done"; at: string; added: number; updated: number }
  | { state: "failed"; reason: string };

/** What the account is asked to store: the shelf, with the state left as it is. */
function asStored(characters: SealedCharacter[]): StoredCharacter[] {
  return characters.map((entry) => ({
    id: entry.id,
    sealedAt: entry.sealedAt,
    state: entry.state as unknown as Record<string, unknown>,
  }));
}

/**
 * What a sync would be about.
 *
 * Only the parts a merge reads. The whole state would change on every
 * keystroke of an open draft and say nothing new about the shelf.
 */
function signatureOf(characters: Array<{ id: string; sealedAt: string }>, burned: string[]): string {
  return [...characters.map((entry) => `${entry.id}@${entry.sealedAt}`).sort(), ...[...burned].sort()].join("|");
}

export function useCodexSync() {
  const { characters, burned, account, setAccount, adoptCharacters } = useVault();
  const [status, setStatus] = useState<SyncStatus>({ state: "idle" });
  /**
   * Whether this store offers accounts. `null` until it has answered.
   *
   * Unknown is its own state on purpose: defaulting to "yes" flashes a sign-in
   * button on a store that has none, and defaulting to "no" hides it for a
   * moment on every load of the one that does.
   */
  const [accountsAvailable, setAccountsAvailable] = useState<boolean | null>(null);

  /** The signature as of the last sync that finished. */
  const synced = useRef<string | null>(null);
  const running = useRef(false);

  const run = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setStatus({ state: "working" });

    try {
      const result = await syncCodex(
        asStored(useVault.getState().characters),
        useVault.getState().burned,
      );

      adoptCharacters(result.characters);
      // Recorded from the answer rather than from what was sent, so the change
      // this sync just caused does not look like a reason to sync again.
      synced.current = signatureOf(result.characters, []);
      setStatus({
        state: "done",
        at: new Date().toISOString(),
        added: result.added,
        updated: result.updated,
      });
    } catch (error) {
      /*
       * A session that expired is not an error to shout about — it is the
       * ordinary end of thirty days. The account is dropped so the page offers
       * to sign in again rather than showing a name over nothing.
       */
      if (error instanceof SyncError && error.status === 401) {
        setAccount(null);
        setStatus({ state: "idle" });
      } else {
        setStatus({
          state: "failed",
          reason: error instanceof SyncError ? error.message : "No se pudo hablar con el almacen.",
        });
      }
      // The signature is left unrecorded, so the next change tries again.
    } finally {
      running.current = false;
    }
  }, [adoptCharacters, setAccount]);

  /** Who is signed in. Asked once per load, because only the cookie knows. */
  useEffect(() => {
    let cancelled = false;

    void fetchAccountStatus().then((found) => {
      if (cancelled) return;
      setAccountsAvailable(found.available);
      setAccount(found.available ? found.account : null);
    });

    return () => {
      cancelled = true;
    };
  }, [setAccount]);

  /**
   * The shelf changed, or somebody just signed in.
   *
   * Held for a moment first: sealing a character and walking back to the Codex
   * is two changes a second apart, and syncing both is one round trip wasted.
   */
  useEffect(() => {
    if (!account) return;

    const now = signatureOf(characters, burned);
    if (now === synced.current) return;

    const timer = setTimeout(() => void run(), 1200);
    return () => clearTimeout(timer);
  }, [account, characters, burned, run]);

  const leave = useCallback(async () => {
    await signOut();
    setAccount(null);
    // The shelf stays. Signing out is leaving the account, not losing the
    // characters this machine already has.
    synced.current = null;
    setStatus({ state: "idle" });
  }, [setAccount]);

  return { account, accountsAvailable, status, sync: run, signOut: leave };
}
