/**
 * The picture on a character's book.
 *
 * A character travels as one JSON document through the account store, which
 * refuses anything over 128 KB, so the picture cannot be whatever the player
 * dropped in: a phone photo is several megabytes. It is cropped to the book's
 * proportions (2:3), scaled down and re-encoded until it fits, and stored as a
 * data URL inside the character.
 */

export const COVER_WIDTH = 480;
export const COVER_HEIGHT = 720;
/** Characters of data URL. About 75 KB of image, leaving the rest of the 128 KB to the character. */
export const MAX_COVER_CHARS = 100_000;
/** What the player may drop in, before it is shrunk. */
export const MAX_SOURCE_BYTES = 15 * 1024 * 1024;

const ACCEPTED = /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/;

export function isCoverImage(value: unknown): value is string {
  return typeof value === "string" && value.length <= MAX_COVER_CHARS && ACCEPTED.test(value);
}

/** The source rectangle that fills a 2:3 frame from the middle of the image. */
export function coverCrop(width: number, height: number): { x: number; y: number; w: number; h: number } {
  const target = COVER_WIDTH / COVER_HEIGHT;
  if (width / height > target) {
    const w = height * target;
    return { x: (width - w) / 2, y: 0, w, h: height };
  }
  const h = width / target;
  return { x: 0, y: (height - h) / 2, w: width, h };
}

export class CoverImageError extends Error {}

/**
 * Turns a dropped file into a cover, or says why it cannot.
 *
 * Tries WebP first and falls back to JPEG where the browser cannot encode it,
 * lowering the quality until the result fits.
 */
export async function fitCoverImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new CoverImageError("Eso no es una imagen.");
  if (file.size > MAX_SOURCE_BYTES) throw new CoverImageError("La imagen pesa más de 15 MB.");

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new CoverImageError("No pude leer esa imagen.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = COVER_WIDTH;
  canvas.height = COVER_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new CoverImageError("Este navegador no puede preparar la imagen.");
  const { x, y, w, h } = coverCrop(bitmap.width, bitmap.height);
  ctx.drawImage(bitmap, x, y, w, h, 0, 0, COVER_WIDTH, COVER_HEIGHT);
  bitmap.close();

  for (const type of ["image/webp", "image/jpeg"] as const) {
    for (const quality of [0.85, 0.75, 0.65, 0.55, 0.45, 0.35]) {
      const url = canvas.toDataURL(type, quality);
      // toDataURL answers PNG when it does not know the type asked for.
      if (!url.startsWith(`data:${type}`)) break;
      if (isCoverImage(url)) return url;
    }
  }
  throw new CoverImageError("No logré achicar la imagen lo suficiente. Probá con otra.");
}
