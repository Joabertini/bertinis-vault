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

/**
 * A picture stored whole in the build store (`POST /images`), by its address.
 *
 * The portrait and the token travel this way now: the original, not a copy
 * shrunk to fit inside the character. The data URL form above stays accepted so
 * characters saved before keep their cover.
 */
const STORED = /^https?:\/\/[^\s/]+\/images\/[A-Za-z0-9_-]{32}$/;

export function isStoredImage(value: unknown): value is string {
  return typeof value === "string" && value.length <= 300 && STORED.test(value);
}

export function isCoverImage(value: unknown): value is string {
  if (isStoredImage(value)) return true;
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
