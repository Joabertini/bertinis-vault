/**
 * The named Tailwind recipes the interface repeats.
 *
 * Only strings that appear three or more times *and* carry a design decision
 * live here. Pure layout that happens to repeat — `flex flex-wrap gap-2` — is
 * deliberately left inline: naming it would hide a Tailwind idiom behind an
 * indirection without making anything easier to change.
 *
 * These are shared rather than split per folder because the Forge, the Codex
 * and the routes all set a chamber label the same way. Three copies of the
 * same recipe is the problem this file exists to remove, not a shape to keep.
 *
 * Tailwind scans `src/**\/*.{ts,tsx}`, so the classes stay visible to the
 * purge from here.
 *
 * ---------------------------------------------------------------------------
 * THE CONTRAST RULE — read before dimming anything.
 *
 * The ground is pure black (`void`, #000) and every word a player reads is
 * pure white (`bone`, #FFF): names, descriptions, modifiers, hints. No
 * opacity on readable text. Gold (#F2C14E, 12.5:1) is for headings and what is
 * selected; ember (#FF7043, 7.7:1) for warnings; class tints are kept at 7:1
 * or better. Opacity is for decoration and disabled controls only.
 *
 * Sizes: nothing a player reads is under 13px; prose is 15px and up.
 * Italic is for large flavour lines only, never for a hint or a description.
 * Numbers use `font-num` (EB Garamond, lining figures): Cinzel's 1 is a Roman I.
 */

/** Chamber and section labels: small, letter-spaced, gold. */
export const LABEL = "font-mono text-[14px] uppercase tracking-[0.1em] text-gold";

/** The same label with the two gaps it is given above the content it names. */
export const LABEL_MB2 = `mb-2 ${LABEL}`;
export const LABEL_MB4 = `mb-4 ${LABEL}`;

/** Heading inside a panel — smaller than a chamber title, louder than body. */
export const HEADING = "font-display text-[15px] font-bold";

/** A full route: the Void behind everything, nothing allowed to spill out. */
export const PAGE = "relative min-h-screen overflow-hidden bg-void";

/** The rule that separates one block of a page from the next. */
export const DIVIDER = "border-t border-iron/40 pt-8";
export const DIVIDER_TIGHT = "border-t border-iron/40 pt-6";

/**
 * Asides and hints: the quietest text on screen, and still readable.
 *
 * Upright, 13px and /60. The name is the old one because it is used in forty
 * places; the volume is not — a whisper nobody can hear is not a whisper.
 */
export const WHISPER = "font-body text-[15px] leading-relaxed text-bone";
export const WHISPER_MB4 = `mb-4 ${WHISPER}`;

/** Numbers and codes, where the eye needs a fixed advance. */
export const META = "font-mono text-[13px] tracking-[0.1em]";

/** A row in a list of things owned: the name, then what it is. */
export const ITEM_NAME = "truncate font-body text-[15px]";
export const ITEM_META =
  "shrink-0 font-mono text-[13px] uppercase tracking-[0.1em] text-bone";
