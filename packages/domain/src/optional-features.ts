/**
 * The choices a class makes the player answer as it levels.
 *
 * Fighting styles, eldritch invocations, the pact boon, metamagic, maneuvers,
 * runes, arcane shots, elemental disciplines and artificer infusions are one
 * mechanism wearing nine names: a pool, and a count that grows with level.
 *
 * None of that is written down here. A class states the pools it draws from and
 * how many it knows at each level; an option states which pools it belongs to.
 * Both come off the index, which reads them from 5etools. Every table this
 * project has hand-written has turned out wrong when it was finally compared
 * against the data — class skills for eight of thirteen classes, background
 * proficiencies for 112 of 161 — so this one is not written at all.
 *
 * The types are structural rather than imported from the index, which is how
 * `levelling.ts` takes its class facts: the rules do not need to know where the
 * numbers came from.
 */

/** A pool, and how many of it a class knows at each level from 1 to 20. */
export type OptionalFeatureProgressionLike = {
  name: string;
  featureType: string[];
  countByLevel: number[];
};

/** A class or subclass in a build, with the progressions it grants. */
export type OptionalFeatureGranter = {
  name: string;
  source: string;
  level: number;
  optionalFeatureProgression: OptionalFeatureProgressionLike[];
};

/** How many options of one pool a character is entitled to, and from where. */
export type OptionalFeatureQuota = {
  /** The class or subclass that grants it, for showing the player why. */
  grantedBy: { name: string; source: string };
  /** What the class calls it, e.g. "Eldritch Invocations". */
  name: string;
  featureType: string[];
  count: number;
};

/**
 * What a character is entitled to, at the level they are.
 *
 * A progression that has not started yet — the sorcerer's metamagic before
 * level 3 — yields nothing rather than a quota of zero, so that a caller
 * showing pending choices does not have to filter empties out.
 */
export function optionalFeatureQuotas(
  granters: OptionalFeatureGranter[],
): OptionalFeatureQuota[] {
  const quotas: OptionalFeatureQuota[] = [];

  for (const granter of granters) {
    for (const progression of granter.optionalFeatureProgression) {
      const count = countAtLevel(progression, granter.level);
      if (count <= 0) continue;

      quotas.push({
        grantedBy: { name: granter.name, source: granter.source },
        name: progression.name,
        featureType: progression.featureType,
        count,
      });
    }
  }

  return quotas;
}

/**
 * How many of a pool are known at a level.
 *
 * The counts are running totals rather than per-level gains, so this is a
 * lookup and not a sum. Levels beyond the table hold at its last value, which
 * matters only for the hypothetical: no character exceeds 20.
 */
export function countAtLevel(progression: OptionalFeatureProgressionLike, level: number): number {
  if (level < 1) return 0;
  const index = Math.min(level, progression.countByLevel.length) - 1;
  return progression.countByLevel[index] ?? 0;
}

/** An option the player has taken. */
export type TakenOptionalFeature = {
  name: string;
  source: string;
  /** The pools it belongs to, so it can be counted against the right quota. */
  featureType: string[];
};

/** A quota with the picks made against it, and how many are still owed. */
export type OptionalFeatureSlot = OptionalFeatureQuota & {
  taken: TakenOptionalFeature[];
  /** Negative when a build carries more than it should — a downgraded level. */
  remaining: number;
};

/**
 * Match what the player has taken against what they are entitled to.
 *
 * A pool is matched by `featureType`, not by which class granted it: a fighter
 * who is also a battle master draws maneuvers from one pool no matter which of
 * the two rows named it. An option belonging to several pools is counted
 * against the first quota that claims it, so it is never counted twice.
 */
