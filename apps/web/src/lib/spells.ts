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
  getSpellProgressionForClass,
  getSpellSelectionProfileForClassLevel,
  type SpellPickerState,
} from "@bertinis-vault/domain";
import type { RulesVersion } from "@bertinis-vault/vetools-ref";

import type { CharacterBuild } from "@bertinis-vault/contracts";
import { castingTimeOf, isConcentration, spellOptionsForClass } from "./index-options";

export type SpellPlan = {
  caster: boolean;
  /** Absent for a non-caster, or before the draft can be derived. */
  picker: SpellPickerState | null;
  cantripOptions: string[];
  /** Levelled spells, grouped by their level. */
  spellsByLevel: Array<{ level: number; names: string[] }>;
};

const NONE: SpellPlan = { caster: false, picker: null, cantripOptions: [], spellsByLevel: [] };

export function spellPlan(input: {
  classId: string;
  className: string;
  classSource: string;
  level: number;
  rulesVersion: RulesVersion;
  /** Null until the draft has enough to derive. */
  snapshot: CharacterBuild | null;
}): SpellPlan {
  const { classId, className, classSource, level, rulesVersion, snapshot } = input;

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

  const profile = getSpellSelectionProfileForClassLevel(classId, level, abilityModifier);

  const rows = spellOptionsForClass(className, classSource, rulesVersion, 9);
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
