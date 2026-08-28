/**
 * What a caster may know, and how many.
 *
 * All of the arithmetic — how many cantrips at this level, how many spells a
 * bard knows versus how many a cleric prepares, which slot levels are open —
 * already lives in the domain package. This only assembles the inputs it wants
 * and shapes the result for a picker.
 *
 * Storage follows the builder's existing text format rather than a new one:
 * cantrips are bare names, levelled spells are `"Nv1: Shield"`. That is what
 * `buildCanonicalSnapshot` parses, so a spell chosen here is a spell the
 * export resolves.
 */

import {
  buildSpellPickerState,
  cantripsKnownAt,
  getSpellProgressionForClass,
  getSpellSelectionProfileForClassLevel,
  spellCountLabel,
  spellsAvailableAt,
  type SpellPickerState,
  warlockPactSlotLevelByClassLevel,
  type SpellSelectionProfile,
} from "@bertinis-vault/domain";
import type { RulesVersion } from "@bertinis-vault/vetools-ref";

import type { CharacterBuild } from "@bertinis-vault/contracts";
import {
  castingTimeOf,
  classInfoFor,
  isConcentration,
  spellPoolFor,
} from "./index-options";

export type SpellPlan = {
  caster: boolean;
  /** Absent for a non-caster, or before the draft can be derived. */
  picker: SpellPickerState | null;
  cantripOptions: string[];
  /** Levelled spells, grouped by their level. */
  spellsByLevel: Array<{ level: number; names: string[] }>;
};

const NONE: SpellPlan = { caster: false, picker: null, cantripOptions: [], spellsByLevel: [] };

/**
 * How many cantrips and how many spells this class has at this level, in this
 * edition.
 *
 * Null when the index has never heard of the class — which is a different
 * answer from zero, and the difference matters: zero is a fighter, null is a
 * typo. Zero for a real class that simply has no magic yet, such as a 2014
 * paladin at level 1.
 *
 * Everything is read from the class's own table. 2014 states the prepared
 * count as a formula because a printed table cannot know a modifier; 2024
 * replaced the formula with a column, so `abilityModifier` stops mattering
 * there on its own, without a branch here.
 */
export function spellCountsFor(input: {
  classId: string;
  level: number;
  rulesVersion: RulesVersion;
  abilityModifier?: number;
}): { cantrips: number; spells: number } | null {
  const row = classInfoFor(input.classId, input.rulesVersion);
  if (!row) return null;

  return {
    cantrips: cantripsKnownAt(row, input.level),
    spells: spellsAvailableAt(row, input.level, input.abilityModifier ?? 0),
  };
}

