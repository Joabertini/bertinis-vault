/**
 * The half of the cover that needs a browser: a canvas to shrink the picture and
 * `fetch` to read a portrait. The limits and the check live in the package.
 */

import { CoverImageError, MAX_SOURCE_BYTES, isCoverImage } from "@bertinis-vault/forge/cover-image";

import { vaultBaseUrl } from "./vault-client";

export * from "@bertinis-vault/forge/cover-image";

/** The types the build store keeps as they are. Anything else is converted to PNG, which loses nothing. */
const KEPT_AS_IS = new Set(["image/png", "image/jpeg", "image/webp"]);

/** A picture the store does not keep as it is (GIF, BMP, AVIF...), as a PNG of the same pixels. */
async function asPng(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new CoverImageError("No pude leer esa imagen.");
  }
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new CoverImageError("Este navegador no puede preparar la imagen.");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new CoverImageError("No pude preparar la imagen."))), "image/png"),
  );
}

/**
 * Stores a dropped picture as it is and gives back its address.
 *
 * The original goes to the build store (`POST /images`) without being cropped
 * or re-encoded, so what reaches Foundry is the picture the player chose. The
 * character keeps only the address. The name stays from when this shrank the
 * picture into the character, so every caller keeps working.
 */
export async function fitCoverImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new CoverImageError("Eso no es una imagen.");
  if (file.size > MAX_SOURCE_BYTES) throw new CoverImageError("La imagen pesa más de 15 MB.");

  const body: Blob = KEPT_AS_IS.has(file.type) ? file : await asPng(file);
  let response: Response;
  try {
    response = await fetch(`${vaultBaseUrl()}/images`, {
      method: "POST",
      headers: { "Content-Type": body.type },
      body,
    });
  } catch {
    throw new CoverImageError("No pude subir la imagen. Revisá la conexión.");
  }
  if (response.status === 429) throw new CoverImageError("Demasiadas subidas seguidas. Esperá un minuto.");
  if (!response.ok) throw new CoverImageError("El almacén no aceptó la imagen.");
  const { url } = (await response.json()) as { url?: string };
  if (!isCoverImage(url)) throw new CoverImageError("El almacén respondió algo raro.");
  return url;
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
