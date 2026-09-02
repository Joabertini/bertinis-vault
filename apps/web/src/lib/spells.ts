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
  hasSpellbook,
  spellbookSizeAt,
  spellCountLabel,
  spellsAvailableAt,
  type SpellPickerState,
  warlockPactSlotLevelByClassLevel,
  spellSlotsForPayload,
  spellSlotsFullCasterTable,
  type PayloadSpellSlots,
  type SpellSelectionProfile,
} from "@bertinis-vault/domain";
import type { RulesVersion } from "@bertinis-vault/vetools-ref";
import type { AbilityId } from "./abilities";

import type { CharacterBuild, ClassEntry } from "@bertinis-vault/contracts";
import {
  castingTimeOf,
  classInfoFor,
  isConcentration,
  spellPoolFor,
  subclassInfoFor,
} from "./index-options";

/** A list of levelled spells to pick from, grouped the way the books print them. */
export type SpellsByLevel = Array<{ level: number; names: string[] }>;

/**
 * The book a wizard writes in, which no other class has.
 *
 * `options` is the whole class list the wizard could copy from; `limit` is
 * how many the class guarantees at this level. The prepared picker then draws
 * on what the player actually wrote down, which is the rule the sheet exists
 * to enforce: a wizard prepares *from their spellbook*, not from the wizard
 * list.
 */
export type SpellbookPlan = {
  limit: number;
  options: SpellsByLevel;
};

export type SpellPlan = {
  caster: boolean;
  /** Absent for a non-caster, or before the draft can be derived. */
  picker: SpellPickerState | null;
  cantripOptions: string[];
  /**
   * The levelled spells the player may prepare, grouped by level.
   *
   * For a wizard this is their book and not the wizard list — everyone else
   * prepares straight from the class list, so the two are the same.
   */
  spellsByLevel: SpellsByLevel;
  /** Null for every class but the wizard. */
  book: SpellbookPlan | null;
};

