/**
 * The routes that make an account, and the routes that use one.
 *
 * Kept beside the build store rather than in a second Worker: they are the
 * same origin, the same CORS rules and the same deploy, and a player's session
 * cookie has to reach whichever of them they call.
 */

import {
  accountSchema,
  mergeByNewest,
  MAX_CHARACTER_BYTES,
  MAX_CHARACTERS_PER_ACCOUNT,
  syncRequestSchema,
  type Account,
  type StoredCharacter,
} from "@bertinis-vault/contracts";

import type { AccountRecord, Store } from "./accounts.js";
import { authorizeUrl, identify, type DiscordConfig } from "./discord.js";
import {
  clearCookieHeader,
  cookieHeader,
  generateToken,
  hashToken,
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_TTL_SECONDS,
  readCookie,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
} from "./session.js";

export type AuthEnv = {
  store: Store;
  discord: DiscordConfig;
  /** Where the front is served, and the only place a sign-in may return to. */
  appOrigin: string;
  /** The registrable domain the cookie belongs to. Absent in local development. */
  cookieDomain?: string | undefined;
  fetchImpl?: typeof fetch;
};

const json = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers },
  });

const asAccount = (record: AccountRecord): Account =>
  accountSchema.parse({
    id: record.id,
    provider: "discord",
    displayName: record.displayName,
    avatarUrl: record.avatarUrl,
  });

/**
 * Who is calling, or nobody.
 *
 * Every route below treats "nobody" as an ordinary answer rather than an
 * error, because it is: a page asks before it knows whether anyone is signed
 * in, and asking is not a failure.
 */
export async function accountFor(request: Request, env: AuthEnv): Promise<AccountRecord | null> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;

  return env.store.accountForSession(await hashToken(token), new Date().toISOString());
}

/**
 * Where to send the player once they are signed in.
 *
 * Only a path, and only one that starts with a single slash. A sign-in
 * endpoint that redirects anywhere it is told is an open redirect, and an open
 * redirect on an authenticated route is how a phishing page borrows a real
 * domain. A leading double slash is a protocol-relative URL, which is why the
 * second character is checked too.
 */
export function safeReturnPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

/**
 * The nonce and the return path, as one string.
 *
 * Packed together so the callback knows where the player came from without a
 * second cookie, and compared whole, so a tampered path is a state mismatch
 * rather than a redirect somewhere else.
 */
export function packState(nonce: string, back: string): string {
  return `${nonce}.${btoa(back).replace(/=+$/, "")}`;
}

export function unpackReturnPath(state: string): string {
  const packed = state.split(".")[1];
  if (!packed) return "/";

  try {
    return safeReturnPath(atob(packed));
  } catch {
    return "/";
  }
}

export async function handleStart(
  request: Request,
  env: AuthEnv,
  headers: Record<string, string>,
): Promise<Response> {
  const url = new URL(request.url);
  const state = packState(generateToken(), safeReturnPath(url.searchParams.get("redirect")));

  return new Response(null, {
    status: 302,
    headers: {
      ...headers,
      Location: authorizeUrl(env.discord, state),
      "Set-Cookie": cookieHeader(OAUTH_STATE_COOKIE, state, {
        maxAge: OAUTH_STATE_TTL_SECONDS,
        domain: env.cookieDomain,
      }),
    },
  });
}

export async function handleCallback(
  request: Request,
  env: AuthEnv,
  headers: Record<string, string>,
): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expected = readCookie(request, OAUTH_STATE_COOKIE);

  // The whole point of the state. Without this check a third party can hand a
  // player a callback URL of their own making and sign them into an account
  // that is not theirs.
  if (!code || !state || !expected || state !== expected) {
    return json({ error: "Sign-in did not come back the way it left." }, 400, headers);
  }

  let user;
  try {
    user = await identify(env.discord, code, env.fetchImpl ?? fetch);
  } catch (reason) {
    /*
     * The player reads "try again"; the log reads why.
     *
     * The message carries Discord's own status and nothing else — no code, no
     * token, no secret — because the three ways this fails look identical from
     * the outside: a client secret that was reset after it was stored, a
     * `redirect_uri` that does not match the one the authorize step sent, and
     * a code that was already spent. Swallowing the reason turned a
     * two-minute check into guesswork.
     */
    /*
     * The shape of the credentials, never the credentials. A secret pasted
     * with a newline, truncated, or taken from the wrong field of the portal —
     * the Public Key rather than the Client Secret — is rejected exactly like
     * a wrong one, and only its length tells them apart.
     */
    console.error(
      "discord sign-in failed:",
      reason instanceof Error ? reason.message : reason,
      `| client_id ${env.discord.clientId} | secret length ${env.discord.clientSecret.length}`,
      `| redirect_uri ${env.discord.redirectUri}`,
    );
    return json({ error: "Discord did not confirm the sign-in." }, 502, headers);
  }

  const account = await env.store.upsertAccount({
    provider: "discord",
    providerId: user.id,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
  });

  const token = generateToken();
  await env.store.createSession({
    tokenHash: await hashToken(token),
    accountId: account.id,
    expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString(),
  });

  const response = new Response(null, {
    status: 302,
    headers: {
      ...headers,
      Location: new URL(unpackReturnPath(state), env.appOrigin).toString(),
    },
  });

  response.headers.append(
    "Set-Cookie",
    cookieHeader(SESSION_COOKIE, token, { maxAge: SESSION_TTL_SECONDS, domain: env.cookieDomain }),
  );
  response.headers.append("Set-Cookie", clearCookieHeader(OAUTH_STATE_COOKIE, env.cookieDomain));

  return response;
}

