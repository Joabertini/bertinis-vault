/**
 * The same app inside Faro del Alba.
 *
 * There a player's characters live in their profile, so the Codex is not a page: the profile frames
 * `/personajes` and everything that would open the Codex goes back to it. Off unless the build sets
 * `VITE_FARO_APP`, so alba.bertinilabs.xyz is untouched.
 */
import type { SealedCharacter } from "./vault-store";

export const FARO_APP = import.meta.env.VITE_FARO_APP?.trim() ?? "";

const OWNER_KEY = "faro:dueno";
const shelfKey = (owner: string) => `faro:estante:${owner}`;

export const framed = () => window.top !== window;

/** What the frame tells the profile. Only to that origin. */
export function tellFaro(message: { alto: number } | { abierto: boolean } | { sinSesion: true }): void {
  if (FARO_APP && framed()) window.parent.postMessage({ faro: message }, FARO_APP);
}

type Shelf = { characters: SealedCharacter[]; burned: string[] };

/**
 * One browser, two people: the shelf on this machine belongs to whoever synced it last.
 *
 * Without this, the second person to sign in would receive the first one's characters and upload them
 * to their own account. The other shelf is set aside under its owner, not thrown away.
 * Returns the shelf to show, or null when it already belongs to this account.
 */
export function claimShelf(owner: string, current: Shelf, storage: Storage = localStorage): Shelf | null {
  const before = storage.getItem(OWNER_KEY);
  if (before === owner) return null;
  storage.setItem(OWNER_KEY, owner);
  // Nobody had signed in here: what is on the shelf was made by whoever is signing in now.
  if (!before) return null;

  storage.setItem(shelfKey(before), JSON.stringify(current));
  try {
    const saved = JSON.parse(storage.getItem(shelfKey(owner)) ?? "null") as Shelf | null;
    if (saved && Array.isArray(saved.characters) && Array.isArray(saved.burned)) return saved;
  } catch {
    // An unreadable shelf is an empty one: the account still has its characters.
  }
  return { characters: [], burned: [] };
}
