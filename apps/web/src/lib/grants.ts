/**
 * What a character is given, and what they are still asked.
 *
 * Three sources hand out proficiencies and languages, and they behave
 * differently: a background grants its skills outright, a class offers a
 * bounded choice from a named list, and a species grants languages with
 * sometimes a free pick on top.
 *
 * The distinction matters to the UI. A granted skill is not a checkbox — it is
 * already true, and rendering it as an unticked option invites a player to
 * "choose" something they cannot decline. So granted and offered are kept
 * apart here rather than merged into one list of options.
 */

import { getRaceLanguageRule } from "@bertinis-vault/data-engine";
import type { RulesVersion } from "@bertinis-vault/vetools-ref";

import type { BuilderState } from "./builder";
import { proficiencyGrantForBackground, skillChoiceForClass } from "./index-options";

export type SkillOffer = {
  options: string[];
  count: number;
  /** True when the list is "any skill", not a named set. */
  isOpen: boolean;
  /** Who is asking, for the label. */
  from: "clase" | "trasfondo";
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

  return {
    grantedSkills: dedupe(background.skillsGranted),
    grantedTools: dedupe(background.toolsGranted),
    offers,
  };
}

export type LanguagePlan = {
  fixed: string[];
  choiceCount: number;
  choiceOptions: string[];
};

/**
 * The languages a species knows, and how many more it may pick.
 *
 * Comes from the hand-written rules rather than the index, which carries no
 * language data. A species with no rule falls back to Common, which is what
 * every species in the game knows.
 */
export function languagePlan(state: BuilderState): LanguagePlan {
  const rule = getRaceLanguageRule(state.raceId);

  return {
    fixed: dedupe(rule.fixed ?? ["Common"]),
    choiceCount: rule.choiceCount ?? 0,
    choiceOptions: rule.choiceOptions ?? COMMON_LANGUAGES,
  };
}

/** The languages a free pick usually comes from. */
const COMMON_LANGUAGES = [
  "Dwarvish",
  "Elvish",
  "Giant",
  "Gnomish",
  "Goblin",
  "Halfling",
  "Orc",
  "Abyssal",
  "Celestial",
  "Draconic",
  "Deep Speech",
  "Infernal",
  "Primordial",
  "Sylvan",
  "Undercommon",
];

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
