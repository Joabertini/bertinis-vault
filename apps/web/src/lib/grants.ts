/**
 * What a character is given, and what they are still asked.
 *
 * Three sources hand out proficiencies and languages, and they behave
 * differently: a background grants its skills outright, a class offers a
 * bounded choice from a named list, and a species grants languages with
 * sometimes a free pick on top.
 *
 * Languages used to live here too, from a hand-written table of 25 species
 * against the 160 the index carries. They moved to `languages.ts`, where they
 * are read from the data — see the note at the top of that file.
 *
 * The distinction matters to the UI. A granted skill is not a checkbox — it is
 * already true, and rendering it as an unticked option invites a player to
 * "choose" something they cannot decline. So granted and offered are kept
 * apart here rather than merged into one list of options.
 */

import type { RulesVersion } from "@bertinis-vault/vetools-ref";

import type { BuilderState } from "./builder";
import {
  multiclassGrantsFor,
  proficiencyGrantForBackground,
  skillChoiceForClass,
} from "./index-options";

export type SkillOffer = {
  options: string[];
  count: number;
  /** True when the list is "any skill", not a named set. */
  isOpen: boolean;
  /** Who is asking, for the label. */
  from: "clase" | "trasfondo" | "multiclase";
};

export type ProficiencyPlan = {
  /** Already true. Not choosable. */
  grantedSkills: string[];
  grantedTools: string[];
  /** Bounded choices still open, in the order they should be presented. */
  offers: SkillOffer[];
};

/** Every skill in the game, for the offers that say "any". */
export const ALL_SKILLS = [
  "Acrobatics",
  "Animal Handling",
  "Arcana",
  "Athletics",
  "Deception",
  "History",
  "Insight",
  "Intimidation",
  "Investigation",
  "Medicine",
  "Nature",
  "Perception",
  "Performance",
  "Persuasion",
  "Religion",
  "Sleight of Hand",
  "Stealth",
  "Survival",
] as const;

export function proficiencyPlan(
  state: BuilderState,
  rulesVersion: RulesVersion,
): ProficiencyPlan {
  const background = state.backgroundId
    ? proficiencyGrantForBackground(
        state.backgroundId,
        rulesVersion,
        state.sourceBooks[`background:${state.backgroundId}`],
      )
    : { skillsGranted: [], skillChoice: null, toolsGranted: [] };

  const classChoice = state.classId ? skillChoiceForClass(state.classId, rulesVersion) : null;

  const offers: SkillOffer[] = [];

  if (classChoice && classChoice.count > 0) {
    offers.push({
      options: classChoice.isOpen ? [...ALL_SKILLS] : classChoice.options,
      count: classChoice.count,
      isOpen: Boolean(classChoice.isOpen),
      from: "clase",
    });
  }

  if (background.skillChoice && background.skillChoice.count > 0) {
    offers.push({
      options: background.skillChoice.isOpen
        ? [...ALL_SKILLS]
        : background.skillChoice.options,
      count: background.skillChoice.count,
      isOpen: Boolean(background.skillChoice.isOpen),
      from: "trasfondo",
    });
  }

  /*
   * What the classes past the first hand over.
   *
   * Less than a first class does, and from a different block: a rogue who dips
   * picks one skill from their list, not the four a first-level rogue picks.
   * Reading the starting block for a second class would hand the player
   * proficiencies their character does not have.
   *
   * Only skills and tools land here, because those are what this plan models.
   * The armour and weapons a class grants reach no character today, first
   * class included — a gap of its own rather than one this file can close.
   */
  const multiclass = multiclassGrantsFor({
    classIds: state.extraClasses
      .filter((extra) => extra.classId && extra.level >= 1)
      .map((extra) => extra.classId),
    rulesVersion,
  });

  if (multiclass.skillChoice && multiclass.skillChoice.count > 0) {
    offers.push({
      options: multiclass.skillChoice.options,
      count: multiclass.skillChoice.count,
      isOpen: false,
      from: "multiclase",
    });
  }

  return {
    grantedSkills: dedupe(background.skillsGranted),
    grantedTools: dedupe([...background.toolsGranted, ...multiclass.tools]),
    offers,
  };
}

/**
 * Which offer paid for each skill the player chose.
 *
 * The draft stores proficiencies as one flat list, because that is what the
 * payload wants and because being proficient in Stealth is one fact however
 * you came by it. But the *asking* is not flat: a wizard offers two skills
 * from its list and a background may offer two more from another, and those
 * are separate budgets.
 *
 * Read as one list they are not. Every picker counted the whole list against
 * its own limit, so two picks from the class filled the background's quota
 * too — its remaining options went grey, nothing could be chosen there, and
 * the chamber could never be satisfied because that offer had no picks of its
 * own. The player could not go back and could not go on.
 *
 * Assignment is greedy in the order the offers are presented, which is the
 * order the books ask in: class first, then background, then a dip. A skill
 * both lists can pay for is charged to the first that still has room — the
 * character ends up proficient either way, and the alternative is asking the
 * player to care about an accounting detail the rules never mention.
 */
export function assignOffers(offers: SkillOffer[], chosen: string[]): string[][] {
  const assigned: string[][] = offers.map(() => []);
  const taken = new Set<string>();

  for (const skill of chosen) {
    if (taken.has(skill)) continue;
    const index = offers.findIndex(
      (offer, at) =>
        offer.options.includes(skill) && (assigned[at] as string[]).length < offer.count,
    );
    if (index < 0) continue;
    (assigned[index] as string[]).push(skill);
    taken.add(skill);
  }

  return assigned;
}

/** Whether every offer has been paid in full. */
export function offersAreSatisfied(offers: SkillOffer[], chosen: string[]): boolean {
  const assigned = assignOffers(offers, chosen);
  return offers.every((offer, at) => (assigned[at] as string[]).length >= offer.count);
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

/* ---------------- text plumbing ---------------- */

/**
 * The builder stores these as newline-separated text.
 *
 * That is the shape `buildCanonicalSnapshot` parses and classifies, so the
 * pickers read and write it rather than inventing a parallel representation
 * that would then need syncing.
 */
export function toLines(value: string): string[] {
  return value
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function fromLines(values: string[]): string {
  return dedupe(values).join("\n");
}
