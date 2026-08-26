/**
 * How many cantrips and spells a caster has, read from the class's own table.
 *
 * This replaces a hand-written switch that covered eight classes with the 2014
 * numbers and served both editions from them. Two things were wrong with that
 * beyond the missing classes. 2024 replaced "Spells Known" with a **Prepared
 * Spells** column for every caster, so a 2024 bard prepared a 2014 bard's
 * shorter list. And 2024 moved the paladin's and the ranger's spellcasting
 * from level 2 to level 1, so a level-one 2024 paladin could prepare nothing.
 *
 * Both editions print the numbers in the class table. The 2014 prepare-casters
 * are the exception and say so honestly: they carry a formula instead, because
 * their count depends on a modifier a table cannot know.
 */

export type SpellTable = {
  /** One entry per class level, or null when the class has no such column. */
  cantrips: number[] | null;
  known: number[] | null;
  prepared: number[] | null;
};

export type SpellCountSource = {
  spellTable?: SpellTable | null;
  /** 2014's formula, e.g. "<$level$> + <$wis_mod$>". Null in 2024. */
  preparedSpells?: string | null;
  /** The level this class starts casting at. 2024 moved two of them to 1. */
  spellcastingLevel?: number | null;
};

/** A table entry at a class level, clamped to the table's own range. */
function atLevel(counts: number[] | null | undefined, level: number): number | null {
  if (!counts?.length) return null;
  const index = Math.min(Math.max(Math.trunc(level), 1), counts.length) - 1;
  return counts[index] ?? null;
}

/** True once the class has reached the level its magic begins at. */
export function castsAtLevel(source: SpellCountSource, level: number): boolean {
  const starts = source.spellcastingLevel ?? 1;
  return level >= starts;
}

/**
 * Cantrips known at a class level.
 *
 * Zero for a class with no cantrip column, which is the right answer for the
 * paladin and the ranger in both editions: they have never had any.
 */
export function cantripsKnownAt(source: SpellCountSource, level: number): number {
  if (!castsAtLevel(source, level)) return 0;
  return atLevel(source.spellTable?.cantrips, level) ?? 0;
}

/**
 * Spells known or prepared at a class level.
 *
 * The table wins where there is one, which is every 2024 caster and the 2014
 * classes that learn a fixed list. The 2014 prepare-casters fall back to their
 * formula, which needs the casting modifier — and a formula's floor is one
 * spell, because "level plus a negative modifier" is not zero spells, it is a
 * character with a bad casting stat.
 */
export function spellsAvailableAt(
  source: SpellCountSource,
  level: number,
  abilityModifier = 0,
): number {
  if (!castsAtLevel(source, level)) return 0;

  const tabled = atLevel(source.spellTable?.prepared, level) ?? atLevel(source.spellTable?.known, level);
  if (tabled !== null) return tabled;

  return preparedFromFormula(source.preparedSpells ?? null, level, abilityModifier);
}

/**
 * 2014's prepared-spell formula, evaluated rather than re-derived.
 *
 * Two shapes exist in the data and they differ only in the division: the full
 * casters prepare level plus modifier, the half casters half their level plus
 * modifier. Reading it beats writing the same rule out per class, which is how
 * the paladin ended up with the artificer's rounding.
 */
export function preparedFromFormula(
  formula: string | null,
  level: number,
  abilityModifier: number,
): number {
  if (!formula) return 0;

  const halved = /\/\s*2/.test(formula);
  const base = halved ? Math.floor(level / 2) : level;

  return Math.max(base + abilityModifier, 1);
}

/** Which word the interface should use, since the editions renamed it. */
export function spellCountLabel(source: SpellCountSource): "prepared" | "known" {
  if (source.spellTable?.prepared?.length) return "prepared";
  if (source.spellTable?.known?.length) return "known";
  return source.preparedSpells ? "prepared" : "known";
}
