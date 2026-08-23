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
};

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

function corsHeaders(env: Env, request: Request): Record<string, string> {
  const allowed = (env.ALLOWED_ORIGINS ?? "*").split(",").map((o) => o.trim());
  const origin = request.headers.get("Origin");

  const allowOrigin =
    allowed.includes("*") ? "*" : origin && allowed.includes(origin) ? origin : allowed[0] ?? "";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
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

export async function handle(request: Request, env: Env): Promise<Response> {
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

  const match = /^\/builds\/([^/]+)$/.exec(url.pathname);
  if (match && request.method === "GET") {
    return handleRead(decodeURIComponent(match[1] as string), env, headers);
  }

  return error("Not found.", 404, headers);
}

export default {
  fetch: handle,
};
