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
  preparationForKind,
  spellVariantsOf,
  warlockPactSlotLevelByClassLevel,
  type GrantedSpellEntry,
} from "@bertinis-vault/domain";
import {
  collections,
  forRulesVersion,
  type RaceRow,
  type SubclassRow,
  type SubraceRow,
} from "@bertinis-vault/vetools-index";
import type { RulesVersion } from "@bertinis-vault/vetools-ref";

import type { BuilderState } from "./builder-state";
import { classEntriesFor } from "./classing";
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
  chamber: "species" | "class";
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

  for (const entry of classEntriesFor(
    { classId: state.classId, subclassId: state.subclassId, level: state.level },
    state.extraClasses,
    rulesVersion,
  )) {
    if (!entry.subclassId) continue;
    const subclass: SubclassRow | null = subclassInfoFor(
      entry.subclassId,
      entry.classId,
      rulesVersion,
    );
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
    for (const entry of entries) {
      const preparation = preparationForKind(entry.kind);
      if (!preparation) continue;

      for (const ref of entry.names) {
        out.push({
          label: ref.name,
          source: ref.source,
          preparation,
          ...(entry.kind === "innate"
            ? { method: entry.recharge === "will" ? ("atwill" as const) : ("innate" as const) }
            : {}),
          ...(entry.uses && entry.recharge && RECOVERY_PERIOD[entry.recharge]
            ? { uses: { max: entry.uses, period: RECOVERY_PERIOD[entry.recharge]! } }
            : {}),
          grantedBy: source.label,
        });
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
