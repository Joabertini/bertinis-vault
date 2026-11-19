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

const be32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const ascii = (text) => [...text].map((c) => c.charCodeAt(0));
const chunk = (name, data) => [...be32(data.length), ...ascii(name), ...data, 0, 0, 0, 0];

/** The smallest shape of each picture the store accepts: what the validator checks, not a picture to look at. */
const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ...chunk("IHDR", [0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]),
  ...chunk("IDAT", [1, 2, 3, 4]),
  ...chunk("IEND", []),
]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46, 0xff, 0xda, 0x00, 0x04, 0x01, 0x02, 0x11, 0x22, 0xff, 0x00, 0x33, 0xff, 0xd9]);
const riff = (...body) => new Uint8Array([...ascii("RIFF"), ...[body.length + 4, 0, 0, 0], ...ascii("WEBP"), ...body]);
const WEBP = riff(...ascii("VP8 "), 4, 0, 0, 0, 9, 9, 9, 9);
const withTail = (bytes, tail) => new Uint8Array([...bytes, ...tail]);
const EXE = ascii("MZ this program cannot be run in DOS mode");

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

test("a real picture with something appended after it is refused, whichever its type", async () => {
  const env = { BUILDS: makeStore() };
  assert.equal((await handle(upload(withTail(PNG, EXE)), env)).status, 415);
  assert.equal((await handle(upload(withTail(JPEG, EXE), "image/jpeg"), env)).status, 415);
  assert.equal((await handle(upload(withTail(WEBP, EXE), "image/webp"), env)).status, 415);
  assert.equal(env.BUILDS.kept.size, 0);
});

test("the three types are accepted whole, and a JPEG may carry zero padding or a second picture", async () => {
  const env = { BUILDS: makeStore() };
  assert.equal((await handle(upload(PNG), env)).status, 201);
  assert.equal((await handle(upload(JPEG, "image/jpeg"), env)).status, 201);
  assert.equal((await handle(upload(WEBP, "image/webp"), env)).status, 201);
  assert.equal((await handle(upload(withTail(JPEG, [0, 0, 0]), "image/jpeg"), env)).status, 201);
  assert.equal((await handle(upload(withTail(JPEG, JPEG), "image/jpeg"), env)).status, 201);
});

test("a picture is served with headers that stop a browser from treating it as anything else", async () => {
  const env = { BUILDS: makeStore() };
  const { url } = await (await handle(upload(PNG), env)).json();
  const read = await handle(new Request(url), env);
  assert.equal(read.headers.get("X-Content-Type-Options"), "nosniff");
  assert.match(read.headers.get("Content-Security-Policy"), /sandbox/);
  assert.equal(read.headers.get("Content-Disposition"), "inline");
});

test("anything stored with a type that is not a picture's is served as a download", async () => {
  const env = { BUILDS: makeStore() };
  const id = "z".repeat(32);
  await env.BUILDS.put(`image:${id}`, new Uint8Array(EXE).buffer, { metadata: { type: "text/html" } });
  const read = await handle(new Request(`https://api.bertinilabs.xyz/images/${id}`), env);
  assert.equal(read.headers.get("Content-Type"), "application/octet-stream");
  assert.equal(read.headers.get("Content-Disposition"), "attachment");
});

test("an unknown address is a 404 and a malformed one a 400", async () => {
  const env = { BUILDS: makeStore() };
  assert.equal((await handle(new Request(`https://api.bertinilabs.xyz/images/${"a".repeat(32)}`), env)).status, 404);
  assert.equal((await handle(new Request("https://api.bertinilabs.xyz/images/nope"), env)).status, 400);
});
