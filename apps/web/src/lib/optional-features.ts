/**
 * The picks a class hands out as it levels.
 *
 * Fighting styles, eldritch invocations, the pact boon, metamagic, battle
 * master maneuvers, arcane shots, elemental disciplines, runes and artificer
 * infusions are all one thing in 5etools — an `optionalfeature` — and all
 * import the same way a feat does. They are not feats: they are answers to a
 * question the class asked, and the class asks for a bounded number.
 *
 * How many is not a table written here. Every class and subclass in the index
 * carries an `optionalFeatureProgression` with a running total for each of the
 * twenty levels, so a warlock's invocations going 2, 2, 2, 3, 3, 4 is read
 * rather than restated.
 *
 * Prerequisites come in two kinds. The checkable ones — a level, a pact, a
 * known spell, another feature — are enforced. The prose ones ("Dragonmarked
 * House Renown 25+") are shown for the player to judge, because checking them
 * would mean guessing.
 */

import {
  collections,
  forRulesVersion,
  spellPrerequisiteName,
  type ClassRow,
  type OptionalFeaturePrerequisite,
  type OptionalFeatureProgression,
  type OptionalFeatureRow,
  type SubclassRow,
} from "@bertinis-vault/vetools-index";
import type { RulesVersion } from "@bertinis-vault/vetools-ref";

import type { BuilderState } from "./builder";
import { slugOf } from "./index-options";
import { toLines } from "./grants";
import { parseSpellLine } from "./spells";

export type TalentOption = {
  id: string;
  label: string;
  source: string;
  /** Prerequisites stated as prose, for the player to judge. */
  notes: string[];
  /** False when a checkable prerequisite is not met. */
  eligible: boolean;
  /** Why not, when it is not. */
  blockedBy?: string;
};

export type TalentPool = {
  /** What the class calls it, e.g. "Eldritch Invocations". */
  name: string;
  /** How many the character knows at this level. */
  count: number;
  options: TalentOption[];
};

/**
 * Every pool the character's class and subclass offer at their level.
 *
 * Pools with a count of zero are dropped: a sorcerer below level 3 has no
 * metamagic, and showing an empty "choose 0" section reads as a bug.
 */
export function talentPools(
  state: BuilderState,
  rulesVersion: RulesVersion,
  classLabel: string,
  subclassLabel: string,
): TalentPool[] {
  if (!state.classId) return [];

  const classRow = findClass(classLabel, rulesVersion);
  const subclassRow = subclassLabel ? findSubclass(subclassLabel, rulesVersion) : null;

  const progressions: OptionalFeatureProgression[] = [
    ...(classRow?.optionalFeatureProgression ?? []),
    ...(subclassRow?.optionalFeatureProgression ?? []),
  ];

  const allFeatures = forRulesVersion(
    collections.optionalfeature ?? [],
    rulesVersion,
  ) as OptionalFeatureRow[];

  const taken = new Set(state.optionalFeatureIds);

  return progressions
    .map((progression) => {
      const count = progression.countByLevel[state.level - 1] ?? 0;
      if (count <= 0) return null;

      const pools = new Set(progression.featureType);
      const options = allFeatures
        .filter((row) => row.featureType.some((type) => pools.has(type)))
        .map((row) => toOption(row, state, taken, classLabel))
        .sort((a, b) => Number(b.eligible) - Number(a.eligible) || a.label.localeCompare(b.label));

      return { name: progression.name, count, options };
    })
    .filter((pool): pool is TalentPool => pool !== null);
}

function toOption(
  row: OptionalFeatureRow,
  state: BuilderState,
  taken: Set<string>,
  classLabel: string,
): TalentOption {
  const unmet = row.prerequisites
    .map((prerequisite) => unmetReason(prerequisite, state, taken, classLabel))
    .filter((reason): reason is string => reason !== null);

  return {
    id: slugOf(row.name),
    label: row.name,
    source: row.source,
    notes: row.prerequisiteText ?? [],
    eligible: unmet.length === 0,
    ...(unmet[0] ? { blockedBy: unmet[0] } : {}),
  };
}

