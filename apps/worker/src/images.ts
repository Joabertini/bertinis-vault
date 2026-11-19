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

const u32be = (b: Uint8Array, at: number) => ((b[at]! << 24) | (b[at + 1]! << 16) | (b[at + 2]! << 8) | b[at + 3]!) >>> 0;
const u32le = (b: Uint8Array, at: number) => (b[at]! | (b[at + 1]! << 8) | (b[at + 2]! << 16) | (b[at + 3]! << 24)) >>> 0;

/** A PNG is its signature, a run of length-prefixed chunks that opens with IHDR, and IEND as the very last thing. */
function wholePng(bytes: Uint8Array): boolean {
  let at = 8;
  let first = true;
  while (at + 12 <= bytes.length) {
    const length = u32be(bytes, at);
    const name = String.fromCharCode(bytes[at + 4]!, bytes[at + 5]!, bytes[at + 6]!, bytes[at + 7]!);
    if (!/^[A-Za-z]{4}$/.test(name)) return false;
    if (first && (name !== "IHDR" || length !== 13)) return false;
    first = false;
    const end = at + 12 + length;
    if (end > bytes.length) return false;
    if (name === "IEND") return length === 0 && end === bytes.length;
    at = end;
  }
  return false;
}

/** A RIFF container says how long it is: anything past that is not part of the picture. */
function wholeWebp(bytes: Uint8Array): boolean {
  if (bytes.length < 20) return false;
  const declared = u32le(bytes, 4) + 8;
  if (bytes.length !== declared && bytes.length !== declared + 1) return false;
  const first = String.fromCharCode(bytes[12]!, bytes[13]!, bytes[14]!, bytes[15]!);
  return first === "VP8 " || first === "VP8L" || first === "VP8X";
}

/**
 * A JPEG is segments up to the scan, then entropy-coded data until the end-of-image marker. After that marker
 * only zero padding or the next picture of a multi-picture file (it opens with FFD8 again) may follow.
 */
function wholeJpeg(bytes: Uint8Array): boolean {
  let at = 0;
  while (at < bytes.length) {
    if (bytes[at] !== 0xff || bytes[at + 1] !== 0xd8) return false;
    at += 2;
    let ended = false;
    while (at + 1 < bytes.length && !ended) {
      if (bytes[at] !== 0xff) return false;
      const marker = bytes[at + 1]!;
      if (marker === 0xff) {
        at += 1;
        continue;
      }
      if (marker === 0xd9) {
        at += 2;
        ended = true;
        continue;
      }
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        at += 2;
        continue;
      }
      if (at + 4 > bytes.length) return false;
      const length = (bytes[at + 2]! << 8) | bytes[at + 3]!;
      if (length < 2) return false;
      at += 2 + length;
      if (marker === 0xda) {
        // Entropy-coded data: FF00 is a stuffed byte, FFD0-D7 a restart; any other marker ends the run.
        while (at + 1 < bytes.length) {
          if (bytes[at] === 0xff && bytes[at + 1] !== 0 && !(bytes[at + 1]! >= 0xd0 && bytes[at + 1]! <= 0xd7) && bytes[at + 1] !== 0xff) break;
          at += 1;
        }
      }
    }
    if (!ended) return false;
    while (at < bytes.length && bytes[at] === 0) at += 1;
    if (at < bytes.length && !(bytes[at] === 0xff && bytes[at + 1] === 0xd8)) return false;
  }
  return true;
}

/**
 * Whether the whole file is that picture and nothing else. The first bytes alone let through a real picture with
 * anything appended after it (a "polyglot"): harmless to a browser, but it would turn this store into a free host
 * for whatever a stranger wants to hide behind a picture's name.
 */
export function isWholePicture(type: string, bytes: Uint8Array): boolean {
  if (type === "image/png") return wholePng(bytes);
  if (type === "image/jpeg") return wholeJpeg(bytes);
  if (type === "image/webp") return wholeWebp(bytes);
  return false;
}

const joined = (parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
};

/** PNG chunks that say where and when a picture was taken, or carry free text. The pixels are in none of them. */
const PNG_METADATA = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"]);

function stripPng(bytes: Uint8Array): Uint8Array {
  const parts = [bytes.subarray(0, 8)];
  let at = 8;
  while (at + 12 <= bytes.length) {
    const end = at + 12 + u32be(bytes, at);
    const name = String.fromCharCode(bytes[at + 4]!, bytes[at + 5]!, bytes[at + 6]!, bytes[at + 7]!);
    if (!PNG_METADATA.has(name)) parts.push(bytes.subarray(at, end));
    at = end;
  }
  return joined(parts);
}

/** The orientation a camera recorded (1 to 8), read from an EXIF segment; 1 when there is none worth keeping. */
function exifOrientation(segment: Uint8Array): number {
  const isExif = [0x45, 0x78, 0x69, 0x66, 0, 0].every((value, index) => segment[4 + index] === value);
  if (!isExif) return 1;
  const tiff = segment.subarray(10);
  const little = tiff[0] === 0x49;
  const at16 = (at: number) => (at + 2 > tiff.length ? 0 : little ? tiff[at]! | (tiff[at + 1]! << 8) : (tiff[at]! << 8) | tiff[at + 1]!);
  const at32 = (at: number) => (at + 4 > tiff.length ? 0 : little ? (at16(at) | (at16(at + 2) << 16)) >>> 0 : ((at16(at) << 16) | at16(at + 2)) >>> 0);
  const ifd = at32(4);
  const entries = at16(ifd);
  for (let index = 0; index < entries; index += 1) {
    const entry = ifd + 2 + index * 12;
    if (entry + 12 > tiff.length) break;
    if (at16(entry) === 0x0112) {
      const value = at16(entry + 8);
      return value >= 2 && value <= 8 ? value : 1;
    }
  }
  return 1;
}

