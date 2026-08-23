import test from "node:test";
import assert from "node:assert/strict";

import { BUILD_TTL_SECONDS, MAX_PAYLOAD_BYTES, handle } from "../dist/handler.js";
import { format, generateCode, normalizeCode, storageKey } from "../dist/code.js";

/** An in-memory stand-in for Workers KV, recording TTLs so refresh is testable. */
function makeStore(initial = {}) {
  const data = new Map(Object.entries(initial));
  const ttls = new Map();

  return {
    data,
    ttls,
    async get(key) {
      return data.has(key) ? data.get(key) : null;
    },
    async put(key, value, options) {
      data.set(key, value);
      if (options?.expirationTtl) ttls.set(key, options.expirationTtl);
    },
  };
}

const ref = (prop, page, name, source) => ({
  page,
  source,
  hash: `${encodeURIComponent(name.toLowerCase()).toLowerCase()}_${source.toLowerCase()}`,
  prop,
});

function payload(overrides = {}) {
  return {
    version: 1,
    rulesVersion: "2014",
    exportedAt: "2026-08-23T12:00:00.000Z",
    identity: { characterName: "Seraphina Vale" },
    race: { ref: ref("race", "races.html", "Half-Elf", "PHB") },
    classes: [{ ref: ref("class", "classes.html", "Warlock", "PHB"), level: 5 }],
    background: { ref: ref("background", "backgrounds.html", "Sage", "PHB") },
    abilities: { str: 8, dex: 14, con: 14, int: 12, wis: 10, cha: 17 },
    proficiencies: { skills: [], languages: [], tools: [], savingThrows: [], expertise: [] },
    feats: [],
    spells: [],
    equipment: [],
    derived: { hp: 38, ac: 13, proficiencyBonus: 3 },
    ...overrides,
  };
}