/** Why a prerequisite is not met, or null when it is. */
function unmetReason(
  prerequisite: OptionalFeaturePrerequisite,
  state: BuilderState,
  taken: Set<string>,
  classLabel: string,
): string | null {
  switch (prerequisite.kind) {
    case "level": {
      // A level prerequisite naming another class does not apply here.
      if (prerequisite.className && prerequisite.className !== classLabel) return null;
      return state.level >= prerequisite.level ? null : `Requiere nivel ${prerequisite.level}`;
    }

    case "pact": {
      const pact = `pact-of-the-${prerequisite.pact.toLowerCase()}`;
      return [...taken].some((id) => id.includes(prerequisite.pact.toLowerCase()))
        ? null
        : `Requiere ${pact.replace(/-/g, " ")}`;
    }

    case "spell": {
      /*
       * 5etools writes these as "eldritch blast#c" — the suffix is the level.
       *
       * Except for three 2024 invocations, which state the requirement as a
       * kind: "a Warlock Cantrip That Deals Damage", carried as an object.
       * Calling `.split` on that threw, and because this runs while the Forge
       * renders, the throw was the whole page: any draft with a 2024 warlock
       * showed a blank screen.
       *
       * A description cannot be matched against what the character wrote down,
       * so it is shown rather than judged. Refusing the pick over a
       * requirement this cannot read would be inventing a verdict.
       */
      const wanted = spellPrerequisiteName(prerequisite.spell);
      if (wanted === null) return null;

      const known = [
        ...toLines(state.cantripsText).map((entry) => entry.toLowerCase()),
        ...toLines(state.spellsText).map((entry) => parseSpellLine(entry)?.name.toLowerCase() ?? ""),
      ];
      return known.includes(wanted.toLowerCase()) ? null : `Requiere conocer ${wanted}`;
    }

    case "optionalfeature":
      return taken.has(slugOf(prerequisite.name)) ? null : `Requiere ${prerequisite.name}`;

    default:
      return null;
  }
}

function findClass(label: string, rulesVersion: RulesVersion): ClassRow | null {
  if (!label) return null;
  const rows = forRulesVersion(collections.class ?? [], rulesVersion) as ClassRow[];
  return rows.find((row) => row.name === label) ?? null;
}

function findSubclass(label: string, rulesVersion: RulesVersion): SubclassRow | null {
  const rows = forRulesVersion(collections.subclass ?? [], rulesVersion) as SubclassRow[];
  return rows.find((row) => row.name === label) ?? null;
}

/** Whether every pool has been filled to its count. */
export function talentsSatisfied(pools: TalentPool[], chosen: string[]): boolean {
  const taken = new Set(chosen);

  return pools.every((pool) => {
    const inPool = pool.options.filter((option) => taken.has(option.id)).length;
    return inPool >= pool.count;
  });
}

/**
 * Talents already on the build that the character no longer qualifies for.
 *
 * The picker greys out what cannot be taken, which covers the moment of
 * choosing and nothing after it. A build drifts: a warlock who swaps Pact of
 * the Blade keeps every invocation that asked for it, and a wizard who drops
 * Eldritch Blast keeps Agonizing Blast. Both are illegal and both look fine.
 *
 * Reported, never removed. Taking a pick away from a player because a
 * prerequisite moved is how a builder loses a character's work; saying so and
 * letting them decide is not.
 *
 * An option the pools no longer offer at all — a talent from a class the
 * character used to be — is left alone here: that is a different problem, and
 * this function would only be guessing at it.
 */
export function unmetTalents(
  pools: TalentPool[],
  chosen: string[],
): { id: string; label: string; reason: string }[] {
  const taken = new Set(chosen);

  return pools
    .flatMap((pool) => pool.options)
    .filter((option) => taken.has(option.id) && !option.eligible)
    .map((option) => ({
      id: option.id,
      label: option.label,
      reason: option.blockedBy ?? "ya no cumple su requisito",
    }));
}
