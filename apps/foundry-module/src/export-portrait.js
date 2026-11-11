/**
 * The other direction: a Foundry actor, out to the Vault, with its picture.
 *
 * Foundry's own "Export Data" writes the actor's portrait as a path inside the
 * server's Data folder (`assets/Tokens PCs/Rathma.jpg`) and not the picture, so
 * a file that leaves Foundry that way cannot show its picture anywhere else:
 * the server is behind its own gate and the path means nothing outside it.
 *
 * This runs in the player's browser, which can read that picture, and writes it
 * into the exported file. It is shrunk to the size the Vault stores (a 2:3 cover
 * that fits the account store's per-character limit) and kept in a module flag,
 * so the actor itself is never touched.
 *
 * The cover rules mirror `apps/web/src/lib/cover-image.ts`. They are
 * deliberately the same numbers: the Vault drops anything larger.
 */

export const COVER_WIDTH = 480;
export const COVER_HEIGHT = 720;
/** Characters of data URL; the Vault refuses a cover longer than this. */
export const MAX_COVER_CHARS = 100_000;

const IMAGE_FILE = /\.(webp|png|jpe?g|gif|avif)$/i;
const DEFAULT_IMAGE = /^(icons|systems)\//i;

/** Whether `src` is a picture of the actor's own rather than one of Foundry's stock icons. */
export function isOwnPicture(src) {
  if (typeof src !== "string") return false;
  const path = src.trim().split("?")[0];
  if (!path || DEFAULT_IMAGE.test(path) || path.toLowerCase().endsWith(".svg")) return false;
  return IMAGE_FILE.test(path);
}

/** The picture to export: the sheet's portrait, or the token's when there is none. */
export function pickPortrait(actor) {
  return [actor?.img, actor?.prototypeToken?.texture?.src].find(isOwnPicture) ?? null;
}

/** The source rectangle that fills a 2:3 frame from the middle of the picture. */
export function coverCrop(width, height) {
  const target = COVER_WIDTH / COVER_HEIGHT;
  if (width / height > target) {
    const w = height * target;
    return { x: (width - w) / 2, y: 0, w, h: height };
  }
  const h = width / target;
  return { x: 0, y: (height - h) / 2, w: width, h };
}

export function isCoverDataUrl(value) {
  return (
    typeof value === "string" &&
    value.length <= MAX_COVER_CHARS &&
    /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(value)
  );
}

/** The exported data with the picture in this module's flag. The input is not changed. */
export function withPortrait(data, moduleId, dataUrl) {
  if (!isCoverDataUrl(dataUrl)) return data;
  return {
    ...data,
    flags: { ...(data.flags ?? {}), [moduleId]: { ...(data.flags?.[moduleId] ?? {}), portrait: dataUrl } },
  };
}

/** Same naming as Foundry's own export, so the file looks like the ones players already have. */
export function exportFileName(actor) {
  const slug = String(actor?.name ?? "actor")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `fvtt-Actor-${slug || "actor"}-${actor?.id ?? "x"}.json`;
}

/**
 * The picture as a small data URL, or null when it cannot be had.
 *
 * WebP first, JPEG where the browser cannot write it, lowering the quality
 * until the result fits. Everything that can fail here (a missing file, a
 * format the browser cannot decode) answers null: the export goes ahead
 * without the picture rather than not at all.
 */
export async function portraitDataUrl(src, route = (path) => path) {
  try {
    const url = /^(https?:|data:)/i.test(src) ? src : route(encodeURI(decodeURI(src)));
    const response = await fetch(url);
    if (!response.ok) return null;
    const bitmap = await createImageBitmap(await response.blob());

    const canvas = document.createElement("canvas");
    canvas.width = COVER_WIDTH;
    canvas.height = COVER_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const { x, y, w, h } = coverCrop(bitmap.width, bitmap.height);
    ctx.drawImage(bitmap, x, y, w, h, 0, 0, COVER_WIDTH, COVER_HEIGHT);
    bitmap.close();

    for (const type of ["image/webp", "image/jpeg"]) {
      for (const quality of [0.85, 0.75, 0.65, 0.55, 0.45, 0.35]) {
        const out = canvas.toDataURL(type, quality);
        if (!out.startsWith(`data:${type}`)) break;
        if (isCoverDataUrl(out)) return out;
      }
    }
    return null;
  } catch (error) {
    console.warn("bertinis-vault | portrait could not be read:", error);
    return null;
  }
}
