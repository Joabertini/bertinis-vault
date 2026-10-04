import test from "node:test";
import assert from "node:assert/strict";

import { BUILD_TTL_SECONDS, MAX_PAYLOAD_BYTES, handle } from "../dist/handler.js";
import { format, generateCode, normalizeCode, storageKey } from "../dist/code.js";

/** An in-memory stand-in for Workers KV, recording TTLs so refresh is testable. */
function makeStore(initial = {}) {
  const data = new Map(Object.entries(initial));
  const ttls = new Map();
  const writes = { count: 0 };

  return {
    data,
    ttls,
    writes,
    async get(key) {
      return data.has(key) ? data.get(key) : null;
    },
    async put(key, value, options) {
      writes.count++;
      data.set(key, value);
      if (options?.expirationTtl) ttls.set(key, options.expirationTtl);
      else ttls.delete(key);
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
    proficiencies: {
      skills: [],
      languages: [],
      tools: [],
      savingThrows: [],
      expertise: [],
      toolExpertise: [],
      armor: [],
      weapons: [],
      masteries: [],
    },
    feats: [],
    optionalFeatures: [],
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

test("a code alternates letter and digit, in two groups of four", () => {
  const code = format(generateCode());

  assert.match(code, /^[A-Z][0-9][A-Z][0-9]-[A-Z][0-9][A-Z][0-9]$/);
  assert.equal(normalizeCode(code)?.length, 8);
});

test("codes do not repeat across many draws", () => {
  // Five hundred draws from 4.569.760.000 codes collide about once every
  // thirty-seven thousand runs, which is what testing this at all costs.
  const seen = new Set(Array.from({ length: 500 }, () => generateCode()));
  assert.equal(seen.size, 500);
});

test("every letter and every digit can be drawn", () => {
  // The alphabet no longer drops I, L, O and U: position says which kind of
  // character a slot holds, so none of the four is ambiguous any more.
  const codes = Array.from({ length: 4000 }, () => generateCode());

  assert.equal(new Set(codes.map((code) => code[0])).size, 26);
  assert.equal(new Set(codes.map((code) => code[1])).size, 10);
});

test("a code survives being retyped in any case or spacing", () => {
  const canonical = "K7M2X9F4";

  for (const typed of ["K7M2-X9F4", "k7m2 x9f4", "K7M2X9F4", " k7m2-x9f4 "]) {
    assert.equal(normalizeCode(typed), canonical, typed);
  }
});

test("a misread character is corrected by the slot it landed in", () => {
  // In a letter slot a 0 can only have been an O, and in a digit slot an O can
  // only have been a 0. Neither is ambiguous once position fixes the kind.
  assert.equal(normalizeCode("07M2X9F4"), "O7M2X9F4");
  assert.equal(normalizeCode("K7M2XOF4"), "K7M2X0F4");
  assert.equal(normalizeCode("57B2Z9F4"), "S7B2Z9F4");
  assert.equal(normalizeCode("K7M2X9F4"), "K7M2X9F4");
});

test("a character that cannot be either kind is rejected", () => {
  // 4 is a digit and there is no letter it could have been misread from.
  assert.equal(normalizeCode("47M2X9F4"), null);
  // W is a letter and stands for no digit.
  assert.equal(normalizeCode("KWM2X9F4"), null);
});

test("codes minted under the old scheme still resolve", () => {
  // Ten characters is never a new code and eight is never an old one, so
  // length alone tells the two schemes apart.
  assert.equal(normalizeCode("K7M2X-QF9AB"), "K7M2XQF9AB");
  assert.equal(normalizeCode("k7m2x qf9ab"), "K7M2XQF9AB");
  assert.equal(normalizeCode("I7M2X-QF9AB"), "17M2XQF9AB");
  assert.equal(normalizeCode("O7M2X-QF9AB"), "07M2XQF9AB");
});

test("something that cannot be a code is rejected", () => {
  for (const bad of ["", "SHORT", "WAYTOOLONGACODE", "!!!!!-!!!!!"]) {
    assert.equal(normalizeCode(bad), null, bad);
  }
});

test("format groups a code by the scheme it belongs to", () => {
  assert.equal(format("K7M2X9F4"), "K7M2-X9F4");
  assert.equal(format("K7M2XQF9AB"), "K7M2X-QF9AB");
});

/* -------------------------------------------------------------- storing -- */

test("posting a build returns a code, a write token, and no expiry", async () => {
  const env = { BUILDS: makeStore() };
  const response = await handle(post(payload()), env);

  assert.equal(response.status, 201);

  const body = await response.json();
  assert.match(body.code, /^[A-Z][0-9][A-Z][0-9]-[A-Z][0-9][A-Z][0-9]$/);
  assert.match(body.writeToken, /^[0-9a-f]{32}$/);
  assert.equal(body.characterName, "Seraphina Vale");
  // The code is the character's name now, and a name does not expire.
  assert.equal(body.expiresAt, null);

  // The build, and the mark that says who owns it.
  assert.equal(env.BUILDS.data.size, 2);
  assert.equal(env.BUILDS.ttls.size, 0);
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

test("a build published with its builder state gives that state back", async () => {
  const env = { BUILDS: makeStore() };
  const state = { characterName: "Seraphina Vale", classId: "warlock", rulesVersion: "5e-2014" };

  const created = await (await handle(post({ payload: payload(), state }), env)).json();
  const stored = await (await handle(get(created.code), env)).json();

  assert.deepEqual(stored.state, state);
  assert.equal(stored.payload.identity.characterName, "Seraphina Vale");
});

test("a bare payload is still published, and simply has no state to open", async () => {
  const env = { BUILDS: makeStore() };

  const response = await handle(post(payload()), env);
  assert.equal(response.status, 201);

  const stored = await (await handle(get((await response.json()).code), env)).json();
  assert.equal(stored.state, undefined);
  assert.equal(stored.payload.identity.characterName, "Seraphina Vale");
});

test("a state that is not an object is dropped rather than stored", async () => {
  const env = { BUILDS: makeStore() };

  for (const state of ["Seraphina", 7, ["warlock"], null]) {
    const created = await (await handle(post({ payload: payload(), state }), env)).json();
    const stored = await (await handle(get(created.code), env)).json();
    assert.equal(stored.state, undefined, `state ${JSON.stringify(state)} should not be stored`);
  }
});

test("an envelope with an invalid payload is refused, state or no state", async () => {
  const env = { BUILDS: makeStore() };
  const response = await handle(post({ payload: { version: 1 }, state: { classId: "warlock" } }), env);

  assert.equal(response.status, 422);
  assert.equal(env.BUILDS.data.size, 0);
});

test("a payload written before a field existed comes back with it defaulted", async () => {
  // The contract grows by adding optional lists, and the worker validates what
  // it stores. A builder that predates a field must keep working, and what it
  // gets back must be readable by a module that expects the field.
  const env = { BUILDS: makeStore() };
  const older = payload();
  delete older.optionalFeatures;
  delete older.proficiencies.masteries;

  const created = await (await handle(post(older), env)).json();
  const stored = await (await handle(get(created.code), env)).json();

  assert.deepEqual(stored.payload.optionalFeatures, []);
  assert.deepEqual(stored.payload.proficiencies.masteries, []);
  // A purse is the exception: absent stays absent, because five zeroes would
  // blank the money on an actor the old build never had an opinion about.
  assert.equal(stored.payload.currency, undefined);
});

test("a code round-trips however the player retypes it", async () => {
  const env = { BUILDS: makeStore() };
  const created = await (await handle(post(payload()), env)).json();

  for (const variant of [created.code, created.code.replace("-", ""), created.code.toLowerCase()]) {
    assert.equal((await handle(get(variant), env)).status, 200, variant);
  }
});

test("reading a build minted before ownership pushes back its expiry", async () => {
  // No `owned` mark: this is what every record written before write tokens
  // existed looks like, and those still expire.
  const key = storageKey("K7M2XQF9AB");
  const env = {
    BUILDS: makeStore({
      [key]: JSON.stringify({ payload: payload(), createdAt: "2026-01-01T00:00:00.000Z" }),
    }),
  };

  env.BUILDS.ttls.set(key, 60);
  await handle(get("K7M2X-QF9AB"), env);

  assert.equal(env.BUILDS.ttls.get(key), BUILD_TTL_SECONDS);
});

test("reading an owned build writes nothing at all", async () => {
  const env = { BUILDS: makeStore() };
  const created = await (await handle(post(payload()), env)).json();

  const before = env.BUILDS.writes.count;
  const response = await handle(get(created.code), env);

  assert.equal(response.status, 200);
  assert.equal(env.BUILDS.writes.count, before);
});

test("a colliding code is regenerated rather than overwriting a character", async () => {
  const env = { BUILDS: makeStore() };
  const first = await (await handle(post(payload()), env)).json();

  const second = await (await handle(post(payload({ identity: { characterName: "Other" } })), env)).json();

  assert.notEqual(first.code, second.code);
  // Two builds and two owner marks.
  assert.equal(env.BUILDS.data.size, 4);
});

/* --------------------------------------------------- one code per character -- */

test("a character sent twice keeps the code it already had", async () => {
  const env = { BUILDS: makeStore() };
  const first = await (await handle(post(payload()), env)).json();

  const again = await handle(
    post({
      payload: payload({ identity: { characterName: "Seraphina Vale, later" } }),
      code: first.code,
      token: first.writeToken,
    }),
    env,
  );

  assert.equal(again.status, 200);
  assert.equal((await again.json()).code, first.code);

  // Replaced where it lived. Nothing new was allocated.
  assert.equal(env.BUILDS.data.size, 2);

  const read = await (await handle(get(first.code), env)).json();
  assert.equal(read.payload.identity.characterName, "Seraphina Vale, later");
});

test("holding a code is not permission to overwrite what it names", async () => {
  const env = { BUILDS: makeStore() };
  const first = await (await handle(post(payload()), env)).json();

  const response = await handle(
    post({ payload: payload(), code: first.code, token: "0".repeat(32) }),
    env,
  );

  assert.equal(response.status, 403);

  const read = await (await handle(get(first.code), env)).json();
  assert.equal(read.payload.identity.characterName, "Seraphina Vale");
});

test("replacing without a token is refused before storage is touched", async () => {
  const env = { BUILDS: makeStore() };
  const first = await (await handle(post(payload()), env)).json();
  const before = env.BUILDS.writes.count;

  const response = await handle(post({ payload: payload(), code: first.code }), env);

  assert.equal(response.status, 400);
  assert.equal(env.BUILDS.writes.count, before);
});

test("a code nobody owns answers 404, not 403", async () => {
  // Telling a stranger apart from a wrong token would tell them which codes
  // are real, which is the one thing enumeration is trying to learn.
  const env = { BUILDS: makeStore() };

  const response = await handle(
    post({ payload: payload(), code: "K7M2-X9F4", token: "0".repeat(32) }),
    env,
  );

  assert.equal(response.status, 404);
});

test("the write token is never handed back by a read", async () => {
  const env = { BUILDS: makeStore() };
  const created = await (await handle(post(payload()), env)).json();

  const body = await (await handle(get(created.code), env)).text();

  assert.ok(!body.includes(created.writeToken));
  assert.ok(!body.includes("token"));
});

test("wrong codes run out of budget before the store does", async () => {
  let allowed = 2;
  const env = {
    BUILDS: makeStore(),
    READ_LIMIT: {
      async limit() {
        return { success: allowed-- > 0 };
      },
    },
  };

  const created = await (await handle(post(payload()), env)).json();

  assert.equal((await handle(get("K7M2-X9F4"), env)).status, 404);
  assert.equal((await handle(get("K7M2-X9F5"), env)).status, 404);
  assert.equal((await handle(get("K7M2-X9F6"), env)).status, 429);

  // A code that resolves never spends the budget, so a table full of real
  // codes is never what trips the limit.
  assert.equal((await handle(get(created.code), env)).status, 200);
});

test("publishes run out of budget before the store does", async () => {
  let allowed = 1;
  const store = makeStore();
  const env = {
    BUILDS: store,
    WRITE_LIMIT: {
      async limit() {
        return { success: allowed-- > 0 };
      },
    },
  };

  assert.equal((await handle(post(payload()), env)).status, 201);
  const writes = store.writes.count;

  assert.equal((await handle(post(payload()), env)).status, 429);
  assert.equal(store.writes.count, writes);
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
