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
 * THE CONTRAST FLOOR — read before dimming anything.
 *
 * Bone is `#E6DFCE` and the ground is `#030202`, so an opacity is a contrast
 * ratio. Measured against the Void:
 *
 *     text-bone      15.4:1     text-bone/60      6.0:1
 *     text-bone/75    9.3:1     text-bone/45      3.8:1  ← under AA
 *     text-gold       6.4:1     text-gold/60      3.0:1  ← under AA
 *
 * WCAG AA for body text is 4.5:1. The interface used to sit at /30 (2.2:1)
 * for every aside and gold/60 for every label, which is why the page read as
 * washed out rather than as atmospheric: the whole supporting layer was below
 * the threshold at which text is text.
 *
 * The ramp is four steps and stops at /60 for anything a player has to read:
 *
 *     text-bone       a value, a name, a heading
 *     text-bone/75    prose
 *     text-bone/60    supporting lines, meta, the quietest readable thing
 *     text-bone/45    disabled controls and decoration ONLY, never a sentence
 *
 * Italics are not part of the ramp. EB Garamond's italic is a true cursive
 * with a steep slope and thin joins; at 12px, dimmed, on black it is the
 * single worst thing on the page. Italic is for the epigraphs and the flavour
 * lines set at `text-lg` and up — never for a hint, a label or a warning.
 */

/** Chamber and section labels: small, letter-spaced, gold. */
export const LABEL = "font-mono text-[11px] uppercase tracking-[0.25em] text-gold";

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

/**
 * Asides and hints: the quietest text on screen, and still readable.
 *
 * Upright, 13px and /60. The name is the old one because it is used in forty
 * places; the volume is not — a whisper nobody can hear is not a whisper.
 */
export const WHISPER = "font-body text-[13px] leading-relaxed text-bone/60";
export const WHISPER_MB4 = `mb-4 ${WHISPER}`;

/** Numbers and codes, where the eye needs a fixed advance. */
export const META = "font-mono text-[10px] tracking-[0.2em]";

/** A row in a list of things owned: the name, then what it is. */
export const ITEM_NAME = "truncate font-body text-[15px]";
export const ITEM_META =
  "shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] text-bone/60";
