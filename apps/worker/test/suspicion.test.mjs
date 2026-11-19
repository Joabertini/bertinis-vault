/**
 * The door check: a first registration that looks automated is held for a person to look at, and nobody
 * who is already in is ever locked out by it.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { handle } from "../dist/handler.js";
import { SESSION_COOKIE, OAUTH_STATE_COOKIE } from "../dist/session.js";
import { assess, blockedIdsOf, createdAtOf, denyThresholdOf } from "../dist/suspicion.js";

const NOW = new Date("2026-11-19T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

/** A Discord id for an account created `days` before NOW. */
const snowflakeAged = (days) => String((BigInt(NOW.getTime() - days * DAY - 1420070400000) << 22n));

/* ---------------- the score ---------------- */

test("the creation date is read out of the id", () => {
  assert.equal(createdAtOf(snowflakeAged(10)).toISOString().slice(0, 10), "2026-11-09");
  assert.equal(createdAtOf("not-a-number"), null);
  assert.equal(createdAtOf("77"), null);
});

test("an old account with its own avatar and a normal name scores nothing", () => {
  const { score, reasons } = assess({ id: snowflakeAged(900), username: "bertini", defaultAvatar: false, bot: false }, NOW);
  assert.equal(score, 0);
  assert.deepEqual(reasons, []);
});

test("a days-old account with no avatar reaches the default threshold", () => {
  const { score, reasons } = assess({ id: snowflakeAged(3), username: "user", defaultAvatar: true, bot: false }, NOW);
  assert.ok(score >= 5, `score ${score}`);
  assert.ok(reasons.length >= 2);
});

test("an account from this June is a little suspicious and not enough on its own", () => {
  const { score } = assess({ id: snowflakeAged(160), username: "dairon", defaultAvatar: false, bot: false }, NOW);
  assert.equal(score, 2);
});

test("a bot is always over the line", () => {
  const { score } = assess({ id: snowflakeAged(900), username: "x", defaultAvatar: false, bot: true }, NOW);
  assert.ok(score >= 100);
});

test("the threshold and the blocked list read their settings, and fall back when they are junk", () => {
  assert.equal(denyThresholdOf(undefined), 5);
  assert.equal(denyThresholdOf("nope"), 5);
  assert.equal(denyThresholdOf("0"), 5);
  assert.equal(denyThresholdOf("7"), 7);
  assert.deepEqual([...blockedIdsOf(" 1, 2 ,,3 ")], ["1", "2", "3"]);
  assert.equal(blockedIdsOf(undefined).size, 0);
});

/* ---------------- at the door ---------------- */

function makeStore({ known = false, hasAccountThrows = false } = {}) {
  const denied = [];
  const accounts = [];
  const sessions = [];

  return {
    denied,
    accounts,
    sessions,
    async hasAccount() {
      if (hasAccountThrows) throw new Error("D1 is down");
      return known;
    },
    async recordDenial(input) {
      denied.push(input);
    },
    async upsertAccount(input) {
      const record = { id: "acc-1", ...input };
      accounts.push(record);
      return record;
    },
    async createSession(input) {
      sessions.push(input);
    },
  };
}

const discordWith = ({ id, avatar = null, username = "user" }) =>
  async (url) =>
    String(url).includes("/oauth2/token")
      ? new Response(JSON.stringify({ access_token: "at" }), { status: 200 })
      : new Response(JSON.stringify({ id, username, global_name: username, avatar }), { status: 200 });

const ENV = {
  BUILDS: { get: async () => null, put: async () => {} },
  DISCORD_CLIENT_ID: "client",
  DISCORD_CLIENT_SECRET: "secret",
  APP_ORIGIN: "https://alba.bertinilabs.xyz",
  COOKIE_DOMAIN: "bertinilabs.xyz",
  ALLOWED_ORIGINS: "https://alba.bertinilabs.xyz",
};

const get = (path, cookie) =>
  new Request(`https://api.bertinilabs.xyz${path}`, {
    headers: { Origin: "https://alba.bertinilabs.xyz", ...(cookie ? { Cookie: cookie } : {}) },
    redirect: "manual",
  });

