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
import {
  handleCallback,
  handleLogout,
  handleMe,
  handleStart,
  handleSync,
  type AuthEnv,
} from "./auth-routes.js";
import { format, generateCode, normalizeCode, storageKey } from "./code.js";

/** The slice of Workers KV this handler uses. */
export type BuildStore = {
  get(key: string, type: "text"): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
};

export type Env = {
  BUILDS: BuildStore;
  /** Comma-separated origins allowed to call this. `*` in development. */
  ALLOWED_ORIGINS?: string;
  /** Accounts, sessions and saved characters. Absent until D1 is bound. */
  DB?: D1Like;
  DISCORD_CLIENT_ID?: string;
  DISCORD_CLIENT_SECRET?: string;
  /** Where the front is served. The only place a sign-in returns to. */
  APP_ORIGIN?: string;
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
function authEnvFor(env: Env, request: Request, deps: Deps): AuthEnv | null {
  const store = deps.store ?? (env.DB ? d1Store(env.DB) : null);
  if (!store || !env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) return null;

  return {
    store,
    ...(deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : {}),
    discord: {
      clientId: env.DISCORD_CLIENT_ID,
      clientSecret: env.DISCORD_CLIENT_SECRET,
      // Derived rather than configured: it has to match what Discord has
      // registered byte for byte, and a variable that can drift from the
      // deployed origin is a variable that will.
      redirectUri: new URL("/auth/discord/callback", new URL(request.url).origin).toString(),
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
  createdAt: string;
};

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

  const result = importPayloadSchema.safeParse(parsed);
  if (!result.success) {
    // Field paths tell the builder what to fix; the raw Zod tree does not.
    return error("Build did not validate.", 422, headers, {
      issues: result.error.issues.slice(0, 20).map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  const stored: StoredBuild = { payload: result.data, createdAt: new Date().toISOString() };
  const serialized = JSON.stringify(stored);

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = generateCode();
    const normalized = normalizeCode(code) as string;
    const key = storageKey(normalized);

    // Fifty bits makes a collision vanishingly unlikely, but a silent
    // overwrite would destroy someone else's character, so it is still checked.
    if ((await env.BUILDS.get(key, "text")) !== null) continue;

    await env.BUILDS.put(key, serialized, { expirationTtl: BUILD_TTL_SECONDS });

    return json(
      {
        code: format(normalized),
        characterName: result.data.identity.characterName,
        expiresAt: new Date(Date.now() + BUILD_TTL_SECONDS * 1000).toISOString(),
      },
      201,
      headers,
    );
  }

  return error("Could not allocate a code. Try again.", 503, headers);
}

async function handleRead(code: string, env: Env, headers: Record<string, string>): Promise<Response> {
  const normalized = normalizeCode(code);
  if (!normalized) {
    return error("That is not a valid build code.", 400, headers);
  }

  const key = storageKey(normalized);
  const raw = await env.BUILDS.get(key, "text");
  if (raw === null) {
    return error("No build found for that code. It may have expired.", 404, headers);
  }

  // Reading keeps a character alive: a build in use should not expire under a
  // player who imports it every few weeks.
  await env.BUILDS.put(key, raw, { expirationTtl: BUILD_TTL_SECONDS });

  return new Response(raw, {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers },
  });
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
    return handleCreate(request, env, headers);
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
    if (CREDENTIALED_ROUTES.has(url.pathname) && !namesTheCaller(env, request)) {
      return error(
        "This store does not accept accounts from that origin. Set ALLOWED_ORIGINS.",
        403,
        headers,
      );
    }

    if (url.pathname === "/auth/discord/start" && request.method === "GET") {
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
    return handleRead(decodeURIComponent(match[1] as string), env, headers);
  }

  return error("Not found.", 404, headers);
}

export default {
  // Wrapped rather than passed directly: the runtime calls `fetch` with an
  // execution context as its third argument, which is not a set of doubles.
  fetch: (request: Request, env: Env) => handle(request, env),
};
