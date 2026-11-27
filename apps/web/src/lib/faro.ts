/**
 * The same app inside Faro del Alba.
 *
 * There a player's characters live in their profile, so the Codex is not a page: the profile frames
 * `/personajes` and everything that would open the Codex goes back to it. Off unless the build sets
 * `VITE_FARO_APP`, so alba.bertinilabs.xyz is untouched.
 */
import type { FichaFaro } from "./faro-ficha";
import type { SealedCharacter } from "./vault-store";

export const FARO_APP = import.meta.env.VITE_FARO_APP?.trim() ?? "";

const OWNER_KEY = "faro:dueno";
const shelfKey = (owner: string) => `faro:estante:${owner}`;

export const framed = () => window.top !== window;

/** What the frame tells the profile. Only to that origin. */
export function tellFaro(
  message:
    | { alto: number }
    | { abierto: boolean }
    | { sinSesion: true }
    | { listo: true }
    | { fichas: FichaFaro[]; ids: string[] }
    | { disponible: { id: string; v: boolean } },
): void {
  if (FARO_APP && framed()) window.parent.postMessage({ faro: message }, FARO_APP);
}

const CHARACTER_ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Which characters the profile has marked Disponible (usable in missions), from its message.
 * Null when the message carries no map: the switch stays hidden rather than showing everything off.
 */
export function leerDisponibles(data: unknown): Record<string, boolean> | null {
  const map = (data as { faro?: { disponibles?: unknown } } | null)?.faro?.disponibles;
  if (!map || typeof map !== "object" || Array.isArray(map)) return null;
  const out: Record<string, boolean> = {};
  let count = 0;
  for (const [id, value] of Object.entries(map)) {
    if (count >= 200) break;
    if (value === true && CHARACTER_ID.test(id)) {
      out[id] = true;
      count++;
    }
  }
  return out;
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
