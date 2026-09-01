/**
 * Accounts, sessions and the Codex that syncs itself.
 *
 * Exercised against plain Requests and an in-memory store, which is the whole
 * reason the handler is written against web standards and the database is an
 * interface: a test that had to reimplement D1 would be testing D1.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { handle } from "../dist/handler.js";
import { SESSION_COOKIE, OAUTH_STATE_COOKIE } from "../dist/session.js";
import { safeReturnPath, packState, unpackReturnPath } from "../dist/auth-routes.js";

/* ---------------- the doubles ---------------- */

function makeStore() {
  const accounts = new Map();
  const sessions = new Map();
  const characters = new Map();

  return {
    accounts,
    sessions,
    characters,
    async upsertAccount(input) {
      const key = `${input.provider}:${input.providerId}`;
      const existing = accounts.get(key);
      const record = existing
        ? { ...existing, displayName: input.displayName, avatarUrl: input.avatarUrl }
        : { id: `acc-${accounts.size + 1}`, ...input };
      accounts.set(key, record);
      return record;
    },
    async createSession({ tokenHash, accountId, expiresAt }) {
      sessions.set(tokenHash, { accountId, expiresAt });
    },
    async accountForSession(tokenHash, now) {
      const session = sessions.get(tokenHash);
      if (!session || session.expiresAt <= now) return null;
      return [...accounts.values()].find((entry) => entry.id === session.accountId) ?? null;
    },
    async deleteSession(tokenHash) {
      sessions.delete(tokenHash);
    },
    async charactersFor(accountId) {
      return [...(characters.get(accountId) ?? [])];
    },
    async saveCharacters(accountId, incoming) {
      const kept = characters.get(accountId) ?? [];
      for (const character of incoming) {
        const at = kept.findIndex((entry) => entry.id === character.id);
        if (at < 0) kept.push(character);
        else kept[at] = character;
      }
      characters.set(accountId, kept);
    },
    async deleteCharacters(accountId, ids) {
      characters.set(
        accountId,
        (characters.get(accountId) ?? []).filter((entry) => !ids.includes(entry.id)),
      );
    },
  };
}

/** Discord, answering the two calls a sign-in makes. */
function discordThatSays({ id = "77", name = "Bertini", avatar = "abc" } = {}) {
  return async (url, init) => {
    if (String(url).includes("/oauth2/token")) {
      assert.match(init.body, /grant_type=authorization_code/);
      return new Response(JSON.stringify({ access_token: "at" }), { status: 200 });
    }

    return new Response(JSON.stringify({ id, username: name, global_name: name, avatar }), {
      status: 200,
    });
  };
}

const ENV = {
  BUILDS: { get: async () => null, put: async () => {} },
  DISCORD_CLIENT_ID: "client",
  DISCORD_CLIENT_SECRET: "secret",
  APP_ORIGIN: "https://alba.bertinilabs.xyz",
  COOKIE_DOMAIN: "bertinilabs.xyz",
  ALLOWED_ORIGINS: "https://alba.bertinilabs.xyz",
};

const get = (path, { cookie } = {}) =>
  new Request(`https://api.bertinilabs.xyz${path}`, {
    headers: { Origin: "https://alba.bertinilabs.xyz", ...(cookie ? { Cookie: cookie } : {}) },
    redirect: "manual",
  });