const NONE: SpellPlan = {
  caster: false,
  picker: null,
  cantripOptions: [],
  spellsByLevel: [],
  book: null,
};

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
  /** What the wizard has written down, as `"Nv1: Shield"` lines. Ignored otherwise. */
  spellbook?: string[];
  /**
   * This class's own casting ability, when the character has more than one.
   *
   * The snapshot carries a single ability for the whole character, which is
   * right for a wizard and wrong for a wizard/cleric: the cleric prepares
   * Wisdom + level and the wizard Intelligence + level, and reading one
   * ability for both gives at least one of them the wrong count.
   */
  castingAbility?: AbilityId;
  /**
   * The slots this class would have on its own, when the character has more
   * than one.
   *
   * Multiclass slots are shared, and the shared table is what the character
   * *casts* with - but not what they may *learn*. The rules set spells known
   * and prepared "as if you were a single-classed member of that class", and
   * the books add the consequence in as many words: you might have slots of a
   * higher level than any spell you know, and you spend them casting lower
   * spells higher.
   *
   * Measured against this repository's own tables, the gap is ordinary rather
   * than exotic:
   *
   *   wizard 5 / cleric 5     caster level 10, slots to 5th, each list to 3rd
   *   wizard 3 / cleric 3     caster level  6, slots to 3rd, each list to 2nd
   *   eldritch knight 17 / wizard 1
   *                           caster level  6, slots to 3rd, wizard list to 1st
   *
   * Passing the shared table here offered a wizard 5 / cleric 5 fifth level
   * spells to prepare, two levels past anything either class can prepare.
   *
   * A plain fighter is not one of these cases and is worth saying so: it
   * contributes nothing to the caster level at all, so a fighter 17 / wizard 1
   * has a 1st level caster's slots and no gap to close. Only the Eldritch
   * Knight and the Arcane Trickster contribute a third of their levels.
   */
  ownSlots?: Record<string, number>;
  /** This class's own pact slot level, for a warlock among other classes. */
  ownPactLevel?: number;
}): SpellPlan {
  const { classId, className, classSource, subclassId, level, rulesVersion, snapshot } = input;

  /*
   * A subclass can be the whole reason a character casts.
   *
   * The eldritch knight and the arcane trickster are the only two, and the
   * class says nothing: a fighter's progression is "none", which used to end
   * this function before it started. They had spell slots on the sheet and no
   * picker to fill them with.
   */
  const subclass = subclassId ? subclassInfoFor(subclassId, classId, rulesVersion) : null;
  const castsFromSubclass = Boolean(subclass?.casterProgression && subclass.spellTable);

  if (!classId) return NONE;
  if (getSpellProgressionForClass(classId) === "none" && !castsFromSubclass) return NONE;

  const spellcasting = snapshot?.derived.spellcasting;
  const slots = input.ownSlots ?? spellcasting?.slots ?? {};

  /**
   * The ability modifier feeds the "prepared" classes, whose count is
   * `modifier + level`. A cleric with no Wisdom yet prepares fewer spells, and
   * that is the honest number rather than an assumed +3.
   */
  const modifierAbility = input.castingAbility ?? spellcasting?.ability;
  const abilityModifier =
    modifierAbility && snapshot
      ? Math.floor((snapshot.abilities.final[modifierAbility] - 10) / 2)
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
  /*
   * The table to read: the class's, or the subclass's where the class has
   * none. A third-caster's numbers are printed on the subclass and nowhere
   * else, and they are its own — an eldritch knight of 7 knows five spells,
   * which is not any row of the fighter's table because the fighter has none.
   */
  const row = castsFromSubclass
    ? { spellTable: subclass!.spellTable, spellcastingLevel: subclass!.spellcastingLevel }
    : classInfoFor(classId, rulesVersion);
  const counts = row
    ? { cantrips: cantripsKnownAt(row, level), spells: spellsAvailableAt(row, level, abilityModifier) }
    : null;
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

  /*
   * The wizard prepares out of a book, and every other caster out of the class
   * list. So the options the picker is given differ per class, and the picker
   * itself does not need to know why.
   *
   * The book is written before this: `spellbook` holds what the player copied
   * in, and a wizard who has written nothing down has nothing to prepare. That
   * is the honest answer rather than an empty-book special case that quietly
   * hands them the whole wizard list — which is what this replaces.
   */
  const book = hasSpellbook(classId)
    ? new Set((input.spellbook ?? []).map((line) => parseSpellLine(line)?.name ?? line.trim()))
    : null;

  const preparable = book ? levelled.filter((row) => book.has(row.name)) : levelled;

  const picker = buildSpellPickerState({
    slots,
    profile,
    cantripOptionCount: cantripOptions.length,
    spellOptions: preparable.map((row) => ({ label: row.name, level: row.level })),
    // A warlock's slots are kept under "pact" and carry their level apart from
    // the map, so the picker is told what they are worth.
    pactSlotLevel: input.ownPactLevel ?? spellcasting?.pactLevel ?? 0,
  });

  /*
   * The book is bounded by the slots too, and by the same sentence in both
   * editions: an added spell "must be of a level for which you have spell
   * slots". A level 3 wizard writes down 1st and 2nd level spells, and a
   * builder that offered 9th would be offering something no table allows.
   */
  const bookPlan: SpellbookPlan | null = book
    ? {
        limit: spellbookSizeAt(level),
        options: groupByLevel(levelled.filter((row) => row.level <= picker.maxSpellLevel)),
      }
    : null;

  return {
    caster: true,
    picker,
    cantripOptions,
    spellsByLevel: groupByLevel(
      picker.filteredSpellOptions.map((entry) => ({ name: entry.label, level: entry.level })),
    ),
    book: bookPlan,
  };
}

/**
 * One plan per class the character casts with.
 *
 * The builder used to make a single plan out of `draft.classId` and never
 * looked at the rest, which is what three of the beta reports were: a fighter
 * who took a level of wizard got no Spells chamber at all, because the fighter
 * casts nothing and the question was never asked of the wizard; and a wizard
 * who took cleric got the wizard list and nothing of the cleric's.
 *
 * The rules make each class its own question - "you determine what spells you
 * know and can prepare for each class individually, as if you were a
 * single-classed member of that class" - so this asks it once per class rather
 * than trying to merge them. What is shared is the slots, and only the slots.
 *
 * Non-casters drop out. A fighter 5 / wizard 3 gets one section, not a fighter
 * section that says zero.
 */
export type ClassSpellPlan = SpellPlan & {
  classId: string;
  label: string;
  classLevel: number;
};

