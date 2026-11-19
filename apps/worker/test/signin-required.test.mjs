/**
 * With REQUIRE_SIGNIN on, publishing and uploading need a signed-in account, and the account is kept beside
 * what it stored. Reading stays open. Without the setting nothing changes.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { handle } from "../dist/handler.js";
import { hashToken } from "../dist/code.js";
import { SESSION_COOKIE } from "../dist/session.js";

const be32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const ascii = (text) => [...text].map((c) => c.charCodeAt(0));
const chunk = (name, data) => [...be32(data.length), ...ascii(name), ...data, 0, 0, 0, 0];
const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ...chunk("IHDR", [0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]),
  ...chunk("IDAT", [1, 2, 3, 4]),
  ...chunk("IEND", []),
]);

function makeKv() {
  const kept = new Map();
  return {
    kept,
    async get(key) {
      return kept.get(key)?.value ?? null;
    },
    async put(key, value, options = {}) {
      kept.set(key, { value, metadata: options.metadata ?? null });
    },
    async getWithMetadata(key) {
      const entry = kept.get(key);
      return entry ? { value: entry.value, metadata: entry.metadata } : { value: null, metadata: null };
    },
  };
}

const TOKEN = "a-session-token";
const ACCOUNT = { id: "acc-1", provider: "discord", providerId: "77", displayName: "Bertini", avatarUrl: null };

async function setup(extra = {}) {
  const hash = await hashToken(TOKEN);
  const store = { accountForSession: async (given) => (given === hash ? ACCOUNT : null) };
  const env = {
    BUILDS: makeKv(),
    REQUIRE_SIGNIN: "1",
    DISCORD_CLIENT_ID: "client",
    DISCORD_CLIENT_SECRET: "secret",
    ALLOWED_ORIGINS: "https://alba.bertinilabs.xyz",
    ...extra,
  };
  return { env, deps: { store } };
}

const signedIn = { Cookie: `${SESSION_COOKIE}=${TOKEN}` };
const uploadPng = (headers = {}) =>
  new Request("https://api.bertinilabs.xyz/images", { method: "POST", headers: { "Content-Type": "image/png", ...headers }, body: PNG });
const publish = (headers = {}) =>
  new Request("https://api.bertinilabs.xyz/builds", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ payload: {} }),
  });

test("nobody signed in cannot upload a picture or publish a build", async () => {
  const { env, deps } = await setup();
  for (const request of [uploadPng(), publish()]) {
    const response = await handle(request, env, deps);
    assert.equal(response.status, 401);
    assert.equal((await response.json()).code, "signin_required");
  }
  assert.equal(env.BUILDS.kept.size, 0);
});

test("a wrong session is the same as none", async () => {
  const { env, deps } = await setup();
  const response = await handle(uploadPng({ Cookie: `${SESSION_COOKIE}=not-the-token` }), env, deps);
  assert.equal(response.status, 401);
});

test("a signed-in account uploads, and its id is kept beside the picture", async () => {
  const { env, deps } = await setup();
  const response = await handle(uploadPng(signedIn), env, deps);
  assert.equal(response.status, 201);
  const { url } = await response.json();
  const id = url.split("/").pop();
  assert.deepEqual(env.BUILDS.kept.get(`image:${id}`).metadata, { type: "image/png", by: "acc-1" });
});

test("a signed-in account gets past the gate when publishing", async () => {
  const { env, deps } = await setup();
  const response = await handle(publish(signedIn), env, deps);
  assert.notEqual(response.status, 401);
});

test("reading a picture needs no account", async () => {
  const { env, deps } = await setup();
  const { url } = await (await handle(uploadPng(signedIn), env, deps)).json();
  const read = await handle(new Request(url), env, deps);
  assert.equal(read.status, 200);
});

test("a store that asks for sign-in but has no accounts says so instead of letting everyone in", async () => {
  const env = { BUILDS: makeKv(), REQUIRE_SIGNIN: "1" };
  const response = await handle(uploadPng(), env);
  assert.equal(response.status, 503);
});

test("without the setting, uploading stays anonymous", async () => {
  const { env, deps } = await setup({ REQUIRE_SIGNIN: undefined });
  const response = await handle(uploadPng(), env, deps);
  assert.equal(response.status, 201);
});