const post = (path, body, { cookie } = {}) =>
  new Request(`https://api.bertinilabs.xyz${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://alba.bertinilabs.xyz",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

/** Every `Set-Cookie` on a response, by name. */
function cookiesOn(response) {
  const found = {};
  for (const line of response.headers.getSetCookie()) {
    const pair = line.split(";")[0];
    const at = pair.indexOf("=");
    found[pair.slice(0, at)] = { value: pair.slice(at + 1), attributes: line };
  }
  return found;
}

/** Sign in end to end, returning the cookie header to send back. */
async function signIn(store, discord = discordThatSays(), env = ENV) {
  const deps = { store, fetchImpl: discord };

  const started = await handle(get("/auth/discord/start?redirect=/codice"), env, deps);
  const state = cookiesOn(started)[OAUTH_STATE_COOKIE].value;

  const back = await handle(
    get(`/auth/discord/callback?code=abc&state=${encodeURIComponent(state)}`, {
      cookie: `${OAUTH_STATE_COOKIE}=${state}`,
    }),
    env,
    deps,
  );

  const session = cookiesOn(back)[SESSION_COOKIE];
  return { started, back, session, cookie: `${SESSION_COOKIE}=${session.value}` };
}

const character = (id, sealedAt, name = id) => ({ id, sealedAt, state: { characterName: name } });

/* ---------------- the tests ---------------- */

test("a deploy with no database is still a build store", async () => {
  // A Worker with nowhere to put an account should say so rather than fail at
  // boot: storing builds by code is a whole service on its own.
  const response = await handle(get("/auth/me"), { BUILDS: {} });

  assert.equal(response.status, 501);
});

test("nobody signed in is an answer, not an error", async () => {
  // The page asks on every load, before it knows.
  const response = await handle(get("/auth/me"), ENV, { store: makeStore() });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { account: null });
});

test("signing in leaves a cookie JavaScript cannot read", async () => {
  const store = makeStore();

  const { back, session } = await signIn(store);

  assert.equal(back.status, 302);
  assert.equal(back.headers.get("Location"), "https://alba.bertinilabs.xyz/codice");
  assert.match(session.attributes, /HttpOnly/);
  assert.match(session.attributes, /Secure/);
  assert.match(session.attributes, /SameSite=Lax/);
  // The registrable domain, so the cookie the API sets comes back from a page
  // the front served.
  assert.match(session.attributes, /Domain=bertinilabs\.xyz/);
});

test("the token is never what the database holds", async () => {
  // A leaked database should be a database of hashes, not a drawer of working
  // keys.
  const store = makeStore();

  const { session } = await signIn(store);

  assert.equal(store.sessions.has(session.value), false, "the raw token must not be a key");
  assert.equal(store.sessions.size, 1);
  assert.match([...store.sessions.keys()][0], /^[0-9a-f]{64}$/);
});

test("a callback with a state nobody issued is refused", async () => {
  /*
   * Without this check a third party hands the player a callback URL of their
   * own making and signs them into an account that is not theirs.
   */
  const store = makeStore();

  const response = await handle(
    get("/auth/discord/callback?code=abc&state=forged", { cookie: `${OAUTH_STATE_COOKIE}=real` }),
    ENV,
    { store, fetchImpl: discordThatSays() },
  );

  assert.equal(response.status, 400);
  assert.equal(store.sessions.size, 0);
});

test("a second sign-in finds the same account, renamed", async () => {
  // Keyed on Discord's id and not the handle: a username change must not leave
  // the player's characters behind on a first account.
  const store = makeStore();

  await signIn(store, discordThatSays({ id: "77", name: "Bertini" }));
  await signIn(store, discordThatSays({ id: "77", name: "Otro Nombre" }));

  assert.equal(store.accounts.size, 1);
  assert.equal([...store.accounts.values()][0].displayName, "Otro Nombre");
});

test("the session names who is signed in", async () => {
  const store = makeStore();
  const { cookie } = await signIn(store);

  const body = await (await handle(get("/auth/me", { cookie }), ENV, { store })).json();

  assert.equal(body.account.displayName, "Bertini");
  assert.equal(body.account.provider, "discord");
  assert.match(body.account.avatarUrl, /^https:\/\/cdn\.discordapp\.com\//);
});

test("signing out forgets the session on both ends", async () => {
  const store = makeStore();
  const { cookie } = await signIn(store);

  const response = await handle(post("/auth/logout", {}, { cookie }), ENV, { store });

  assert.equal(response.status, 200);
  assert.equal(store.sessions.size, 0);
  assert.match(cookiesOn(response)[SESSION_COOKIE].attributes, /Max-Age=0/);

  const after = await (await handle(get("/auth/me", { cookie }), ENV, { store })).json();
  assert.equal(after.account, null);
});

test("syncing without a session is refused rather than stored", async () => {
  const store = makeStore();

  const response = await handle(post("/codex/sync", { characters: [] }), ENV, { store });

  assert.equal(response.status, 401);
  assert.equal(store.characters.size, 0);
});

test("the first sync uploads what the machine has", async () => {
  const store = makeStore();
  const { cookie } = await signIn(store);

  const body = await (
    await handle(
      post("/codex/sync", { characters: [character("a", "2026-08-01T00:00:00.000Z")] }, { cookie }),
      ENV,
      { store },
    )
  ).json();

  assert.equal(body.added, 1);
  assert.equal(body.characters.length, 1);
  assert.equal(store.characters.get("acc-1").length, 1);
});

test("the later seal wins, whichever side it is on", async () => {
  /*
   * The only rule that cannot lose an edit. Taking the incoming copy always
   * would undo work done since; keeping the stored one always would make
   * syncing an edited character do nothing at all.
   */
  const store = makeStore();
  const { cookie } = await signIn(store);
  await store.saveCharacters("acc-1", [character("a", "2026-08-05T00:00:00.000Z", "servidor")]);

  const older = await (
    await handle(
      post("/codex/sync", { characters: [character("a", "2026-08-01T00:00:00.000Z", "viejo")] }, { cookie }),
      ENV,
      { store },
    )
  ).json();

  assert.equal(older.kept, 1);
  assert.equal(older.characters[0].state.characterName, "servidor");

  const newer = await (
    await handle(
      post("/codex/sync", { characters: [character("a", "2026-08-09T00:00:00.000Z", "nuevo")] }, { cookie }),
      ENV,
      { store },
    )
  ).json();

  assert.equal(newer.updated, 1);
  assert.equal(newer.characters[0].state.characterName, "nuevo");
});

test("a burned character stays burned", async () => {
  // A newest-wins merge can only ever add, so a deletion has to be said out
  // loud — otherwise the server hands it straight back on the next sync and it
  // looks like the app resurrecting it.
  const store = makeStore();
  const { cookie } = await signIn(store);
  await store.saveCharacters("acc-1", [character("a", "2026-08-05T00:00:00.000Z")]);

  const body = await (
    await handle(post("/codex/sync", { characters: [], burned: ["a"] }, { cookie }), ENV, { store })
  ).json();

  assert.deepEqual(body.characters, []);
  assert.deepEqual(store.characters.get("acc-1"), []);
});

test("the state crosses unread", async () => {
  /*
   * A character is a builder state, and that state changes every time the
   * builder learns a new question. A server with an opinion about its shape
   * would have to be redeployed in step with the front, or start refusing
   * characters it has no business judging.
   */
  const store = makeStore();
  const { cookie } = await signIn(store);

  const exotic = {
    id: "a",
    sealedAt: "2026-08-01T00:00:00.000Z",
    state: { campoQueNadieConoce: [1, 2, 3] },
  };
  const body = await (
    await handle(post("/codex/sync", { characters: [exotic] }, { cookie }), ENV, { store })
  ).json();

  assert.deepEqual(body.characters[0].state, { campoQueNadieConoce: [1, 2, 3] });
});

test("only what changed is written back", async () => {
  // Pushing the whole Codex through the database on every sync would rewrite
  // forty rows to change one.
  const store = makeStore();
  const { cookie } = await signIn(store);
  await store.saveCharacters("acc-1", [character("a", "2026-08-05T00:00:00.000Z")]);

  const written = [];
  const watched = {
    ...store,
    saveCharacters: async (accountId, characters) => {
      written.push(...characters.map((entry) => entry.id));
      return store.saveCharacters(accountId, characters);
    },
  };

  await handle(
    post(
      "/codex/sync",
      { characters: [character("a", "2026-08-05T00:00:00.000Z"), character("b", "2026-08-06T00:00:00.000Z")] },
      { cookie },
    ),
    ENV,
    { store: watched },
  );

  assert.deepEqual(written, ["b"]);
});

test("a character larger than the limit is named rather than truncated", async () => {
  const store = makeStore();
  const { cookie } = await signIn(store);

  const huge = {
    id: "big",
    sealedAt: "2026-08-01T00:00:00.000Z",
    state: { notes: "x".repeat(200_000) },
  };
  const response = await handle(post("/codex/sync", { characters: [huge] }, { cookie }), ENV, {
    store,
  });

  assert.equal(response.status, 413);
  assert.deepEqual((await response.json()).ids, ["big"]);
});

test("a body that is not a Codex is refused with the field that failed", async () => {
  const store = makeStore();
  const { cookie } = await signIn(store);

  const response = await handle(post("/codex/sync", { characters: [{ id: "" }] }, { cookie }), ENV, {
    store,
  });

  assert.equal(response.status, 422);
  assert.ok((await response.json()).issues.length > 0);
});

test("the response names the caller so the cookie is allowed to travel", async () => {
  const response = await handle(get("/auth/me"), ENV, { store: makeStore() });

  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://alba.bertinilabs.xyz");
  assert.equal(response.headers.get("Access-Control-Allow-Credentials"), "true");
});

test("a wildcard never grants credentials, and says so instead of failing quietly", async () => {
  /*
   * `*` is fine for the build store — a code is the credential there — and
   * exactly wrong for a session: "any origin may send this user's cookie" is
   * the shape of a cross-site request forgery.
   *
   * Refused out loud, because the quiet version is every account route
   * answering "nobody is signed in" and reading as a broken sign-in rather
   * than as a variable nobody set.
   */
  const response = await handle(get("/auth/me"), { ...ENV, ALLOWED_ORIGINS: "*" }, {
    store: makeStore(),
  });

  assert.equal(response.status, 403);
  assert.equal(response.headers.get("Access-Control-Allow-Credentials"), null);
});

test("a build is still readable from anywhere a wildcard allows", async () => {
  // Tightening the session did not tighten the store: the import code is meant
  // to work from whatever page a player pasted it into.
  const response = await handle(
    new Request("https://api.bertinilabs.xyz/health", {
      headers: { Origin: "https://otro-sitio.example" },
    }),
    { ...ENV, ALLOWED_ORIGINS: "*" },
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
  assert.equal(response.headers.get("Access-Control-Allow-Credentials"), null);
});

test("the sign-in itself is not refused for having no origin", async () => {
  // Both halves are top-level navigations — a link out to Discord and a
  // redirect back — and a navigation carries no `Origin` at all.
  const response = await handle(
    new Request("https://api.bertinilabs.xyz/auth/discord/start?redirect=/codex", {
      redirect: "manual",
    }),
    { ...ENV, ALLOWED_ORIGINS: "*" },
    { store: makeStore() },
  );

  assert.equal(response.status, 302);
});

test("the redirect_uri is the registered name, not the one that was called", async () => {
  /*
   * The failure this fixes said "Invalid OAuth2 redirect_uri" on Discord's own
   * page. This Worker answers to two names — `api.bertinilabs.xyz` and its
   * `workers.dev` one — and the redirect was derived from whichever one the
   * request arrived at, so a sign-in started from a front pointing at
   * `workers.dev` sent Discord an address it had never been given.
   */
  const response = await handle(
    new Request("https://api.bertinilabs.xyz/auth/discord/start?redirect=/codex", {
      redirect: "manual",
    }),
    { ...ENV, AUTH_ORIGIN: "https://api.bertinilabs.xyz" },
    { store: makeStore() },
  );

  const sent = new URL(response.headers.get("Location"));
  assert.equal(
    sent.searchParams.get("redirect_uri"),
    "https://api.bertinilabs.xyz/auth/discord/callback",
  );
});

test("a sign-in that starts on the other name is sent to the registered one", async () => {
  /*
   * Two things break otherwise and neither says so: Discord refuses a
   * `redirect_uri` it does not have, and the state cookie carries
   * `Domain=bertinilabs.xyz`, which a browser discards outright coming from a
   * host outside that domain — so even a second registered address would come
   * back to a state mismatch. A front built against `workers.dev` still signs
   * in rather than looking like a broken account system.
   */
  const response = await handle(
    new Request("https://bertinis-vault.bertinisdnd.workers.dev/auth/discord/start?redirect=/codex", {
      redirect: "manual",
    }),
    { ...ENV, AUTH_ORIGIN: "https://api.bertinilabs.xyz" },
    { store: makeStore() },
  );

  assert.equal(response.status, 302);
  assert.equal(
    response.headers.get("Location"),
    "https://api.bertinilabs.xyz/auth/discord/start?redirect=/codex",
  );
  // Nothing is set on the wrong host: the state cookie belongs to the sign-in
  // that actually happens, on the name that can hold it.
  assert.equal(response.headers.get("Set-Cookie"), null);
});

test("without AUTH_ORIGIN the request's own origin is the only one there is", async () => {
  // Development: one name, nothing registered, and a redirect to itself would
  // be a loop.
  const response = await handle(
    new Request("http://127.0.0.1:8787/auth/discord/start?redirect=/codex", { redirect: "manual" }),
    { ...ENV, APP_ORIGIN: undefined, COOKIE_DOMAIN: undefined, AUTH_ORIGIN: undefined },
    { store: makeStore() },
  );

  const sent = new URL(response.headers.get("Location"));
  assert.equal(sent.origin, "https://discord.com");
  assert.equal(
    sent.searchParams.get("redirect_uri"),
    "http://127.0.0.1:8787/auth/discord/callback",
  );
});

test("a sign-in only ever returns to this application", () => {
  /*
   * An endpoint that redirects anywhere it is told is an open redirect, and an
   * open redirect on an authenticated route is how a phishing page borrows a
   * real domain. The double slash matters: it is a protocol-relative URL.
   */
  assert.equal(safeReturnPath("/codice"), "/codice");
  assert.equal(safeReturnPath("//evil.example"), "/");
  assert.equal(safeReturnPath("https://evil.example"), "/");
  assert.equal(safeReturnPath(null), "/");
  assert.equal(unpackReturnPath(packState("nonce", "/codice")), "/codice");
  assert.equal(unpackReturnPath("nonce-with-no-path"), "/");
});
