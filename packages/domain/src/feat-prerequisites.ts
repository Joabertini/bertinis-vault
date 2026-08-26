/**
 * Whether a character may take a feat, reported rather than enforced.
 *
 * 205 of the 276 feats state a prerequisite and nothing read any of them, so
 * the builder offered Heavily Armored to a wizard and Elemental Adept to a
 * barbarian. Both are illegal, and both would have reached the sheet.
 *
 * The list is *alternatives*: one entry holding is enough, and every field
 * inside that entry must hold. This is the same shape the multiclass rule
 * uses, and `meetsRequirement` is reused for the ability half of it.
 *
 * Half of what the books state cannot be checked against a build at all — a
 * Ravenloft campaign, a dragonmark category, "no other dragonmark". Those are
 * a table's business. They are reported as unverifiable rather than assumed to
 * pass, because a silent pass is a claim, and this module does not have the
 * standing to make it.
 */

import { meetsRequirement, type AbilityRequirement } from "./multiclass.js";

export type FeatPrerequisite = {
  abilities?: AbilityRequirement[];
  /** Character level, not class level. */
  level?: number;
  classLevel?: { className: string; level: number };
  races?: { name: string; subrace?: string }[];
  backgrounds?: string[];
  feats?: string[];
  features?: string[];
  proficiencies?: { kind: string; value: string }[];
  spellcasting?: boolean;
  /** Stated in the books, not checkable here. */
  other?: string[];
};

/** Everything about a character a prerequisite might ask after. */
export type FeatCandidate = {
  abilities: Record<string, number>;
  level: number;
  classes: { name: string; level: number }[];
  raceName: string;
  subraceName?: string;
  backgroundName: string;
  featNames: string[];
  featureNames: string[];
  armorProficiencies: string[];
  weaponProficiencies: string[];
  casts: boolean;
};

export type FeatPrerequisiteProblem =
  /** Every alternative failed, and this is why the closest one did. */
  | { kind: "unmet"; reasons: string[] }
  /** The books state something a build cannot answer. */
  | { kind: "unverifiable"; notes: string[] };

const normalize = (value: string) => value.trim().toLowerCase();

/**
 * Why one alternative does not hold, or an empty list when it does.
 *
 * The unverifiable half is deliberately *not* a reason: an alternative whose
 * only unmet part is a campaign setting has not failed, it has gone unchecked.
 */
function reasonsAgainst(prerequisite: FeatPrerequisite, character: FeatCandidate): string[] {
  const reasons: string[] = [];

  if (prerequisite.abilities?.length) {
    // `meetsRequirement` already takes the alternatives as a list: it is the
    // same "Intelligence or Wisdom" shape the multiclass rule states.
    if (!meetsRequirement(prerequisite.abilities, character.abilities)) {
      reasons.push(
        prerequisite.abilities
          .map((requirement) =>
            Object.entries(requirement)
              .map(([ability, score]) => `${ability.toUpperCase()} ${score}`)
              .join(" y "),
          )
          .join(" o "),
      );
    }
  }

  if (prerequisite.level && character.level < prerequisite.level) {
    reasons.push(`nivel ${prerequisite.level}`);
  }

  if (prerequisite.classLevel) {
    const { className, level } = prerequisite.classLevel;
    const taken = character.classes.find((entry) => normalize(entry.name) === normalize(className));
    // A level in a named class is not the character's level. Without this, a
    // level 3 wizard passes a requirement that wants a level 3 fighter.
    if (!taken || taken.level < level) reasons.push(`${className} nivel ${level}`);
  }

  if (prerequisite.races?.length) {
    const met = prerequisite.races.some(
      (race) =>
        normalize(race.name) === normalize(character.raceName) &&
        (!race.subrace || normalize(race.subrace) === normalize(character.subraceName ?? "")),
    );
    if (!met) {
      reasons.push(
        prerequisite.races
          .map((race) => (race.subrace ? `${race.name} (${race.subrace})` : race.name))
          .join(" o "),
      );
    }
  }

  if (prerequisite.backgrounds?.length) {
    const met = prerequisite.backgrounds.some(
      (name) => normalize(name) === normalize(character.backgroundName),
    );
    if (!met) reasons.push(prerequisite.backgrounds.join(" o "));
  }

  if (prerequisite.feats?.length) {
    const owned = character.featNames.map(normalize);
    const met = prerequisite.feats.some((name) => owned.includes(normalize(name)));
    if (!met) reasons.push(prerequisite.feats.join(" o "));
  }

  if (prerequisite.features?.length) {
    // A feature is matched loosely, because the build stores it as free text
    // and "Fighting Style: Archery" is the Fighting Style feature.
    const owned = character.featureNames.map(normalize);
    const met = prerequisite.features.some((name) =>
      owned.some((entry) => entry.includes(normalize(name))),
    );
    if (!met) reasons.push(prerequisite.features.join(" o "));
  }

  for (const proficiency of prerequisite.proficiencies ?? []) {
    const owned =
      proficiency.kind === "armor" ? character.armorProficiencies : character.weaponProficiencies;
    if (!owned.map(normalize).includes(normalize(proficiency.value))) {
      reasons.push(`competencia con ${proficiency.value}`);
    }
  }

  if (prerequisite.spellcasting && !character.casts) reasons.push("lanzar conjuros");

  return reasons;
}

/**
 * What stands between a character and a feat.
 *
 * Empty when the feat is legal, or when it states nothing. An alternative that
 * holds ends the check: the books mean "any one of these".
 */
export function featPrerequisiteProblems(
  prerequisites: FeatPrerequisite[] | null | undefined,
  character: FeatCandidate,
): FeatPrerequisiteProblem[] {
  if (!prerequisites?.length) return [];

  const failures: string[][] = [];
  const notes: string[] = [];

  for (const prerequisite of prerequisites) {
    const reasons = reasonsAgainst(prerequisite, character);
    for (const note of prerequisite.other ?? []) {
      if (!notes.includes(note)) notes.push(note);
    }
    // An alternative with nothing against it holds, even if it also carries
    // something unverifiable — the unverifiable part is the table's call.
    if (reasons.length === 0) {
      return notes.length ? [{ kind: "unverifiable", notes }] : [];
    }
    failures.push(reasons);
  }

  const problems: FeatPrerequisiteProblem[] = [];

  // The alternative closest to holding is the useful one to report: telling a
  // player they are missing five things when they are one away from a legal
  // path is worse than saying nothing.
  const closest = failures.reduce((best, current) => (current.length < best.length ? current : best));
  problems.push({ kind: "unmet", reasons: closest });

  if (notes.length) problems.push({ kind: "unverifiable", notes });

  return problems;
}

/** True when nothing mechanical stands in the way. */
export function meetsFeatPrerequisites(
  prerequisites: FeatPrerequisite[] | null | undefined,
  character: FeatCandidate,
): boolean {
  return !featPrerequisiteProblems(prerequisites, character).some(
    (problem) => problem.kind === "unmet",
  );
}
