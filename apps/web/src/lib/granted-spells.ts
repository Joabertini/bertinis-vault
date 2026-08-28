/**
 * The spells a character gets from something that is not their class.
 *
 * 5etools keeps every one of these in one field, `additionalSpells`, and the
 * builder read it on subclasses alone. Measured: 128 subclasses have one, and
 * so do 66 feats, 54 optional features, 50 subspecies, 30 species, 15
 * backgrounds and 7 classes. A tiefling arrived without Thaumaturgy.
 *
 * Two things have to be answered before they can be resolved, and they are
 * answered in different places:
 *
 * - *whose* level gates it. A subclass counts class levels; a species counts
 *   the character's, so a tiefling who multiclasses still gets its level 3
 *   spell at character level 3
 * - *which* alternative, where the grant offers several. In 2024 this is not a
 *   detail: XPHB ships no subraces, so an elf's Drow, High Elf and Wood Elf
 *   exist nowhere in the data but as the names on these blocks
 */

import {
  grantedSpellsAt,
  mysticArcanaAt,
  parseSpellFilter,
  preparationForKind,
  spellMatchesFilter,
  spellVariantsOf,
  warlockPactSlotLevelByClassLevel,
  type GrantedSpellEntry,
} from "@bertinis-vault/domain";
import {
  collections,
  forRulesVersion,
  type BackgroundRow,
  type FeatRow,
  type OptionalFeatureRow,
  type RaceRow,
  type SpellRow,
  type SubclassRow,
  type SubraceRow,
} from "@bertinis-vault/vetools-index";
import type { AbilityId } from "@bertinis-vault/contracts";
import type { RulesVersion } from "@bertinis-vault/vetools-ref";

import type { BuilderState } from "./builder-state";
import { classEntriesFor } from "./classing";
import { featIdsFor } from "./feats";
import { slugOf, subclassInfoFor } from "./index-options";

/** One thing that grants spells, and everything needed to read what it grants. */
export type SpellGrantSource = {
  /**
   * Where the answer to its variant question is stored.
   *
   * Keyed by what offers the choice rather than by the choice itself, so a
   * player who changes species does not carry an elf's lineage onto a
   * tiefling.
   */
  key: string;
  /** What the player is looking at when they answer: "Elf", "Circle of the Land". */
  label: string;
  /** Which chamber asks. A species question does not belong beside the spells. */
  /**
   * Which chamber asks its question.
   *
   * A species question does not belong beside the spells: a fighter elf never
   * opens the spell chamber and has a lineage all the same. The same holds for
   * a feat and for a warlock's invocation.
   */
  chamber: "species" | "class" | "origin" | "growth" | "gifts";
  entries: GrantedSpellEntry[];
  /** The named alternatives, or empty when the grant simply applies. */
  variants: string[];
  /** The level this grant counts in, already resolved to a number. */
  level: number;
  /** Only the warlock patrons use this; zero for everything else. */
  pactSlotLevel: number;
};