export async function handleMe(
  request: Request,
  env: AuthEnv,
  headers: Record<string, string>,
): Promise<Response> {
  const account = await accountFor(request, env);
  return json({ account: account ? asAccount(account) : null }, 200, headers);
}

export async function handleLogout(
  request: Request,
  env: AuthEnv,
  headers: Record<string, string>,
): Promise<Response> {
  const token = readCookie(request, SESSION_COOKIE);
  if (token) await env.store.deleteSession(await hashToken(token));

  const response = json({ ok: true }, 200, headers);
  response.headers.append("Set-Cookie", clearCookieHeader(SESSION_COOKIE, env.cookieDomain));

  return response;
}

/**
 * The Codex, folded together.
 *
 * One route rather than a create, an update and a list, because the front does
 * not have three questions — it has one: here is what this machine has, tell
 * me what the account has. Newest wins, and the merged list comes back so the
 * caller can adopt it whole.
 *
 * A burn is the exception and travels separately. A newest-wins merge can only
 * ever add, so a character deleted on one machine would arrive back from the
 * server on the next sync and look like the app resurrecting it.
 */
export async function handleSync(
  request: Request,
  env: AuthEnv,
  headers: Record<string, string>,
): Promise<Response> {
  const account = await accountFor(request, env);
  if (!account) return json({ error: "Not signed in." }, 401, headers);

  const body = await request.text();
  if (body.length > MAX_CHARACTER_BYTES * MAX_CHARACTERS_PER_ACCOUNT) {
    return json({ error: "That is more Codex than an account holds." }, 413, headers);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return json({ error: "Body is not valid JSON." }, 400, headers);
  }

  const result = syncRequestSchema.safeParse(parsed);
  if (!result.success) {
    return json(
      {
        error: "Codex did not validate.",
        issues: result.error.issues.slice(0, 20).map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      422,
      headers,
    );
  }

  const oversized = result.data.characters.filter(
    (character) => JSON.stringify(character.state).length > MAX_CHARACTER_BYTES,
  );
  if (oversized.length > 0) {
    return json(
      {
        error: `A character is larger than ${MAX_CHARACTER_BYTES} bytes.`,
        ids: oversized.map((character) => character.id),
      },
      413,
      headers,
    );
  }

  const burned = new Set(result.data.burned);
  const stored = (await env.store.charactersFor(account.id)).filter(
    (character) => !burned.has(character.id),
  );
  const incoming = result.data.characters.filter((character) => !burned.has(character.id));

  const merged = mergeByNewest<StoredCharacter>(stored, incoming);

  if (merged.characters.length > MAX_CHARACTERS_PER_ACCOUNT) {
    return json({ error: `An account holds ${MAX_CHARACTERS_PER_ACCOUNT} characters.` }, 409, headers);
  }

  /*
   * Only what changed is written. Pushing the whole Codex through the database
   * on every sync would rewrite forty rows to change one.
   */
  const changed = merged.characters.filter((character) => {
    const before = stored.find((entry) => entry.id === character.id);
    return !before || before.sealedAt !== character.sealedAt;
  });

  await env.store.saveCharacters(account.id, changed);
  if (result.data.burned.length > 0) {
    await env.store.deleteCharacters(account.id, result.data.burned);
  }

  return json(
    {
      characters: merged.characters,
      added: merged.added,
      updated: merged.updated,
      kept: merged.kept,
      burned: result.data.burned.length,
    },
    200,
    headers,
  );
}
