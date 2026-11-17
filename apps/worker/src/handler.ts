/**
 * The only backend.
 *
 * It stores a build under a code and hands it back. It does not serve content:
 * the browsing index ships with the builder and full entity data comes from
 * Plutonium inside Foundry, so there is nothing here for a content API to do.
 *
 * The handler is written against web standards rather than the Workers runtime
 * so it can be exercised with plain Request and Response objects.
 */

import { importPayloadSchema, type ImportPayload } from "@bertinis-vault/contracts";

import { d1Store, type D1Like, type Store } from "./accounts.js";
import { handleImageRead, handleImageUpload, type ImageStore } from "./images.js";
import {
  bearerTokenOf,
  handleCallback,
  handleLogout,
  handleMe,
  handleStart,
  handleSync,
  type AuthEnv,
} from "./auth-routes.js";
import {
  format,
  generateCode,
  generateWriteToken,
  hashToken,
  normalizeCode,
  ownerKey,
  secretsMatch,
  storageKey,
} from "./code.js";

/** The slice of Workers KV this handler uses. */
export type BuildStore = {
  get(key: string, type: "text"): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
} & Partial<ImageStore>;

/**
 * Cloudflare's rate limiter, as much of it as this uses.
 *
 * A binding rather than a counter in KV on purpose: counting in KV would spend
 * a write on every failed read, and the free tier allows a thousand writes a
 * day — so the cheapest way to take the store down would be to ask it for
 * codes that do not exist.
 */
export type RateLimiter = {
  limit(options: { key: string }): Promise<{ success: boolean }>;
};

export type Env = {
  BUILDS: BuildStore;
  /**
   * Budget for *failed* reads, per caller.
   *
   * Enumeration is the attack a short code invites, and a wrong guess is the
   * only thing it produces. Successful reads never touch this: a DM opening
   * thirty characters before a session is doing the thing the store is for.
   *
   * Absent in development and in tests, where there is nobody to enumerate.
   */
  READ_LIMIT?: RateLimiter;
  /**
   * Budget for publishes, per caller.
   *
   * Publishing needs no account and an owned build never expires, so without
   * this a script could spend the day's KV writes and fill the store.
   */
  WRITE_LIMIT?: RateLimiter;
  /** Comma-separated origins allowed to call this. `*` in development. */
  ALLOWED_ORIGINS?: string;
  /** Accounts, sessions and saved characters. Absent until D1 is bound. */
  DB?: D1Like;
  DISCORD_CLIENT_ID?: string;
  DISCORD_CLIENT_SECRET?: string;
  /** Where the front is served. The only place a sign-in returns to. */
  APP_ORIGIN?: string;
  /**
   * This Worker's own address, as Discord has it registered.
   *
   * The Worker answers to two names — `api.bertinilabs.xyz` and its
   * `workers.dev` one — and only the first is registered with Discord and only
   * the first can hold a cookie scoped to `COOKIE_DOMAIN`. Left unset in
   * development, where the request's own origin is the only one there is.
   */
  AUTH_ORIGIN?: string;
  /**
   * The registrable domain the session cookie belongs to, e.g.
   * `bertinilabs.xyz`. Left unset in development, where the front and the API
   * are both on localhost and the cookie needs no domain at all.
   */
  COOKIE_DOMAIN?: string;
};

/**
 * What a caller may substitute.
 *
 * The database and Discord are the two things this Worker talks to that a test
 * cannot, and both are supplied here rather than smuggled in through `Env` —
 * a production field that only a test ever sets is a field somebody will
 * eventually set in production.
 */
export type Deps = {
  store?: Store;
  fetchImpl?: typeof fetch;
};

/**
 * The account routes, or nothing.
 *
 * A deploy with no database and no Discord application is a perfectly good
 * build store, and it should keep being one rather than failing at boot. So
 * accounts are wired only when everything they need is present, and the routes
 * answer 501 when they are not — which is the honest answer to "sign me in" on
 * a Worker with nowhere to put an account.
 */
/**
 * The origin a sign-in has to happen on.
 *
 * `AUTH_ORIGIN` when it is set, and the request's own origin when it is not,
 * which is what development is: one name, no registered redirect to match.
 */