/** Every source of granted spells this draft has, in the order it picked them. */
export function spellGrantsFor(
  state: BuilderState,
  rulesVersion: RulesVersion,
): SpellGrantSource[] {
  const sources: SpellGrantSource[] = [];
  const level = classEntriesFor(
    { classId: state.classId, subclassId: state.subclassId, level: state.level },
    state.extraClasses,
    rulesVersion,
  ).reduce((total, entry) => total + entry.level, 0);

  const races = forRulesVersion(collections.race ?? [], rulesVersion) as RaceRow[];
  const race = pickRow(races, state.raceId, state.sourceBooks[`race:${state.raceId}`]);
  if (race?.spells?.length) {
    sources.push({
      key: "race",
      label: race.name,
      chamber: "species",
      entries: race.spells,
      variants: spellVariantsOf(race.spells),
      // The character's level, not a class's: the species does not care which
      // class the level was taken in.
      level,
      pactSlotLevel: 0,
    });
  }

  if (state.subraceId) {
    const subraces = forRulesVersion(collections.subrace ?? [], rulesVersion) as SubraceRow[];
    const subrace = pickRow(
      subraces,
      state.subraceId,
      state.sourceBooks[`subrace:${state.subraceId}`],
    );
    // A subspecies *adds*, like its traits and its languages. The deep gnome
    // keeps what the gnome grants.
    if (subrace?.spells?.length) {
      sources.push({
        key: "subrace",
        label: subrace.name,
        chamber: "species",
        entries: subrace.spells,
        variants: spellVariantsOf(subrace.spells),
        level,
        pactSlotLevel: 0,
      });
    }
  }

  const backgrounds = forRulesVersion(
    collections.background ?? [],
    rulesVersion,
  ) as BackgroundRow[];
  const background = pickRow(
    backgrounds,
    state.backgroundId,
    state.sourceBooks[`background:${state.backgroundId}`],
  );
  if (background?.spells?.length) {
    sources.push({
      key: "background",
      label: background.name,
      chamber: "origin",
      entries: background.spells,
      variants: spellVariantsOf(background.spells),
      level,
      pactSlotLevel: 0,
    });
  }

  const feats = forRulesVersion(collections.feat ?? [], rulesVersion) as FeatRow[];
  for (const featId of featIdsFor(state)) {
    const feat = pickRow(feats, featId, state.sourceBooks[`feat:${featId}`]);
    if (!feat?.spells?.length) continue;

    sources.push({
      key: `feat:${featId}`,
      label: feat.name,
      chamber: "growth",
      entries: feat.spells,
      variants: spellVariantsOf(feat.spells),
      level,
      pactSlotLevel: 0,
    });
  }

  const optionalFeatures = forRulesVersion(
    collections.optionalfeature ?? [],
    rulesVersion,
  ) as OptionalFeatureRow[];
  for (const featureId of state.optionalFeatureIds) {
    const feature = pickRow(optionalFeatures, featureId, undefined);
    if (!feature?.spells?.length) continue;

    sources.push({
      key: `optionalfeature:${featureId}`,
      label: feature.name,
      chamber: "gifts",
      entries: feature.spells,
      variants: spellVariantsOf(feature.spells),
      level,
      pactSlotLevel: 0,
    });
  }

  for (const entry of classEntriesFor(
    { classId: state.classId, subclassId: state.subclassId, level: state.level },
    state.extraClasses,
    rulesVersion,
  )) {
    /*
     * The warlock's Mystic Arcanum, which is not in the data at all: neither
     * edition's table has a column for it and it is not an `additionalSpells`
     * block, so the rule is written in the domain package with its citation.
     *
     * It has to be a grant rather than a picker entry because no pact slot
     * ever reaches sixth level — the whole point of the feature is casting
     * above what the slots allow.
     */
    const arcana = mysticArcanaAt(entry.classId, entry.level);
    if (arcana.length) {
      sources.push({
        key: `arcanum:${entry.classId}`,
        label: "Arcanum Mistico",
        chamber: "class",
        entries: arcana,
        variants: [],
        level: entry.level,
        pactSlotLevel: 0,
      });
    }

    if (!entry.subclassId) continue;
    const subclass: SubclassRow | null = entry.subclassId
      ? subclassInfoFor(entry.subclassId, entry.classId, rulesVersion)
      : null;
    if (!subclass?.spells?.length) continue;

    sources.push({
      key: `subclass:${entry.classId}`,
      label: subclass.name,
      chamber: "class",
      entries: subclass.spells,
      variants: spellVariantsOf(subclass.spells),
      // This one counts levels in its own class, which is the whole reason
      // the two cannot share a number.
      level: entry.level,
      pactSlotLevel: warlockPactSlotLevelByClassLevel[entry.level] ?? 0,
    });
  }

  return sources;
}

/** The variant questions this draft still owes an answer to. */
export function unansweredVariants(
  state: BuilderState,
  rulesVersion: RulesVersion,
): SpellGrantSource[] {
  return spellGrantsFor(state, rulesVersion).filter(
    (source) => source.variants.length > 0 && !state.spellVariantChoices[source.key],
  );
}

/** A grant and the entries the character has actually reached through it. */
export type ReachedGrant = { source: SpellGrantSource; entries: GrantedSpellEntry[] };

export function reachedGrantsFor(
  state: BuilderState,
  rulesVersion: RulesVersion,
): ReachedGrant[] {
  return spellGrantsFor(state, rulesVersion)
    .map((source) => ({
      source,
      entries: grantedSpellsAt(source.entries, {
        level: source.level,
        pactSlotLevel: source.pactSlotLevel,
        variant: state.spellVariantChoices[source.key] ?? null,
      }),
    }))
    .filter((reached) => reached.entries.length > 0);
}