/** An EXIF segment that says only how the picture is turned, so it still shows the right way up. */
const orientationOnly = (orientation: number): Uint8Array =>
  new Uint8Array([
    0xff, 0xe1, 0x00, 0x22, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08,
    0x00, 0x01, 0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, orientation, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
  ]);

/**
 * The segments before the first scan, without EXIF/XMP (APP1), Photoshop (APP13) or comments, and with the
 * orientation kept. The scan itself, where the pixels are, is copied as it came. Only the first picture of a
 * multi-picture file is cleaned: the others are the small previews a camera adds.
 */
function stripJpeg(bytes: Uint8Array): Uint8Array {
  const parts = [bytes.subarray(0, 2)];
  let orientation = 1;
  let at = 2;
  while (at + 4 <= bytes.length && bytes[at] === 0xff) {
    const marker = bytes[at + 1]!;
    if (marker === 0xda || marker === 0xd9) break;
    if (marker === 0xff) {
      at += 1;
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      parts.push(bytes.subarray(at, at + 2));
      at += 2;
      continue;
    }
    const end = at + 2 + ((bytes[at + 2]! << 8) | bytes[at + 3]!);
    if (end > bytes.length) break;
    const segment = bytes.subarray(at, end);
    if (marker === 0xe1) orientation = Math.max(orientation, exifOrientation(segment) > 1 ? exifOrientation(segment) : 1);
    if (marker !== 0xe1 && marker !== 0xed && marker !== 0xfe) parts.push(segment);
    at = end;
  }
  if (orientation > 1) parts.splice(parts.length > 1 && parts[1]![1] === 0xe0 ? 2 : 1, 0, orientationOnly(orientation));
  parts.push(bytes.subarray(at));
  return joined(parts);
}

/** WebP carries EXIF and XMP as chunks of their own, and says so in the flags of its VP8X header. */
function stripWebp(bytes: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [];
  let at = 12;
  while (at + 8 <= bytes.length) {
    const name = String.fromCharCode(bytes[at]!, bytes[at + 1]!, bytes[at + 2]!, bytes[at + 3]!);
    const size = u32le(bytes, at + 4);
    const end = Math.min(at + 8 + size + (size & 1), bytes.length);
    if (name !== "EXIF" && name !== "XMP ") {
      const chunk = bytes.slice(at, end);
      if (name === "VP8X" && chunk.length > 8) chunk[8] = chunk[8]! & ~0x0c;
      parts.push(chunk);
    }
    at = end;
  }
  const body = joined(parts);
  const out = new Uint8Array(12 + body.length);
  out.set(bytes.subarray(0, 4), 0);
  new DataView(out.buffer).setUint32(4, 4 + body.length, true);
  out.set(bytes.subarray(8, 12), 8);
  out.set(body, 12);
  return out;
}

/**
 * The same picture without what its camera or editor wrote into it: location, time, device, free text. The
 * pixels are not touched or recompressed. The address of a picture is public, so a photo's GPS would be too.
 */
export function stripMetadata(type: string, bytes: Uint8Array): Uint8Array {
  if (type === "image/png") return stripPng(bytes);
  if (type === "image/jpeg") return stripJpeg(bytes);
  if (type === "image/webp") return stripWebp(bytes);
  return bytes;
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
  if (!isWholePicture(type, new Uint8Array(body))) {
    return json({ error: "That file carries more than the picture: it is refused." }, 415, headers);
  }

  const clean = stripMetadata(type, new Uint8Array(body));
  if (!isWholePicture(type, clean)) return json({ error: "That picture could not be cleaned." }, 422, headers);

  const id = newId();
  await store.put(imageKey(id), clean.slice().buffer as ArrayBuffer, { metadata: { type } });
  const url = `${new URL(request.url).origin}/images/${id}`;
  return json({ url }, 201, headers);
}

export async function handleImageRead(id: string, store: ImageStore, headers: Record<string, string>): Promise<Response> {
  if (!ID.test(id)) return json({ error: "Not a picture address." }, 400, headers);
  const { value, metadata } = await store.getWithMetadata(imageKey(id), "arrayBuffer");
  if (value === null) return json({ error: "No picture at that address." }, 404, headers);
  const declared = (metadata as { type?: string } | null)?.type ?? "";
  // Only a type this store accepts is ever served as a picture; anything else is a download, never rendered.
  const safe = ACCEPTED_TYPES.has(declared);
  const type = safe ? declared : "application/octet-stream";
  return new Response(value, {
    status: 200,
    headers: {
      ...headers,
      // The browser must take the type as given, and a picture has no business running or embedding anything.
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Content-Disposition": safe ? "inline" : "attachment",
      "Cross-Origin-Resource-Policy": "cross-origin",
      // Anyone holding the address may show it, from any page: Foundry's
      // origin is whatever the table's server is called.
      "Access-Control-Allow-Origin": "*",
      "Content-Type": type,
      // An address never changes what it points at.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