export function spellPlansFor(input: {
  entries: ClassEntry[];
  labelFor: (classId: string) => { label: string; source: string };
  rulesVersion: RulesVersion;
  snapshot: CharacterBuild | null;
  spellbook?: string[];
}): ClassSpellPlan[] {
  const plans: ClassSpellPlan[] = [];

  for (const entry of input.entries) {
    if (!entry.classId) continue;
    const named = input.labelFor(entry.classId);

    const own = ownSlotsFor(entry, input.rulesVersion);

    const plan = spellPlan({
      classId: entry.classId,
      className: named.label,
      classSource: named.source,
      subclassId: entry.subclassId ?? "",
      level: entry.level,
      rulesVersion: input.rulesVersion,
      snapshot: input.snapshot,
      ownSlots: own.slots,
      ...(own.pactLevel === undefined ? {} : { ownPactLevel: own.pactLevel }),
      ...(entry.spellcastingAbility ? { castingAbility: entry.spellcastingAbility } : {}),
      ...(input.spellbook ? { spellbook: input.spellbook } : {}),
    });

    if (!plan.caster) continue;
    plans.push({ ...plan, classId: entry.classId, label: named.label, classLevel: entry.level });
  }

  return plans;
}

/** Where the Eldritch Knight and the Arcane Trickster start, in both editions. */
const THIRD_CASTER_FIRST_LEVEL = 3;

/**
 * The slots this class would have on its own, which is the table its spells
 * known and prepared come off.
 *
 * Not `multiclassSpellSlots([entry])`, which was the first attempt and is
 * wrong: that function answers what a class *contributes* to a shared caster
 * level, and for anything but a full caster the contribution and the class's
 * own table are different numbers. A half-caster contributes `floor(level / 2)`
 * and reads its own table at `ceil(level / 2)` — measured, a paladin 5 came
 * back with three 1st level slots where the published table gives four 1st and
 * two 2nd, so the picker would have refused them every 2nd level paladin spell.
 *
 * `spellSlotsForPayload` is that own-table reading, editions included: in 2014
 * a paladin and a ranger cast nothing at level 1 and in 2024 both start there.
 *
 * It answers by class, so it has nothing to say about a caster whose magic
 * comes from a subclass. The Eldritch Knight and the Arcane Trickster are the
 * only two, they are third casters, and a third caster reads the full table at
 * `ceil(level / 3)` — checked against the printed Eldritch Knight table at
 * fighter 3, 7 and 13.
 */
function ownSlotsFor(entry: ClassEntry, rulesVersion: RulesVersion): PayloadSpellSlots {
  const own = spellSlotsForPayload(entry.classId, entry.level, rulesVersion);
  if (Object.keys(own.slots).length > 0) return own;

  if (entry.subclassCasterProgression !== "1/3") return own;

  // All four third-caster subclasses in the data - the Eldritch Knight and the
  // Arcane Trickster, in both editions - begin at 3rd level, and `ceil(1 / 3)`
  // would otherwise hand a 1st level fighter two spell slots.
  if (entry.level < THIRD_CASTER_FIRST_LEVEL) return own;

  const table = spellSlotsFullCasterTable[Math.ceil(entry.level / 3)] ?? [];
  const slots: Record<string, number> = {};
  table.forEach((count, index) => {
    if (count > 0) slots[String(index + 1)] = count;
  });

  return { slots };
}

/**
 * Which plan a chosen spell belongs to.
 *
 * Storage stays one flat list of `"Nv1: Shield"` lines, because that is what
 * the export reads and what every saved draft already holds - nothing has to be
 * migrated. What the sections need is only a rule for counting, and the rule is
 * the first plan whose pool contains the spell. Cure Wounds is on four lists;
 * counting it against all four would show a wizard/cleric two spells over their
 * limit on both sides at once.
 */
export function attributeSpells(
  chosen: string[],
  plans: readonly ClassSpellPlan[],
  pick: (plan: ClassSpellPlan) => SpellsByLevel | string[],
): Map<string, string[]> {
  const pools = plans.map((plan) => {
    const from = pick(plan);
    const names = Array.isArray(from) && typeof from[0] === "string"
      ? (from as string[])
      : (from as SpellsByLevel).flatMap((group) => group.names);
    return { classId: plan.classId, names: new Set(names) };
  });

  const owned = new Map<string, string[]>(plans.map((plan) => [plan.classId, []]));
  for (const line of chosen) {
    const name = parseSpellLine(line)?.name ?? line.trim();
    const home = pools.find((pool) => pool.names.has(name)) ?? pools[0];
    if (home) owned.get(home.classId)!.push(line);
  }

  return owned;
}

/** Spells in the order the books print them: by level, then as the pool gave them. */
function groupByLevel(rows: Array<{ name: string; level: number }>): SpellsByLevel {
  const byLevel = new Map<number, string[]>();
  for (const row of rows) {
    const bucket = byLevel.get(row.level) ?? [];
    bucket.push(row.name);
    byLevel.set(row.level, bucket);
  }

  return [...byLevel.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([level, names]) => ({ level, names }));
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
