/**
 * Spell slots in the shape the payload carries them.
 *
 * `getSpellSlotsForClassLevel` answers in Foundry's own field names —
 * `spell1`…`spell9` — because the direct actor exporter writes those fields
 * verbatim. The payload is a different contract: it keys slots by the level
 * they are, `{"1": 4}`, and the Foundry module turns that into a field name on
 * arrival.
 *
 * Those two shapes were confused for as long as both existed. The builder sent
 * `spell1`, the module prefixed it again, and the result was
 * `system.spells.spellspell1` — a path that does not exist, so no character
 * imported through the module ever had a spell slot. Keeping the conversion in
 * one named place, rather than leaving each caller to guess, is what stops
 * that recurring.
 */

import {
  getSpellProgressionForClass,
  normalizeClassId,
  spellSlotsFullCasterTable,
  warlockPactSlotCountByLevel,
  warlockPactSlotLevelByClassLevel,
} from "./dnd5e-2014.js";

/** Which edition's half-caster rule to apply. */
export type SlotRulesVersion = "2014" | "2024";

export type PayloadSpellSlots = {
  /**
   * Slots by the level they are, e.g. `{"1": 4, "2": 3}`. A warlock's are
   * under `pact` instead, which is a different resource on the sheet.
   */
  slots: Record<string, number>;
  /** The level a warlock's pact slots are cast at. Absent for everyone else. */
  pactLevel?: number;
};

/**
 * The slots a character of this class and level has.
 *
 * Levels with no slots are left out rather than sent as zero: the payload says
 * what the character has, and the module writes what it is told.
 *
 * A half-caster reads the full-caster table at `ceil(level / 2)`. The editions
 * differ in one row and one row only: in 2014 a paladin and a ranger cast
 * nothing at level 1, and in 2024 both start there. Everything from level 2 up
 * is identical, which is what the published tables say.
 *
 * The old code halved rounding *down*, which is not the half-caster table at
 * all. It matched at even levels and undershot at every odd level from 3 up: a
 * level 5 ranger was given three first-level slots where the table gives four
 * first and two second.
 */
export function spellSlotsForPayload(
  classId: string,
  level: number,
  rulesVersion: SlotRulesVersion = "2014",
): PayloadSpellSlots {
  const progression = getSpellProgressionForClass(normalizeClassId(classId));

  if (progression === "none") return { slots: {} };

  if (progression === "pact") {
    const count = warlockPactSlotCountByLevel[level] ?? 0;
    const pactLevel = warlockPactSlotLevelByClassLevel[level] ?? 0;
    if (count === 0 || pactLevel === 0) return { slots: {} };

    return { slots: { pact: count }, pactLevel };
  }

  const effectiveLevel =
    progression === "half" ? halfCasterLevel(level, classId, rulesVersion) : level;
  if (effectiveLevel < 1) return { slots: {} };

  const table = spellSlotsFullCasterTable[effectiveLevel] ?? spellSlotsFullCasterTable[1] ?? [];
  const slots: Record<string, number> = {};

  table.forEach((count, index) => {
    if (count > 0) slots[String(index + 1)] = count;
  });

  return { slots };
}

/**
 * How far up the full-caster table a half-caster reads.
 *
 * Zero at level 1 under the 2014 rules, where a paladin and a ranger have not
 * begun casting. The artificer is the exception the 2024 rule was named after
 * and casts from level 1 in both editions.
 */
function halfCasterLevel(level: number, classId: string, rulesVersion: SlotRulesVersion): number {
  const castsAtFirst = rulesVersion === "2024" || normalizeClassId(classId) === "artificer";
  if (level <= 1 && !castsAtFirst) return 0;

  return Math.ceil(level / 2);
}

/** Where the Eldritch Knight and the Arcane Trickster start casting, in both editions. */
const THIRD_CASTER_FIRST_LEVEL = 3;

/**
 * A third-caster's slots when it is the character's only class.
 *
 * Not the multiclass contribution. Multiclassing counts a third of the levels
 * rounded *down*; the Eldritch Knight's own table reads the full-caster table at
 * a third rounded *up* — fighter 4 has three 1st level slots, fighter 7 has four
 * 1st and two 2nd. Sending a lone Eldritch Knight through the multiclass path
 * gave a fighter 7 three 1st level slots and no 2nd.
 */
export function thirdCasterSlotsForPayload(level: number): PayloadSpellSlots {
  if (level < THIRD_CASTER_FIRST_LEVEL) return { slots: {} };

  const table = spellSlotsFullCasterTable[Math.min(Math.ceil(level / 3), 20)] ?? [];
  const slots: Record<string, number> = {};
  table.forEach((count, index) => {
    if (count > 0) slots[String(index + 1)] = count;
  });

  return { slots };
}
