/**
 * Cloudflare Turnstile: a second layer on publishing and uploading.
 *
 * The account (#200) says who is writing; this says a browser is, and not a script holding a stolen
 * session. The page gets a short-lived token from Turnstile — invisible for almost everybody, a
 * click when Cloudflare is unsure — and sends it with the write. This file asks Cloudflare whether
 * that token is good.
 *
 * Why not rely on it alone: an agent driving a real browser can pass a challenge, so Turnstile is a
 * cost on automation, not a wall. It sits next to the sign-in requirement, the suspicion score and
 * the write rate limit, and none of them is expected to be enough by itself.
 *
 * Off unless `TURNSTILE_SECRET` is set, so a deploy without it behaves exactly as before.
 */

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * - `ok`: Cloudflare vouches for the token.
 * - `failed`: Cloudflare looked and said no (expired, already used, wrong site, a bot).
 * - `unavailable`: Cloudflare could not be asked. Not the same as no: see the caller.
 */
export type TurnstileOutcome = "ok" | "failed" | "unavailable";

export async function checkTurnstile(
  secret: string,
  token: string,
  ip: string | null,
  fetchImpl: typeof fetch = fetch,
): Promise<TurnstileOutcome> {
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);

  let response: Response;
  try {
    response = await fetchImpl(SITEVERIFY, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
  } catch {
    return "unavailable";
  }

  if (!response.ok) return "unavailable";

  try {
    const verdict = (await response.json()) as { success?: boolean };
    return verdict.success === true ? "ok" : "failed";
  } catch {
    return "unavailable";
  }
}