function authOriginOf(env: Env, request: Request): string {
  return env.AUTH_ORIGIN ?? new URL(request.url).origin;
}

function authEnvFor(env: Env, request: Request, deps: Deps): AuthEnv | null {
  const store = deps.store ?? (env.DB ? d1Store(env.DB) : null);
  if (!store || !env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) return null;

  return {
    store,
    ...(deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : {}),
    discord: {
      clientId: env.DISCORD_CLIENT_ID,
      clientSecret: env.DISCORD_CLIENT_SECRET,
      /*
       * The configured address, not the one this request happened to arrive
       * at. It was derived from the request until a sign-in started on the
       * `workers.dev` name and Discord answered "Invalid OAuth2 redirect_uri":
       * a Worker with two names derives two values and only one of them is
       * registered. The drift a variable can have is the smaller risk, and
       * `handleStart` sends the player to this origin before asking Discord
       * anything, so the two cannot disagree in practice.
       */
      redirectUri: new URL("/auth/discord/callback", authOriginOf(env, request)).toString(),
    },
    appOrigin: env.APP_ORIGIN ?? new URL(request.url).origin,
    ...(env.COOKIE_DOMAIN ? { cookieDomain: env.COOKIE_DOMAIN } : {}),
  };
}

/** How long a stored build lives. Ninety days, refreshed on each read. */
export const BUILD_TTL_SECONDS = 90 * 24 * 60 * 60;

/**
 * The largest payload accepted.
 *
 * A level 20 character with every spell and a full pack measures about 11KB, so
 * this leaves generous headroom while refusing anything that is not a build.
 */
export const MAX_PAYLOAD_BYTES = 256 * 1024;

/** How many times a code is regenerated before giving up on a collision. */
const MAX_CODE_ATTEMPTS = 5;

/**
 * The routes a page reaches with `fetch`, carrying the session cookie.
 *
 * The sign-in itself is not here: both halves of it are top-level navigations,
 * and a navigation carries no `Origin` to check.
 */
const CREDENTIALED_ROUTES = new Set(["/auth/me", "/auth/logout", "/codex/sync"]);

/**
 * Whether this caller is one the configuration names.
 *
 * `*` is not a name. It is fine for the build store — a code is the credential
 * there, and anyone holding one is meant to be able to read it — and it is
 * exactly wrong for a session: "any origin may send this user's cookie" is the
 * shape of a cross-site request forgery, and it is the shape a wildcard has.
 */
function namesTheCaller(env: Env, request: Request): boolean {
  const allowed = (env.ALLOWED_ORIGINS ?? "*").split(",").map((o) => o.trim());
  const origin = request.headers.get("Origin");

  return Boolean(origin && allowed.includes(origin));
}

/**
 * Who may call this, and whether they may bring their cookie.
 *
 * A session cookie only reaches a cross-origin request when the response names
 * the calling origin exactly *and* allows credentials — a browser refuses the
 * pair `*` and credentials outright. So the two are granted together and only
 * to an origin the configuration actually lists.
 *
 * A wildcard still answers, and still answers every build request. What it
 * does not do is hand a stranger's page the right to act as a signed-in
 * player.
 */
