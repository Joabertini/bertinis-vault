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
 */

/** Chamber and section labels: small, letter-spaced, gold. */
export const LABEL = "font-mono text-[10px] uppercase tracking-[0.35em] text-gold/70";

/** The same label with the two gaps it is given above the content it names. */
export const LABEL_MB2 = `mb-2 ${LABEL}`;
export const LABEL_MB4 = `mb-4 ${LABEL}`;

/** Heading inside a panel — smaller than a chamber title, louder than body. */
export const HEADING = "font-display text-sm font-bold";

/** A full route: the Void behind everything, nothing allowed to spill out. */
export const PAGE = "relative min-h-screen overflow-hidden bg-void";

/** The rule that separates one block of a page from the next. */
export const DIVIDER = "border-t border-iron/40 pt-8";
export const DIVIDER_TIGHT = "border-t border-iron/40 pt-6";

/** Asides and hints: the quietest text on screen, and never load-bearing. */
export const WHISPER = "font-body text-xs italic text-bone/30";
export const WHISPER_MB4 = `mb-4 ${WHISPER}`;

/** Numbers and codes, where the eye needs a fixed advance. */
export const META = "font-mono text-[10px] tracking-[0.2em]";

/** A row in a list of things owned: the name, then what it is. */
export const ITEM_NAME = "truncate font-body text-[15px]";
export const ITEM_META =
  "shrink-0 font-mono text-[9px] uppercase tracking-[0.2em] text-bone/30";
