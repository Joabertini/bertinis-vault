/**
 * The pictures a player gives a character: the portrait and the token.
 *
 * Kept as the player uploaded them, byte for byte, so what reaches Foundry is
 * the original and not a copy shrunk to fit inside the build. A build carries
 * only the address; the Foundry module downloads it and stores it in the
 * world's own folder.
 *
 * Same store and same write limit as builds: no account is needed, as with the
 * Ritual. Unlike a build a picture does not expire, because a character saved
 * in an account keeps pointing at it long after its last publish.
 */

/** The largest picture accepted: the same 15 MB the builder already allowed before shrinking. */
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

/** What may be stored, by the type the body says it is. */
const ACCEPTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

/** The slice of Workers KV that pictures need: bytes in, bytes out, with their type. */
export type ImageStore = {
  put(key: string, value: ArrayBuffer, options?: { metadata?: unknown }): Promise<void>;
  getWithMetadata(key: string, type: "arrayBuffer"): Promise<{ value: ArrayBuffer | null; metadata: unknown }>;
};

const ID = /^[A-Za-z0-9_-]{32}$/;

export const imageKey = (id: string) => `image:${id}`;

/** Whether the bytes start the way their declared type does. A type alone is only a claim. */
export function looksLike(type: string, bytes: Uint8Array): boolean {
  const starts = (...sig: number[]) => sig.every((value, index) => bytes[index] === value);
  if (type === "image/png") return starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
  if (type === "image/jpeg") return starts(0xff, 0xd8, 0xff);
  if (type === "image/webp") return starts(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  return false;
}

function newId(random: Crypto = crypto): string {
  const bytes = new Uint8Array(24);
  random.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const json = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

export async function handleImageUpload(
  request: Request,
  store: ImageStore,
  headers: Record<string, string>,
): Promise<Response> {
  const type = (request.headers.get("Content-Type") ?? "").split(";")[0]!.trim().toLowerCase();
  if (!ACCEPTED_TYPES.has(type)) {
    return json({ error: "Only PNG, JPEG or WebP pictures are stored." }, 415, headers);
  }
  const declared = Number(request.headers.get("Content-Length") ?? "0");
  if (declared > MAX_IMAGE_BYTES) {
    return json({ error: `A picture is at most ${MAX_IMAGE_BYTES} bytes.` }, 413, headers);
  }
  const body = await request.arrayBuffer();
  if (body.byteLength === 0) return json({ error: "The picture is empty." }, 400, headers);
  if (body.byteLength > MAX_IMAGE_BYTES) {
    return json({ error: `A picture is at most ${MAX_IMAGE_BYTES} bytes.` }, 413, headers);
  }
  if (!looksLike(type, new Uint8Array(body, 0, Math.min(16, body.byteLength)))) {
    return json({ error: "That file is not the picture its type says it is." }, 415, headers);
  }

  const id = newId();
  await store.put(imageKey(id), body, { metadata: { type } });
  const url = `${new URL(request.url).origin}/images/${id}`;
  return json({ url }, 201, headers);
}

export async function handleImageRead(id: string, store: ImageStore, headers: Record<string, string>): Promise<Response> {
  if (!ID.test(id)) return json({ error: "Not a picture address." }, 400, headers);
  const { value, metadata } = await store.getWithMetadata(imageKey(id), "arrayBuffer");
  if (value === null) return json({ error: "No picture at that address." }, 404, headers);
  const type = (metadata as { type?: string } | null)?.type ?? "application/octet-stream";
  return new Response(value, {
    status: 200,
    headers: {
      ...headers,
      // Anyone holding the address may show it, from any page: Foundry's
      // origin is whatever the table's server is called.
      "Access-Control-Allow-Origin": "*",
      "Content-Type": type,
      // An address never changes what it points at.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