function corsHeaders(env: Env, request: Request): Record<string, string> {
  const allowed = (env.ALLOWED_ORIGINS ?? "*").split(",").map((o) => o.trim());
  const origin = request.headers.get("Origin");
  const named = namesTheCaller(env, request);

  const allowOrigin = named ? (origin as string) : allowed.includes("*") ? "*" : (allowed[0] ?? "");

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    ...(named ? { "Access-Control-Allow-Credentials": "true" } : {}),
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function error(message: string, status: number, headers: Record<string, string>, extra?: object): Response {
  return json({ error: message, ...extra }, status, headers);
}

type StoredBuild = {
  payload: ImportPayload;
  /**
   * The builder state the payload was derived from, when the sender had one.
   *
   * Kept so a shared code can be opened and edited rather than only imported.
   * A payload is the computed result — which ability a half-feat raised, which
   * book a shared name came from, which method rolled the scores — none of
   * that survives the derivation, so a sheet cannot be edited back into
   * choices. The Codex already stores state for exactly this reason.
   *
   * Opaque here on purpose. This store validates the payload because Foundry
   * consumes it and a broken one fails at a table; the state is only ever read
   * by the builder that wrote it, which coerces it through the same path a
   * stored draft goes through. A schema here would be a second copy of the
   * builder's shape, in a service that has no business knowing it, and every
   * new field in the Forge would fail its own store until this deploys too.
   */
  state?: unknown;
  createdAt: string;
  /**
   * Whether a write token stands behind this code.
   *
   * An owned build does not expire: the code is the character's name now, and a
   * name that stops working ninety days after the last time anybody looked at
   * it is not a name. It also means a read does not have to write — the TTL
   * refresh below exists only for the codes minted before ownership did.
   */
  owned?: true;
};

/**
 * What a publish may send.
 *
 * The bare payload is still accepted because the web builder and this Worker
 * deploy separately: for the minutes between the two, a page still on the old
 * build posts a payload with no envelope, and refusing it would break sharing
 * for that window.
 */
function envelopeOf(parsed: unknown): {
  payload: unknown;
  state?: unknown;
  code?: unknown;
  token?: unknown;
} {
  if (parsed && typeof parsed === "object" && "payload" in parsed) {
    const envelope = parsed as { payload: unknown; state?: unknown; code?: unknown; token?: unknown };
    return {
      payload: envelope.payload,
      ...("state" in envelope ? { state: envelope.state } : {}),
      ...("code" in envelope ? { code: envelope.code } : {}),
      ...("token" in envelope ? { token: envelope.token } : {}),
    };
  }

  return { payload: parsed };
}

/**
 * Store a build, either under a fresh code or back into the one it already has.
 *
 * The second half is what makes a code belong to a character rather than to a
 * send. Before this, every publish minted a new code: sending the same
 * character twice left two live codes, and the one written on the player's
 * sheet was whichever they happened to keep. Now the builder sends back the
 * code and the write token it was given, and the character is replaced where it
 * already lives.
 */
async function handleCreate(request: Request, env: Env, headers: Record<string, string>): Promise<Response> {
  const body = await request.text();

  if (body.length > MAX_PAYLOAD_BYTES) {
    return error(`Build is larger than ${MAX_PAYLOAD_BYTES} bytes.`, 413, headers);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return error("Body is not valid JSON.", 400, headers);
  }

  const envelope = envelopeOf(parsed);

  const result = importPayloadSchema.safeParse(envelope.payload);
  if (!result.success) {
    // Field paths tell the builder what to fix; the raw Zod tree does not.
    return error("Build did not validate.", 422, headers, {
      issues: result.error.issues.slice(0, 20).map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  // Anything that is not an object is not a state, and storing it would hand
  // the builder a string where it expects choices.
  const state =
    envelope.state && typeof envelope.state === "object" && !Array.isArray(envelope.state)
      ? envelope.state
      : undefined;

  const stored: StoredBuild = {
    payload: result.data,
    ...(state ? { state } : {}),
    createdAt: new Date().toISOString(),
    owned: true,
  };
  const serialized = JSON.stringify(stored);

  if (envelope.code !== undefined) {
    return replaceExisting(envelope, serialized, result.data, env, headers);
  }

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const normalized = generateCode();
    const key = storageKey(normalized);

    // Thirty-two bits makes a collision unlikely rather than impossible, and a
    // silent overwrite would destroy someone else's character.
    if ((await env.BUILDS.get(key, "text")) !== null) continue;

    const token = generateWriteToken();
    // The owner mark goes down first. The other order can leave a build with no
    // owner if the second write fails, and a build with no owner is one nobody
    // can ever replace.
    await env.BUILDS.put(ownerKey(normalized), await hashToken(token));
    await env.BUILDS.put(key, serialized);

    return json(
      {
        code: format(normalized),
        writeToken: token,
        characterName: result.data.identity.characterName,
        expiresAt: null,
      },
      201,
      headers,
    );
  }

  return error("Could not allocate a code. Try again.", 503, headers);
}

/**
 * Put a character back where its code already points.
 *
 * The token is the whole check. A code travels — that is what it is for — so
 * holding one cannot be what grants the right to overwrite what it names.
 */
async function replaceExisting(
  envelope: { code?: unknown; token?: unknown },
  serialized: string,
  payload: ImportPayload,
  env: Env,
  headers: Record<string, string>,
): Promise<Response> {
  if (typeof envelope.code !== "string") {
    return error("That is not a valid build code.", 400, headers);
  }

  const normalized = normalizeCode(envelope.code);
  if (!normalized) {
    return error("That is not a valid build code.", 400, headers);
  }

  if (typeof envelope.token !== "string" || envelope.token === "") {
    return error("Replacing a build needs the write token it was published with.", 400, headers);
  }

  const owner = await env.BUILDS.get(ownerKey(normalized), "text");
  if (owner === null) {
    /*
     * Either the code never existed, or it was minted before write tokens did.
     * Both answer the same, and both answer 404 rather than 403: a store that
     * distinguishes "wrong token" from "no such code" tells an enumerator which
     * codes are real, which is the one thing the rate limiter is there to stop
     * them learning.
     */
    return error("No build found for that code. It may have expired.", 404, headers);
  }

  if (!secretsMatch(owner, await hashToken(envelope.token))) {
    return error("That code belongs to another character.", 403, headers);
  }

  await env.BUILDS.put(storageKey(normalized), serialized);

  return json(
    {
      code: format(normalized),
      characterName: payload.identity.characterName,
      expiresAt: null,
    },
    200,
    headers,
  );
}

/**
 * Whether this caller has spent its budget of wrong guesses.
 *
 * Only failures are counted, so the limit never falls on somebody reading
 * characters they actually have codes for. With the limiter unbound — every
 * test, and `wrangler dev` — nothing is limited, which is the right answer on a
 * machine with one caller on it.
 */
async function tooManyMisses(request: Request, env: Env): Promise<boolean> {
  if (!env.READ_LIMIT) return false;

  const caller = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const { success } = await env.READ_LIMIT.limit({ key: caller });
  return !success;
}

async function handleRead(
  request: Request,
  code: string,
  env: Env,
  headers: Record<string, string>,
): Promise<Response> {
  const normalized = normalizeCode(code);
  if (!normalized) {
    if (await tooManyMisses(request, env)) {
      return error("Too many wrong codes. Wait a minute and try again.", 429, headers);
    }
    return error("That is not a valid build code.", 400, headers);
  }

  const key = storageKey(normalized);
  const raw = await env.BUILDS.get(key, "text");
  if (raw === null) {
    if (await tooManyMisses(request, env)) {
      return error("Too many wrong codes. Wait a minute and try again.", 429, headers);
    }
    return error("No build found for that code. It may have expired.", 404, headers);
  }

  /*
   * A build minted before ownership existed still expires, and reading it still
   * pushes that expiry back: a character in use should not vanish under a
   * player who imports it every few weeks. An owned build has no expiry to
   * refresh, so reading it writes nothing at all.
   */
  if (!isOwned(raw)) {
    await env.BUILDS.put(key, raw, { expirationTtl: BUILD_TTL_SECONDS });
  }

  return new Response(raw, {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers },
  });
}

/** Whether a stored record carries the owner mark. Malformed reads as not owned. */
function isOwned(raw: string): boolean {
  try {
    return (JSON.parse(raw) as StoredBuild).owned === true;
  } catch {
    return false;
  }
}

export async function handle(request: Request, env: Env, deps: Deps = {}): Promise<Response> {
  const headers = corsHeaders(env, request);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  const url = new URL(request.url);

  if (url.pathname === "/health") {
    return json({ ok: true }, 200, headers);
  }

  if (url.pathname === "/builds" && request.method === "POST") {
    if (env.WRITE_LIMIT) {
      const caller = request.headers.get("CF-Connecting-IP") ?? "unknown";
      if (!(await env.WRITE_LIMIT.limit({ key: caller })).success) {
        return error("Too many publishes. Wait a minute and try again.", 429, headers);
      }
    }
    return handleCreate(request, env, headers);
  }

  /*
   * The pictures of a character, kept original. Written under the same limit as
   * a build; read by anyone holding the address (Foundry downloads it).
   */
  if (url.pathname === "/images" && request.method === "POST") {
    if (env.WRITE_LIMIT) {
      const caller = request.headers.get("CF-Connecting-IP") ?? "unknown";
      if (!(await env.WRITE_LIMIT.limit({ key: caller })).success) {
        return error("Too many uploads. Wait a minute and try again.", 429, headers);
      }
    }
    if (!env.BUILDS.getWithMetadata) return error("This store keeps no pictures.", 501, headers);
    return handleImageUpload(request, env.BUILDS as ImageStore, headers);
  }
  const picture = /^\/images\/([^/]+)$/.exec(url.pathname);
  if (picture && request.method === "GET") {
    if (!env.BUILDS.getWithMetadata) return error("This store keeps no pictures.", 501, headers);
    return handleImageRead(decodeURIComponent(picture[1] as string), env.BUILDS as ImageStore, headers);
  }

  if (url.pathname.startsWith("/auth/") || url.pathname === "/codex/sync") {
    const auth = authEnvFor(env, request, deps);
    if (!auth) {
      return error("This deployment stores builds by code and keeps no accounts.", 501, headers);
    }

    /*
     * Refused out loud rather than left to fail in the browser.
     *
     * Without an origin the configuration names, the response cannot allow
     * credentials, the cookie never travels, and every account route answers
     * "nobody is signed in" — which reads as a broken sign-in rather than as an
     * `ALLOWED_ORIGINS` still set to `*`.
     *
     * Only the routes a page calls with `fetch` are checked. The two halves of
     * the sign-in are top-level navigations — a link out to Discord and a
     * redirect back — and a navigation carries no `Origin` header at all.
     */
    /*
     * A bearer token is the desktop app, which is not a page and has no origin.
     * The origin check guards the cookie a browser attaches on its own; a
     * header the caller has to set by hand cannot be forged by another site.
     */
    if (CREDENTIALED_ROUTES.has(url.pathname) && !bearerTokenOf(request) && !namesTheCaller(env, request)) {
      return error(
        "This store does not accept accounts from that origin. Set ALLOWED_ORIGINS.",
        403,
        headers,
      );
    }

    if (url.pathname === "/auth/discord/start" && request.method === "GET") {
      /*
       * A sign-in that starts on the wrong name is sent to the right one first.
       *
       * Two things break otherwise, and neither says so clearly. Discord
       * refuses a `redirect_uri` it has not been given, which is the "Invalid
       * OAuth2 redirect_uri" page; and the state cookie carries
       * `Domain=COOKIE_DOMAIN`, which a browser discards outright when the
       * response comes from a host outside that domain — so even a registered
       * second address would come back to a state mismatch.
       *
       * A front deployed against the `workers.dev` name therefore still signs
       * in, instead of failing in a way that looks like a broken account
       * system rather than a stale build.
       */
      const authOrigin = authOriginOf(env, request);
      if (url.origin !== authOrigin) {
        return new Response(null, {
          status: 302,
          headers: { ...headers, Location: `${authOrigin}${url.pathname}${url.search}` },
        });
      }

      return handleStart(request, auth, headers);
    }
    if (url.pathname === "/auth/discord/callback" && request.method === "GET") {
      return handleCallback(request, auth, headers);
    }
    if (url.pathname === "/auth/me" && request.method === "GET") {
      return handleMe(request, auth, headers);
    }
    if (url.pathname === "/auth/logout" && request.method === "POST") {
      return handleLogout(request, auth, headers);
    }
    if (url.pathname === "/codex/sync" && request.method === "POST") {
      return handleSync(request, auth, headers);
    }

    return error("Not found.", 404, headers);
  }

  const match = /^\/builds\/([^/]+)$/.exec(url.pathname);
  if (match && request.method === "GET") {
    return handleRead(request, decodeURIComponent(match[1] as string), env, headers);
  }

  return error("Not found.", 404, headers);
}

export default {
  // Wrapped rather than passed directly: the runtime calls `fetch` with an
  // execution context as its third argument, which is not a set of doubles.
  fetch: (request: Request, env: Env) => handle(request, env),
};
