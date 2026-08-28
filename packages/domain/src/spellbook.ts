/**
 * The wizard's spellbook: what is *in* the book, as opposed to what is
 * prepared out of it.
 *
 * Every other caster has one list. The wizard has two, and they are not the
 * same size: the book is the wizard's whole repertoire, and the prepared list
 * is a handful chosen out of it each morning. A builder that offers only the
 * prepared list has silently deleted the class's defining feature — the player
 * cannot record the spell they paid 50 gp to copy, because there is nowhere to
 * put a spell they are not casting today.
 *
 * The size is not in the class table. Both editions state it in prose, in the
 * Spellbook feature, and both state the same numbers:
 *
 * > At 1st level, you have a spellbook containing six 1st-level wizard spells
 * > of your choice. — PHB, Wizard, Spellbook
 * > Each time you gain a wizard level, you can add two wizard spells of your
 * > choice to your spellbook. — PHB, Wizard, Your Spellbook
 *
 * > It starts with six level 1 Wizard spells of your choice. — XPHB
 * > Whenever you gain a Wizard level after 1, add two Wizard spells of your
 * > choice to your spellbook. — XPHB
 *
 * Both also bound the level: the added spells "must be of a level for which
 * you have spell slots", which is why the caller filters by slots rather than
 * by class level.
 *
 * Cantrips are deliberately absent. The book holds level 1 and up — "except
 * your cantrips, which are fixed in your mind" (PHB) — so a cantrip is picked
 * once and belongs to no book.
 */

import { resolveClassId } from "@bertinis-vault/data-engine";

/** Spells in the book at level 1, before any levelling adds to it. */
const STARTING_SPELLBOOK = 6;

/** Spells added per wizard level after the first. */
const SPELLS_PER_LEVEL = 2;

/**
 * The classes that learn from a book rather than from a list.
 *
 * One, in both editions. The Eldritch Knight and the Arcane Trickster cast
 * from the wizard *list* and are often mistaken for this, but they know their
 * spells outright — no book, nothing to copy into, and a fixed count from the
 * subclass table.
 */
export function hasSpellbook(classId: string): boolean {
  return resolveClassId(classId) === "wizard";
}

/**
 * How many spells the book holds at a wizard level, ignoring what was found or
 * copied in play.
 *
 * This is the guaranteed floor a character arrives at the table with. Copying
 * from scrolls and other wizards' books adds to it without limit, which is why
 * the builder treats this as a target and not as a ceiling to enforce after
 * import.
 */
export function spellbookSizeAt(level: number): number {
  const wizardLevel = Math.max(Math.trunc(level), 1);
  return STARTING_SPELLBOOK + SPELLS_PER_LEVEL * (wizardLevel - 1);
}