export function spellPlan(input: {
  classId: string;
  className: string;
  classSource: string;
  /** Widens the pool: domain, oath, patron and circle spells all live here. */
  subclassId: string;
  level: number;
  rulesVersion: RulesVersion;
  /** Null until the draft has enough to derive. */
  snapshot: CharacterBuild | null;
}): SpellPlan {
  const { classId, className, classSource, subclassId, level, rulesVersion, snapshot } = input;

  if (!classId || getSpellProgressionForClass(classId) === "none") return NONE;

  const spellcasting = snapshot?.derived.spellcasting;
  const slots = spellcasting?.slots ?? {};

  /**
   * The ability modifier feeds the "prepared" classes, whose count is
   * `modifier + level`. A cleric with no Wisdom yet prepares fewer spells, and
   * that is the honest number rather than an assumed +3.
   */
  const abilityModifier = spellcasting
    ? Math.floor((snapshot!.abilities.final[spellcasting.ability] - 10) / 2)
    : 0;

  /**
   * The counts come from the class's own table in the chosen edition, not from
   * a 2014 implementation that takes no edition.
   *
   * `getSpellSelectionProfileForClassLevel` lives in `dnd5e-2014.ts` and has no
   * `rulesVersion` parameter, so every 2024 caster was being served 2014
   * numbers. Two of those differences are visible on the first screen a player
   * sees: a 2024 paladin casts from level 1 and was getting nothing, and a 2024
   * bard prepares one more spell than a 2014 bard knows from level 5 up.
   *
   * `classInfoFor` returns the index row, which already carries `spellTable`,
   * `preparedSpells` and `spellcastingLevel` per edition — so this is read from
   * data rather than from a table written here.
   */
  const row = classInfoFor(classId, rulesVersion);
  const counts = spellCountsFor({ classId, level, rulesVersion, abilityModifier });
  const profile: SpellSelectionProfile =
    row && counts
      ? { mode: spellCountLabel(row), cantripLimit: counts.cantrips, spellLimit: counts.spells }
      : getSpellSelectionProfileForClassLevel(classId, level, abilityModifier);

  /**
   * The class list plus whatever the subclass adds — not the class list alone.
   *
   * Reading only the class left an Eldritch Knight and an Arcane Trickster with
   * an empty picker, and every domain, oath, patron and circle spell off the
   * table for everyone else.
   */
  const rows = spellPoolFor({
    className,
    classSource,
    classId,
    subclassId,
    classLevel: level,
    // The warlock patrons gate their list on pact slot level, which is what the
    // character's slots are worth rather than what their level is.
    pactSlotLevel: warlockPactSlotLevelByClassLevel[level] ?? 0,
    rulesVersion,
    maxLevel: 9,
  });
  const cantripOptions = rows.filter((row) => row.level === 0).map((row) => row.name);
  const levelled = rows.filter((row) => row.level > 0);

  const picker = buildSpellPickerState({
    slots,
    profile,
    cantripOptionCount: cantripOptions.length,
    spellOptions: levelled.map((row) => ({ label: row.name, level: row.level })),
  });

  const byLevel = new Map<number, string[]>();
  for (const entry of picker.filteredSpellOptions) {
    const bucket = byLevel.get(entry.level) ?? [];
    bucket.push(entry.label);
    byLevel.set(entry.level, bucket);
  }

  return {
    caster: true,
    picker,
    cantripOptions,
    spellsByLevel: [...byLevel.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([level, names]) => ({ level, names })),
  };
}

/* ---------------- the "Nv1: Shield" format ---------------- */

/** Read `"Nv1: Shield"` back into its parts. */
/**
 * Which of these spells demand concentration.
 *
 * The index records it per spell as a flag, so this needs no table of its own.
 * Two concentration spells cannot both be running, which makes a list full of
 * them a build that only half works — worth saying before the table finds out.
 *
 * Names that the index does not know are left out rather than guessed at.
 */
export function concentrationAmong(lines: string[], rulesVersion: RulesVersion): string[] {
  const found: string[] = [];

  for (const line of lines) {
    const parsed = parseSpellLine(line);
    const name = (parsed?.name ?? line).trim();
    if (!name) continue;

    if (isConcentration(name, rulesVersion)) found.push(name);
  }

  return found;
}

/**
 * How the spell list is spread across a turn.
 *
 * A turn holds one action, one bonus action and one reaction, and they are not
 * interchangeable: eight spells that all want the action are eight spells
 * competing for the same slot, while the reaction sits unused every round the
 * character is not the one acting.
 *
 * Long-casting spells are counted apart because from a fight's point of view
 * they do not exist — a minute is ten rounds.
 */
export type ActionProfile = {
  action: string[];
  bonus: string[];
  reaction: string[];
  long: string[];
  /** Lines the index could not place, and so could not count. */
  unknown: string[];
};

export function actionProfile(lines: string[], rulesVersion: RulesVersion): ActionProfile {
  const profile: ActionProfile = { action: [], bonus: [], reaction: [], long: [], unknown: [] };

  for (const line of lines) {
    const parsed = parseSpellLine(line);
    const name = (parsed?.name ?? line).trim();
    if (!name) continue;

    const time = castingTimeOf(name, rulesVersion);
    if (time) profile[time].push(name);
    else profile.unknown.push(name);
  }

  return profile;
}

export function parseSpellLine(line: string): { level: number; name: string } | null {
  const match = line.match(/^Nv(\d+):\s*(.+)$/i);
  if (!match) return null;
  return { level: Number.parseInt(match[1] ?? "1", 10), name: (match[2] ?? "").trim() };
}

export function formatSpellLine(level: number, name: string): string {
  return `Nv${level}: ${name}`;
}
