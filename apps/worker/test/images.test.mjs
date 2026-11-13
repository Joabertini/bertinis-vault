/**
 * The pictures of a character: stored as uploaded, read back byte for byte.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { handle } from "../dist/handler.js";

function makeStore() {
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

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4, 5, 6, 7, 8]);

const upload = (body, type = "image/png") =>
  new Request("https://api.bertinilabs.xyz/images", { method: "POST", headers: { "Content-Type": type }, body });

test("a picture comes back exactly as it went in", async () => {
  const env = { BUILDS: makeStore() };
  const stored = await handle(upload(PNG), env);
  assert.equal(stored.status, 201);
  const { url } = await stored.json();
  assert.match(url, /^https:\/\/api\.bertinilabs\.xyz\/images\/[A-Za-z0-9_-]{32}$/);

  const read = await handle(new Request(url), env);
  assert.equal(read.status, 200);
  assert.equal(read.headers.get("Content-Type"), "image/png");
  assert.equal(read.headers.get("Access-Control-Allow-Origin"), "*");
  assert.deepEqual(new Uint8Array(await read.arrayBuffer()), PNG);
});

test("a file that is not the picture it claims is refused", async () => {
  const env = { BUILDS: makeStore() };
  assert.equal((await handle(upload(new Uint8Array([1, 2, 3, 4])), env)).status, 415);
  assert.equal((await handle(upload(PNG, "text/plain"), env)).status, 415);
  assert.equal(env.BUILDS.kept.size, 0);
});

test("an unknown address is a 404 and a malformed one a 400", async () => {
  const env = { BUILDS: makeStore() };
  assert.equal((await handle(new Request(`https://api.bertinilabs.xyz/images/${"a".repeat(32)}`), env)).status, 404);
  assert.equal((await handle(new Request("https://api.bertinilabs.xyz/images/nope"), env)).status, 400);
});