/**
 * How 5etools' recharge words map onto dnd5e's recovery periods.
 *
 * Both vocabularies exist and neither is ours, so this is a translation table
 * and not a design: `daily` is a per-day use, `rest` is a long rest.
 *
 * Two of the five grant no uses at all rather than an unlimited number.
 * `will` is cast freely — dnd5e says that with the `atwill` method and no uses
 * — and `ritual` may only be cast as a ritual, which the spell itself already
 * says. `resource` spends something a class tracks, which nothing here tracks
 * yet, so it is left without a limit rather than given a wrong one.
 */
const RECOVERY_PERIOD: Record<string, string> = { daily: "day", rest: "lr" };

/** A spell the character has because something granted it, ready for the payload. */
export type GrantedSpell = {
  label: string;
  /** The book the grant named, where it named one. */
  source: string | null;
  preparation: "prepared" | "always";
  method?: "innate" | "atwill";
  uses?: { max: number; period: string };
  /**
   * The ability it is cast with, where the grant states one of its own.
   *
   * dnd5e keeps this on the spell, and prefers it over the class's. For a
   * fighter or a rogue it is the only thing that gives a species cantrip a
   * save DC, because they have no spellcasting ability to fall back on.
   */
  ability?: AbilityId;
  /** What handed it over, for a player reading a sheet they did not build. */
  grantedBy: string;
};

/**
 * Every spell this draft is handed outright, with how it sits on the sheet.
 *
 * Only spells named outright. A grant that describes its spells with a filter
 * — the high elf's "any wizard cantrip" — is a choice the player still has to
 * make, and choosing one for them would put a spell on the sheet they never
 * picked. Those widen the pool instead, which is `spellPoolFor`'s job.
 */
export function grantedSpellsFor(
  state: BuilderState,
  rulesVersion: RulesVersion,
): GrantedSpell[] {
  const out: GrantedSpell[] = [];

  for (const { source, entries } of reachedGrantsFor(state, rulesVersion)) {
    for (const [index, entry] of entries.entries()) {
      const preparation = preparationForKind(entry.kind);
      if (!preparation) continue;

      /*
       * How the entry is cast, which is the same however the spell was named.
       *
       * A spell picked to answer this entry's filter is granted on exactly the
       * terms the entry states — Magic Initiate's chosen 1st-level spell is
       * cast once a day, and the warlock's chosen arcanum once per long rest,
       * as surely as if the feature had printed a name.
       */
      const terms = {
        preparation,
        ...(castingAbilityOf(entry, state.spellAbilityChoices[source.key])
          ? { ability: castingAbilityOf(entry, state.spellAbilityChoices[source.key])! }
          : {}),
        ...(entry.kind === "innate"
          ? { method: entry.recharge === "will" ? ("atwill" as const) : ("innate" as const) }
          : {}),
        ...(entry.uses && entry.recharge && RECOVERY_PERIOD[entry.recharge]
          ? { uses: { max: entry.uses, period: RECOVERY_PERIOD[entry.recharge]! } }
          : {}),
        grantedBy: source.label,
      };

      const answered = [
        ...entry.filters.map((_, at) => `${source.key}:${index}:${at}`),
        ...entry.choices.map((_, at) => `${source.key}:${index}:list${at}`),
      ].flatMap((key) => state.grantedSpellChoices[key] ?? []);

      for (const name of answered) {
        out.push({ label: name.toLowerCase(), source: null, ...terms });
      }

      for (const ref of entry.names) {
        out.push({ label: ref.name, source: ref.source, ...terms });
      }
    }
  }

  return out;
}

/**
 * The row the player actually picked, and not merely one of that name.
 *
 * Four books print an Elf legal in the same edition, and they do not grant the
 * same spells: the XPHB one offers Drow, High Elf and Wood Elf, the Lorwyn one
 * offers Lorwyn and Shadowmoor. Taking the first match asks the wrong question
 * and then answers it with the wrong spells.
 *
 * A draft records the book beside every pick for exactly this. Falling back to
 * the first match keeps an older draft working rather than leaving it with no
 * species at all.
 */
function pickRow<Row extends { name: string; source: string }>(
  rows: Row[],
  id: string,
  book: string | undefined,
): Row | null {
  const named = rows.filter((row) => slugOf(row.name) === id);
  if (!named.length) return null;

  return named.find((row) => row.source === book) ?? named[0] ?? null;
}

