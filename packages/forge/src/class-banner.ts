/**
 * The banner across the top of a character's sheet.
 *
 * Foundry paints the same art for every character; here each class gets its own
 * (approved 2026-11-17): a gradient of the class's colour with its sigil cut
 * into it like an engraving, not laid on top. A player may upload their own
 * instead, kept whole in the build store; that is the one the sheet shows and
 * the one Nerissa's `/showpj` card will print.
 *
 * The SVG is a string so it can be a CSS background, a data URL or a file.
 */

import { CLASS_SIGILS, type ClassSigilArt } from "./class-sigils";
import { isStoredImage } from "./cover-image";

/** The size Foundry's character header is drawn for. */
export const BANNER_WIDTH = 1391;
export const BANNER_HEIGHT = 510;

/** Darken (factor < 1) or lighten toward white (factor > 1) a #rrggbb colour. */
export function shadeColor(hex: string, factor: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `#${[n >> 16, (n >> 8) & 255, n & 255]
    .map((v) => Math.round(factor < 1 ? v * factor : v + (255 - v) * (factor - 1)))
    .map((v) => Math.min(255, Math.max(0, v)).toString(16).padStart(2, "0"))
    .join("")}`;
}

/** Neutral art for a character with no class yet: the gold of the Forge, no sigil. */
const NO_CLASS = "#c9a46a";

/**
 * The default banner for a class, as SVG markup.
 *
 * The sigil sits at the middle of the banner, three steps (60 units) to the
 * right, as approved. The engraving is three passes of the same stroke: a dark
 * shadow on the upper edge, a light catch on the lower one, and the groove's
 * floor darker than the plate.
 */
export function classBannerSvg(classId: string): string {
  const art: ClassSigilArt | undefined = CLASS_SIGILS[classId.trim().toLowerCase()];
  const color = art?.color ?? NO_CLASS;
  const scale = 1.15;
  const x = Math.round((BANNER_WIDTH - 512 * scale) / 2) + 60;

  const groove = (stroke: string, width: number) => {
    const path = art
      ? `<path d="${art.glyph}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`
      : "";
    return art?.fillCircle
      ? `<g clip-path="url(#cc)"><g transform="translate(256 256) scale(${art.fillCircle}) translate(-256 -256)">${path}</g></g>`
      : path;
  };

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${BANNER_WIDTH}" height="${BANNER_HEIGHT}" viewBox="0 0 ${BANNER_WIDTH} ${BANNER_HEIGHT}">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="0.35"><stop offset="0" stop-color="${shadeColor(color, 0.22)}"/><stop offset="0.5" stop-color="${shadeColor(color, 0.45)}"/><stop offset="1" stop-color="${shadeColor(color, 0.85)}"/></linearGradient>
<radialGradient id="v" cx="70%" cy="40%" r="80%"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></radialGradient>
<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .14 0"/></filter>
<filter id="lo" x="-10%" y="-10%" width="120%" height="120%"><feOffset dx="-2.2" dy="-2.2"/><feGaussianBlur stdDeviation="1.2"/></filter>
<filter id="hi" x="-10%" y="-10%" width="120%" height="120%"><feOffset dx="2" dy="2"/><feGaussianBlur stdDeviation="1"/></filter>
<clipPath id="cc"><circle cx="256" cy="256" r="256"/></clipPath>
</defs>
<rect width="${BANNER_WIDTH}" height="${BANNER_HEIGHT}" fill="url(#g)"/>
<rect width="${BANNER_WIDTH}" height="${BANNER_HEIGHT}" filter="url(#grain)"/>
<g transform="translate(${x} -40) scale(${scale})">
<g filter="url(#lo)" opacity=".9">${groove("#000", 16)}</g>
<g filter="url(#hi)" opacity=".55">${groove(shadeColor(color, 1.6), 11)}</g>
<g opacity=".95">${groove(shadeColor(color, 0.18), 12)}</g>
<g opacity=".22">${groove(color, 3)}</g>
</g>
<rect width="${BANNER_WIDTH}" height="${BANNER_HEIGHT}" fill="url(#v)"/>
</svg>`;
}

/** The default banner as a URL an <img> or a CSS background can use. */
export function classBannerUrl(classId: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(classBannerSvg(classId))}`;
}

/** The banner a character shows: the one the player uploaded, or their class's. */
export function bannerFor(state: { bannerImage: string; classId: string }): string {
  return isStoredImage(state.bannerImage) ? state.bannerImage : classBannerUrl(state.classId);
}
