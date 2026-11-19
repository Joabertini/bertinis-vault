/**
 * With TURNSTILE_SECRET set, publishing and uploading need a token Cloudflare vouches for. Without it
 * nothing changes. If Cloudflare cannot be asked, the write goes through.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { handle } from "../dist/handler.js";
import { checkTurnstile } from "../dist/turnstile.js";

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

const upload = (headers = {}) =>
  new Request("https://api.bertinilabs.xyz/images", {
    method: "POST",
    headers: { "Content-Type": "image/png", "CF-Connecting-IP": "203.0.113.9", ...headers },
    body: PNG,
  });

/** Cloudflare's siteverify, answering `success` and remembering what it was asked. */
function cloudflareSays(success) {
  const asked = [];
  const fetchImpl = async (url, init) => {
    asked.push({ url: String(url), body: new URLSearchParams(init.body) });
    return new Response(JSON.stringify({ success }), { status: 200 });
  };
  return { asked, fetchImpl };
}

const env = () => ({ BUILDS: makeKv(), TURNSTILE_SECRET: "the-secret" });

test("a write with no token is refused, and nothing is stored", async () => {
  const e = env();
  const { fetchImpl } = cloudflareSays(true);
  const response = await handle(upload(), e, { fetchImpl });

  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, "turnstile_required");
  assert.equal(e.BUILDS.kept.size, 0);
});

test("a token Cloudflare rejects is refused", async () => {
  const e = env();
  const { fetchImpl } = cloudflareSays(false);
  const response = await handle(upload({ "X-Turnstile-Token": "bad" }), e, { fetchImpl });

  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, "turnstile_failed");
  assert.equal(e.BUILDS.kept.size, 0);
});

test("a token Cloudflare accepts lets the write through, and Cloudflare is asked with the secret and the caller", async () => {
  const e = env();
  const { asked, fetchImpl } = cloudflareSays(true);
  const response = await handle(upload({ "X-Turnstile-Token": "good" }), e, { fetchImpl });

  assert.equal(response.status, 201);
  assert.equal(asked.length, 1);
  assert.match(asked[0].url, /challenges\.cloudflare\.com\/turnstile\/v0\/siteverify$/);
  assert.equal(asked[0].body.get("secret"), "the-secret");
  assert.equal(asked[0].body.get("response"), "good");
  assert.equal(asked[0].body.get("remoteip"), "203.0.113.9");
});

test("when Cloudflare cannot be reached the write goes through", async () => {
  const e = env();
  const fetchImpl = async () => {
    throw new Error("network down");
  };
  const response = await handle(upload({ "X-Turnstile-Token": "whatever" }), e, { fetchImpl });

  assert.equal(response.status, 201);
});

test("without the secret nothing is asked for", async () => {
  const e = { BUILDS: makeKv() };
  const { asked, fetchImpl } = cloudflareSays(false);
  const response = await handle(upload(), e, { fetchImpl });

  assert.equal(response.status, 201);
  assert.equal(asked.length, 0);
});

test("reading a picture never needs a token", async () => {
  const e = { BUILDS: makeKv() };
  const { url } = await (await handle(upload(), e)).json();
  const read = await handle(new Request(url), { ...e, TURNSTILE_SECRET: "the-secret" });

  assert.equal(read.status, 200);
});

test("the token header is one the browser is allowed to send across origins", async () => {
  const preflight = await handle(
    new Request("https://api.bertinilabs.xyz/images", {
      method: "OPTIONS",
      headers: { Origin: "https://alba.bertinilabs.xyz", "Access-Control-Request-Method": "POST" },
    }),
    { BUILDS: makeKv(), ALLOWED_ORIGINS: "https://alba.bertinilabs.xyz" },
  );

  assert.match(preflight.headers.get("Access-Control-Allow-Headers") ?? "", /X-Turnstile-Token/);
});

test("checkTurnstile tells 'no' apart from 'could not ask'", async () => {
  assert.equal(await checkTurnstile("s", "t", null, async () => new Response(JSON.stringify({ success: true }))), "ok");
  assert.equal(await checkTurnstile("s", "t", null, async () => new Response(JSON.stringify({ success: false }))), "failed");
  assert.equal(await checkTurnstile("s", "t", null, async () => new Response("oops", { status: 500 })), "unavailable");
  assert.equal(await checkTurnstile("s", "t", null, async () => new Response("not json")), "unavailable");
  assert.equal(
    await checkTurnstile("s", "t", null, async () => {
      throw new Error("down");
    }),
    "unavailable",
  );
});