async function comeBackFromDiscord(store, discord, env) {
  const deps = { store, fetchImpl: discord };
  const started = await handle(get("/auth/discord/start?redirect=/codex"), env, deps);
  const state = started.headers
    .getSetCookie()
    .map((line) => line.split(";")[0])
    .find((pair) => pair.startsWith(`${OAUTH_STATE_COOKIE}=`))
    .slice(OAUTH_STATE_COOKIE.length + 1);

  return handle(get(`/auth/discord/callback?code=abc&state=${encodeURIComponent(state)}`, `${OAUTH_STATE_COOKIE}=${state}`), env, deps);
}

const hasSessionCookie = (response) => response.headers.getSetCookie().some((line) => line.startsWith(`${SESSION_COOKIE}=`) && !/Max-Age=0/i.test(line));

test("a new account that looks automated is held: no account, no session, a record for the appeal", async () => {
  const store = makeStore();
  const back = await comeBackFromDiscord(store, discordWith({ id: snowflakeAged(3), avatar: null }), { ...ENV, SUSPICION: "1" });

  assert.equal(back.status, 302);
  assert.equal(back.headers.get("Location"), "https://alba.bertinilabs.xyz/acceso");
  assert.equal(hasSessionCookie(back), false);
  assert.equal(store.accounts.length, 0);
  assert.equal(store.sessions.length, 0);
  assert.equal(store.denied.length, 1);
  assert.ok(store.denied[0].score >= 5);
  assert.ok(store.denied[0].reasons.length > 0);
});

test("the same kind of account that is already registered is let in", async () => {
  const store = makeStore({ known: true });
  const back = await comeBackFromDiscord(store, discordWith({ id: snowflakeAged(3), avatar: null }), { ...ENV, SUSPICION: "1" });

  assert.equal(back.headers.get("Location"), "https://alba.bertinilabs.xyz/codex");
  assert.equal(hasSessionCookie(back), true);
  assert.equal(store.denied.length, 0);
});

test("an old account with its own avatar registers normally", async () => {
  const store = makeStore();
  const back = await comeBackFromDiscord(store, discordWith({ id: snowflakeAged(900), avatar: "abc" }), { ...ENV, SUSPICION: "1" });

  assert.equal(hasSessionCookie(back), true);
  assert.equal(store.accounts.length, 1);
});

test("a blocked id is refused even when it already has an account, and without turning the score on", async () => {
  const id = snowflakeAged(900);
  const store = makeStore({ known: true });
  const back = await comeBackFromDiscord(store, discordWith({ id, avatar: "abc" }), { ...ENV, BLOCKED_DISCORD_IDS: `1,${id}` });

  assert.equal(back.headers.get("Location"), "https://alba.bertinilabs.xyz/acceso");
  assert.equal(hasSessionCookie(back), false);
});

test("with the setting off nothing is held, however new the account", async () => {
  const store = makeStore();
  const back = await comeBackFromDiscord(store, discordWith({ id: snowflakeAged(1), avatar: null }), ENV);

  assert.equal(hasSessionCookie(back), true);
  assert.equal(store.denied.length, 0);
});

test("when the check itself breaks the sign-in goes through", async () => {
  const store = makeStore({ hasAccountThrows: true });
  const back = await comeBackFromDiscord(store, discordWith({ id: snowflakeAged(1), avatar: null }), { ...ENV, SUSPICION: "1" });

  assert.equal(hasSessionCookie(back), true);
});

test("a refusal still stands when the record cannot be written", async () => {
  const store = makeStore();
  store.recordDenial = async () => {
    throw new Error("no such table: registration_denied");
  };
  const back = await comeBackFromDiscord(store, discordWith({ id: snowflakeAged(3), avatar: null }), { ...ENV, SUSPICION: "1" });

  assert.equal(back.headers.get("Location"), "https://alba.bertinilabs.xyz/acceso");
  assert.equal(hasSessionCookie(back), false);
});
