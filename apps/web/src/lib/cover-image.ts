/**
 * The half of the cover that needs a browser: a canvas to shrink the picture and
 * `fetch` to read a portrait. The limits and the check live in the package.
 */

import {
  COVER_HEIGHT,
  COVER_WIDTH,
  CoverImageError,
  MAX_SOURCE_BYTES,
  coverCrop,
  isCoverImage,
} from "@bertinis-vault/forge/cover-image";

export * from "@bertinis-vault/forge/cover-image";

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

/**
 * The cover for a picture an imported actor points at, or null when it cannot
 * be had from here.
 *
 * A `data:` URL always can. An absolute URL can when its server allows this
 * page to read it. A path inside a Foundry server's Data folder never can: the
 * server sits behind its own gate, so the player supplies the file instead.
 */
export async function coverFromPortrait(src: string): Promise<string | null> {
  if (!src.startsWith("data:image/") && !/^https?:\/\//i.test(src)) return null;
  try {
    const response = await fetch(src);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await fitCoverImage(new File([blob], "retrato", { type: blob.type || "image/png" }));
  } catch {
    return null;
  }
}