/**
 * The ability a grant's spells are cast with, once the player has answered.
 *
 * Two forms in the data and they are two questions. A fixed ability is stated
 * outright and needs nothing. A choice — the 2024 species offer Intelligence,
 * Wisdom or Charisma — is unanswerable until the player answers it, and
 * picking one for them would set a save DC they never chose. Unanswered leaves
 * the spell without one, which is visible on the sheet rather than wrong on it.
 */
function castingAbilityOf(
  entry: GrantedSpellEntry,
  chosen: string | undefined,
): AbilityId | null {
  const fixed = entry.ability?.fixed;
  if (fixed && ABILITY_IDS.includes(fixed as AbilityId)) return fixed as AbilityId;

  const offered = entry.ability?.choose ?? [];
  if (chosen && offered.includes(chosen)) return chosen as AbilityId;

  return null;
}

const ABILITY_IDS: AbilityId[] = ["str", "dex", "con", "int", "wis", "cha"];

/**
 * The ability questions this draft still owes an answer to.
 *
 * Only where the grant offers a choice *and* actually hands over a spell: a
 * lineage that has been asked for but not chosen has nothing to cast yet, and
 * asking which ability casts nothing is a question with no subject.
 */
export function unansweredAbilities(
  state: BuilderState,
  rulesVersion: RulesVersion,
): SpellGrantSource[] {
  return reachedGrantsFor(state, rulesVersion)
    .filter(
      ({ source, entries }) =>
        !state.spellAbilityChoices[source.key] &&
        entries.some((entry) => (entry.ability?.choose.length ?? 0) > 0 && entry.names.length > 0),
    )
    .map(({ source }) => source);
}

/** The abilities a grant offers, in the order the data lists them. */
export function abilityOptionsOf(source: SpellGrantSource): string[] {
  for (const entry of source.entries) {
    if (entry.ability?.choose.length) return entry.ability.choose;
  }

  return [];
}

/**
 * A choice a grant states as a filter rather than as a name.
 *
 * "Two cantrips of your choice from that class's spell list", "one 1st-level
 * divination or enchantment spell". The filter is not a grant and cannot be
 * resolved for the player: choosing one would put a spell on the sheet they
 * never picked. It is a question, and this is the question.
 */
export type GrantedSpellChoice = {
  /** Where the answer lives. Stable across a redraw of the same draft. */
  key: string;
  /** What is asking, and for what: "Magic Initiate · Wizard Spells". */
  label: string;
  chamber: SpellGrantSource["chamber"];
  count: number;
  /** The spells that match, by name, as the index writes them. */
  options: string[];
};

/**
 * Every filter question this draft has reached, with what answers it.
 *
 * A filter with no count takes everything it matches, which is a widening of
 * the pool rather than a question — the warlock patron's expanded list works
 * that way. Only the bounded ones are asked.
 */
export function grantedSpellChoicesFor(
  state: BuilderState,
  rulesVersion: RulesVersion,
): GrantedSpellChoice[] {
  const spells = forRulesVersion(collections.spell ?? [], rulesVersion) as SpellRow[];
  const questions: GrantedSpellChoice[] = [];

  for (const { source, entries } of reachedGrantsFor(state, rulesVersion)) {
    for (const [index, entry] of entries.entries()) {
      for (const [at, filter] of entry.filters.entries()) {
        if (filter.count === null) continue;

        const parsed = parseSpellFilter(filter.filter);
        const options = spells.filter((row) => spellMatchesFilter(row, parsed)).map((row) => row.name);
        if (!options.length) continue;

        questions.push({
          key: `${source.key}:${index}:${at}`,
          label: entry.variant ? `${source.label} · ${entry.variant}` : source.label,
          chamber: source.chamber,
          count: filter.count,
          options: [...new Set(options)].sort((a, b) => a.localeCompare(b)),
        });
      }

      // A named shortlist is the same question with the list already written.
      for (const [at, choice] of entry.choices.entries()) {
        questions.push({
          key: `${source.key}:${index}:list${at}`,
          label: entry.variant ? `${source.label} · ${entry.variant}` : source.label,
          chamber: source.chamber,
          count: choice.count,
          options: choice.from.map((ref) => ref.name),
        });
      }
    }
  }

  return questions;
}

/** The filter questions this draft still owes an answer to. */
export function unansweredSpellChoices(
  state: BuilderState,
  rulesVersion: RulesVersion,
): GrantedSpellChoice[] {
  return grantedSpellChoicesFor(state, rulesVersion).filter(
    (question) => (state.grantedSpellChoices[question.key] ?? []).length < question.count,
  );
}
