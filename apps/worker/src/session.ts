/**
 * Signing in, and staying signed in.
 *
 * The session is a random token in an `HttpOnly` cookie. Two consequences, and
 * both are the reason for the shape:
 *
 * - **JavaScript never sees it.** A token in `localStorage` is readable by any
 *   script the page runs, so a single cross-site scripting hole is not "they
 *   used your session for a minute" but "they have your credential and can use
 *   it tomorrow from their own machine".
 * - **The front and the API must be the same site.** `alba.bertinilabs.xyz` and
 *   `api.bertinilabs.xyz` share `bertinilabs.xyz`, so the browser calls the two
 *   the same site and sends the cookie. On `vercel.app` and `workers.dev` it
 *   would be a third-party cookie, which Safari and Firefox drop by default —
 *   the player signs in, reloads, and is signed out again.
 *
 * What is stored is the SHA-256 of the token, never the token. A leaked
 * database is then a database of hashes rather than a drawer of working keys.
 */

export const SESSION_COOKIE = "alba_session";
export const OAUTH_STATE_COOKIE = "alba_oauth";

/** Thirty days. Long enough that a player is not asked every evening. */
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

/** Ten minutes, which is longer than anyone takes to click "Authorise". */
export const OAUTH_STATE_TTL_SECONDS = 10 * 60;

/** A fresh token: 256 bits, base64url so it survives a cookie unescaped. */
export function generateToken(random: Crypto = crypto): string {
  const bytes = new Uint8Array(32);
  random.getRandomValues(bytes);
  return base64url(bytes);
}

export function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** What goes in the database. The token itself is only ever in the cookie. */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * One cookie, as a `Set-Cookie` line.
 *
 * `Domain` is the registrable domain rather than the API's own host, so the
 * cookie the API sets is sent back to the API from a page served by the front.
 * Without it the cookie belongs to `api.` alone and the front's requests carry
 * nothing.
 *
 * `SameSite=Lax` rather than `Strict`: the OAuth callback arrives as a
 * top-level navigation from Discord, and `Strict` would refuse to send the
 * state cookie on exactly the request that needs it.
 */
export function cookieHeader(
  name: string,
  value: string,
  { maxAge, domain }: { maxAge: number; domain?: string | undefined },
): string {
  const parts = [
    `${name}=${value}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  if (domain) parts.push(`Domain=${domain}`);

  return parts.join("; ");
}

/** The same cookie, expired. Deleting one means setting it to nothing. */
export function clearCookieHeader(name: string, domain?: string | undefined): string {
  return cookieHeader(name, "", { maxAge: 0, domain });
}

/** Read one cookie out of a request. */
export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie");
  if (!header) return null;

  for (const part of header.split(";")) {
    const at = part.indexOf("=");
    if (at < 0) continue;
    if (part.slice(0, at).trim() === name) return part.slice(at + 1).trim();
  }

  return null;
}