const post = (body) =>
  new Request("https://vault.test/builds", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const get = (code) => new Request(`https://vault.test/builds/${encodeURIComponent(code)}`);

/* ---------------------------------------------------------------- codes -- */

test("a code is ten base32 characters shown in two groups", () => {
  const code = generateCode();

  assert.match(code, /^[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$/);
  assert.equal(normalizeCode(code)?.length, 10);
});

test("codes do not repeat across many draws", () => {
  const seen = new Set(Array.from({ length: 2000 }, () => generateCode()));
  assert.equal(seen.size, 2000);
});

test("the alphabet excludes the characters people misread", () => {
  const codes = Array.from({ length: 500 }, () => generateCode()).join("");
  for (const char of ["I", "L", "O", "U"]) {
    assert.ok(!codes.includes(char), `generated a code containing ${char}`);
  }
});

test("a code survives being retyped in any case, spacing or substitution", () => {
  const canonical = "K7M2XQF9AB";

  for (const typed of ["K7M2X-QF9AB", "k7m2x qf9ab", "K7M2XQF9AB", " k7m2x-qf9ab "]) {
    assert.equal(normalizeCode(typed), canonical, typed);
  }

  // Read off a screen: I and L become 1, O becomes 0.
  assert.equal(normalizeCode("K7M2X-QF9AB".replace("1", "I")), canonical);
  assert.equal(normalizeCode("I7M2X-QF9AB"), "17M2XQF9AB");
  assert.equal(normalizeCode("O7M2X-QF9AB"), "07M2XQF9AB");
});

test("something that cannot be a code is rejected", () => {
  for (const bad of ["", "TOOSHORT", "WAYTOOLONGACODE", "!!!!!-!!!!!"]) {
    assert.equal(normalizeCode(bad), null, bad);
  }
});

test("format groups a raw code without altering it", () => {
  assert.equal(format("K7M2XQF9AB"), "K7M2X-QF9AB");
});

/* -------------------------------------------------------------- storing -- */

test("posting a build returns a code and stores it", async () => {
  const env = { BUILDS: makeStore() };
  const response = await handle(post(payload()), env);

  assert.equal(response.status, 201);

  const body = await response.json();
  assert.match(body.code, /^[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$/);
  assert.equal(body.characterName, "Seraphina Vale");
  assert.ok(Date.parse(body.expiresAt) > Date.now());

  assert.equal(env.BUILDS.data.size, 1);
  assert.equal([...env.BUILDS.ttls.values()][0], BUILD_TTL_SECONDS);
});

test("a stored build comes back byte for byte", async () => {
  const env = { BUILDS: makeStore() };
  const sent = payload();

  const created = await (await handle(post(sent), env)).json();
  const response = await handle(get(created.code), env);

  assert.equal(response.status, 200);
  const stored = await response.json();
  assert.deepEqual(stored.payload, sent);
  assert.ok(Date.parse(stored.createdAt) <= Date.now());
});

test("a code round-trips however the player retypes it", async () => {
  const env = { BUILDS: makeStore() };
  const created = await (await handle(post(payload()), env)).json();

  for (const variant of [created.code, created.code.replace("-", ""), created.code.toLowerCase()]) {
    assert.equal((await handle(get(variant), env)).status, 200, variant);
  }
});

test("reading a build pushes back its expiry", async () => {
  const env = { BUILDS: makeStore() };
  const created = await (await handle(post(payload()), env)).json();
  const key = storageKey(normalizeCode(created.code));

  env.BUILDS.ttls.set(key, 60);
  await handle(get(created.code), env);

  assert.equal(env.BUILDS.ttls.get(key), BUILD_TTL_SECONDS);
});

test("a colliding code is regenerated rather than overwriting a character", async () => {
  const env = { BUILDS: makeStore() };
  const first = await (await handle(post(payload()), env)).json();

  const second = await (await handle(post(payload({ identity: { characterName: "Other" } })), env)).json();

  assert.notEqual(first.code, second.code);
  assert.equal(env.BUILDS.data.size, 2);
});

/* --------------------------------------------------------------- errors -- */

test("an unknown code is a 404 that says the build may have expired", async () => {
  const env = { BUILDS: makeStore() };
  const response = await handle(get("K7M2X-QF9AB"), env);

  assert.equal(response.status, 404);
  assert.match((await response.json()).error, /expired/i);
});

test("a malformed code is rejected before it reaches storage", async () => {
  let touched = false;
  const env = { BUILDS: { get: async () => ((touched = true), null), put: async () => {} } };

  const response = await handle(get("nope"), env);

  assert.equal(response.status, 400);
  assert.equal(touched, false);
});

test("a body that is not JSON is a 400", async () => {
  const env = { BUILDS: makeStore() };
  const response = await handle(post("{not json"), env);

  assert.equal(response.status, 400);
  assert.equal(env.BUILDS.data.size, 0);
});

test("an invalid build is a 422 naming the fields at fault", async () => {
  const env = { BUILDS: makeStore() };
  const response = await handle(post(payload({ classes: [] })), env);

  assert.equal(response.status, 422);

  const body = await response.json();
  assert.ok(body.issues.length > 0);
  assert.ok(body.issues.every((i) => typeof i.path === "string" && i.message));
  assert.equal(env.BUILDS.data.size, 0);
});

test("an oversized body is refused without being parsed", async () => {
  const env = { BUILDS: makeStore() };
  const response = await handle(post("x".repeat(MAX_PAYLOAD_BYTES + 1)), env);

  assert.equal(response.status, 413);
  assert.equal(env.BUILDS.data.size, 0);
});

test("a payload from a future format does not validate", async () => {
  const env = { BUILDS: makeStore() };
  const response = await handle(post(payload({ version: 99 })), env);

  assert.equal(response.status, 422);
});

/* --------------------------------------------------------------- routes -- */

test("health responds without touching storage", async () => {
  const response = await handle(new Request("https://vault.test/health"), { BUILDS: makeStore() });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});

test("unknown routes and wrong methods are 404", async () => {
  const env = { BUILDS: makeStore() };

  assert.equal((await handle(new Request("https://vault.test/"), env)).status, 404);
  assert.equal(
    (await handle(new Request("https://vault.test/builds", { method: "DELETE" }), env)).status,
    404,
  );
});

test("preflight is answered with the CORS headers a browser needs", async () => {
  const env = { BUILDS: makeStore() };
  const response = await handle(
    new Request("https://vault.test/builds", { method: "OPTIONS" }),
    env,
  );

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
  assert.match(response.headers.get("Access-Control-Allow-Methods"), /POST/);
});

test("a configured origin list is honoured instead of allowing everyone", async () => {
  const env = { BUILDS: makeStore(), ALLOWED_ORIGINS: "https://vault.example,https://staging.example" };

  const allowed = await handle(
    new Request("https://vault.test/health", { headers: { Origin: "https://staging.example" } }),
    env,
  );
  assert.equal(allowed.headers.get("Access-Control-Allow-Origin"), "https://staging.example");

  const denied = await handle(
    new Request("https://vault.test/health", { headers: { Origin: "https://evil.example" } }),
    env,
  );
  assert.notEqual(denied.headers.get("Access-Control-Allow-Origin"), "https://evil.example");
});

test("a stored build is never cached by an intermediary", async () => {
  const env = { BUILDS: makeStore() };
  const created = await (await handle(post(payload()), env)).json();
  const response = await handle(get(created.code), env);

  assert.equal(response.headers.get("Cache-Control"), "no-store");
});
