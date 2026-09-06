/**
 * The address that opens a build code as a tome.
 *
 * Here rather than written out at each call site so the Ritual and the Codex
 * cannot drift into two different links for the same code — one of them would
 * be the one people paste into a group chat.
 *
 * The code is uppercased and left grouped exactly as the store handed it over.
 * Retyping is the store's problem: `GET /builds/{code}` normalizes case,
 * spacing and the characters people substitute, so a link that arrives
 * lowercase from a chat client still resolves.
 */
export function shareLinkFor(code: string, origin = window.location.origin): string {
  return `${origin}/tomo/${encodeURIComponent(code.trim().toUpperCase())}`;
}
