/**
 * The warlock's Mystic Arcanum: spells cast without a slot, because a warlock
 * never has one that high.
 *
 * A warlock's pact slots stop at fifth level and there are only ever a handful
 * of them, so the top four spell levels are unreachable by the usual route.
 * The arcanum is how the class reaches them, and it is not a slot at all —
 * one casting of each, returning on a long rest.
 *
 * Nothing in the data says so. It is not in `additionalSpells`, and neither
 * edition's class table carries a column for it: both state it in the feature
 * text, in the same words.
 *
 * > At 11th level, your patron bestows upon you a magical secret called an
 * > arcanum. Choose one 6th-level spell from the warlock spell list as this
 * > arcanum. You can cast your arcanum spell once without expending a spell
 * > slot. You must finish a long rest before you can do so again.
 * > At higher levels, you gain more warlock spells of your choice that can be
 * > cast in this way: one 7th-level spell at 13th level, one 8th-level spell
 * > at 15th level, and one 9th-level spell at 17th level.
 * > — PHB, Warlock, Mystic Arcanum
 *
 * > Choose one level 6 Warlock spell as this arcanum. You can cast your
 * > arcanum spell once without expending a spell slot, and you must finish a
 * > Long Rest before you can cast it in this way again. — XPHB
 *
 * So it is written here once, in the shape everything else that grants spells
 * already has: a choice from a filter, cast innately, one use per long rest.
 */

import { resolveClassId } from "@bertinis-vault/data-engine";

import type { GrantedSpellEntry } from "./granted-spells.js";

/** The class level each arcanum arrives at, and the spell level it reaches. */
const ARCANA: Array<{ level: number; spellLevel: number }> = [
  { level: 11, spellLevel: 6 },
  { level: 13, spellLevel: 7 },
  { level: 15, spellLevel: 8 },
  { level: 17, spellLevel: 9 },
];

/**
 * The arcana a warlock of this level has, as grants like any other.
 *
 * Empty for every other class and for a warlock below 11. The level is the
 * warlock's own, not the character's: a warlock 11 / fighter 5 has one arcanum
 * and a fighter 11 / warlock 5 has none.
 *
 * Each is stated as a filter rather than a name because the spell is the
 * player's choice, and a filter is a question everywhere else in this codebase
 * too — resolving it for them would put a 6th-level spell on the sheet nobody
 * picked.
 */
export function mysticArcanaAt(classId: string, classLevel: number): GrantedSpellEntry[] {
  if (resolveClassId(classId) !== "warlock") return [];

  return ARCANA.filter((arcanum) => classLevel >= arcanum.level).map((arcanum) => ({
    kind: "innate",
    variant: null,
    ability: null,
    // The gate is a class level, like the rest of what a class grants. It is
    // *not* the spell level gate the patrons use: those wait on pact slots,
    // and the whole point of an arcanum is that no pact slot ever reaches it.
    level: arcanum.level,
    spellLevel: null,
    recharge: "rest",
    uses: 1,
    names: [],
    filters: [{ filter: `level=${arcanum.spellLevel}|class=Warlock`, count: 1 }],
    choices: [],
  }));
}
