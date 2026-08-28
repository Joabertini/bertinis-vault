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
import { speciesProficienciesFor } from "./species";
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
  /**
   * Whether this offer buys a skill or a tool.
   *
   * They land in the same list on the sheet — being proficient with thieves
   * tools is one fact — but they are not the same question, and a picker
   * labelled "Competencias" over three artisan tools reads as a bug.
   */
  kind: "skill" | "tool";
  /**
   * The kind of tool, where the data names a kind and not a list.
   *
   * Absent unless the offer is one of those. There is no list to pick from,
   * so the sheet says what is owed and the player writes what they took.
   */
  scope?: "artisan" | "instrument";
  /** Who is asking, for the label. */
  from: "clase" | "trasfondo" | "multiclase" | "especie";
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

  /*
   * What the species hands over, and what it asks.
   *
   * 77 of the 258 species rows grant a skill and 14 grant a tool, and until
   * this block existed not one of them reached a character: the half-orc's
   * Intimidation, the elf's choice of three, the 2024 human's free skill and
   * the 2014 dwarf's three artisan's tools were all read off the page and
   * typed in by hand, or lost.
   */
  const species = state.raceId
    ? speciesProficienciesFor(state.raceId, state.subraceId, rulesVersion, state.sourceBooks)
    : null;

  for (const choice of species?.skills.choices ?? []) {
    if (choice.count <= 0) continue;
    offers.push({
      // "Any skill" has no list in the data, and the whole skill list is what
      // it means rather than a guess at what it means.
      options: choice.scope === "any" ? [...ALL_SKILLS] : choice.options,
      count: choice.count,
      isOpen: choice.scope === "any",
      kind: "skill",
      from: "especie",
    });
  }

  for (const choice of species?.tools.choices ?? []) {
    if (choice.count <= 0) continue;
    offers.push({
      options: choice.options,
      count: choice.count,
      // A kind of tool with no list — "any artisan's tools". Written down
      // rather than picked, because the list is not in the data and making
      // one up here would be making up a rule.
      isOpen: choice.scope !== null,
      ...(choice.scope && choice.scope !== "any" ? { scope: choice.scope } : {}),
      kind: "tool",
      from: "especie",
    });
  }

  if (classChoice && classChoice.count > 0) {
    offers.push({
      options: classChoice.isOpen ? [...ALL_SKILLS] : classChoice.options,
      count: classChoice.count,
      isOpen: Boolean(classChoice.isOpen),
      kind: "skill",
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
      kind: "skill",
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
      kind: "skill",
      from: "multiclase",
    });
  }

  return {
    grantedSkills: dedupe([...(species?.skills.granted ?? []), ...background.skillsGranted]),
    grantedTools: dedupe([
      ...(species?.tools.granted ?? []),
      ...background.toolsGranted,
      ...multiclass.tools,
    ]),
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

/**
 * Whether every offer has been paid in full.
 *
 * An offer that names a kind and not a list is left out. There is nothing to
 * pick from, so nothing can ever be assigned to it, and counting it would hold
 * the player in the chamber forever over a question with no answer on screen —
 * the sheet says what the species owes and the player writes it in by hand.
 */
export function offersAreSatisfied(offers: SkillOffer[], chosen: string[]): boolean {
  const assigned = assignOffers(offers, chosen);
  return offers.every(
    (offer, at) => offer.scope !== undefined || (assigned[at] as string[]).length >= offer.count,
  );
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