export function optionalFeatureSlots(
  quotas: OptionalFeatureQuota[],
  taken: TakenOptionalFeature[],
): OptionalFeatureSlot[] {
  const unclaimed = [...taken];

  return quotas.map((quota) => {
    const claimed: TakenOptionalFeature[] = [];

    for (let i = unclaimed.length - 1; i >= 0; i -= 1) {
      const candidate = unclaimed[i];
      if (!candidate?.featureType.some((type) => quota.featureType.includes(type))) continue;
      claimed.unshift(candidate);
      unclaimed.splice(i, 1);
    }

    return { ...quota, taken: claimed, remaining: quota.count - claimed.length };
  });
}

/** A prerequisite the rules state in a form worth checking. */
export type OptionalFeaturePrerequisiteLike =
  | { kind: "level"; level: number; className: string | null; classSource: string | null }
  | { kind: "pact"; pact: string }
  | { kind: "spell"; spell: string }
  | { kind: "optionalfeature"; name: string; source: string | null };

/** What a build has, in the terms prerequisites are stated in. */
export type OptionalFeatureContext = {
  /** Level per class, keyed `"Warlock|PHB"`, plus the character's total. */
  classLevels: Record<string, number>;
  characterLevel: number;
  /** Pact boons taken, as the short name a prerequisite names: "Tome". */
  pacts: string[];
  /** Spells known, by name. */
  spells: string[];
  /** Options already taken, so one can require another. */
  taken: { name: string; source: string }[];
};

const fold = (value: string) => value.trim().toLowerCase();

/**
 * The prerequisite name of a pact boon.
 *
 * An invocation asks for `"Tome"`; the boon that grants it is called
 * `"Pact of the Tome"`. The two have to be brought together somewhere, and
 * doing it here keeps the callers from each inventing their own way.
 */
export function pactNameOf(boonName: string): string {
  return boonName.replace(/^Pact of the\s+/i, "").trim();
}

/**
 * Which of an option's prerequisites a build fails.
 *
 * An empty result means it can be taken. Prose prerequisites are not consulted:
 * the index keeps them apart precisely because checking them would mean
 * guessing, and a guess that hides a legal option is worse than showing it.
 */
export function unmetPrerequisites(
  prerequisites: OptionalFeaturePrerequisiteLike[],
  context: OptionalFeatureContext,
): OptionalFeaturePrerequisiteLike[] {
  return prerequisites.filter((entry) => !isMet(entry, context));
}

function isMet(
  entry: OptionalFeaturePrerequisiteLike,
  context: OptionalFeatureContext,
): boolean {
  switch (entry.kind) {
    case "level": {
      // A level prerequisite names the class it counts in. Against a
      // multiclass build that is the level in *that* class, not the character's
      // total: a Warlock 2 / Fighter 10 cannot take an invocation that asks for
      // Warlock 5. An unnamed class falls back to the character level.
      if (!entry.className) return context.characterLevel >= entry.level;

      const key = `${entry.className}|${entry.classSource ?? ""}`;
      const exact = context.classLevels[key];
      if (exact != null) return exact >= entry.level;

      // The source may differ from the one the prerequisite names — an option
      // printed in one book asking for a class printed in another. Fall back to
      // the class by name.
      const wantedClass = fold(entry.className);
      const byName = Object.entries(context.classLevels).find(
        ([candidate]) => fold(candidate.split("|")[0] ?? "") === wantedClass,
      );

      return byName ? byName[1] >= entry.level : false;
    }

    case "pact":
      return context.pacts.some((pact) => fold(pact) === fold(entry.pact));

    case "spell": {
      // Stated as `"eldritch blast#c"`, where the suffix marks a cantrip. The
      // name is the part that identifies it.
      const wanted = fold(entry.spell.split("#")[0] ?? "");
      return context.spells.some((spell) => fold(spell) === wanted);
    }

    case "optionalfeature": {
      const wanted = fold(entry.name);
      return context.taken.some(
        (option) =>
          fold(option.name) === wanted &&
          (!entry.source || fold(option.source) === fold(entry.source)),
      );
    }

    default:
      return true;
  }
}
