/**
 * Which level-up answers a character actually has.
 *
 * `levelChoices` is one map of answers. Two things about it were wrong:
 *
 * - **Only the first class asked.** The plan read the primary class and its
 *   level, so a fighter 4 / wizard 4 was offered one improvement where the
 *   rules give two: every class grants its own at its own class levels.
 * - **Every stored answer counted.** The scores summed the whole map, so a
 *   fighter 8 rebuilt as a wizard 8 kept the answer to the fighter's level 6 —
 *   an improvement the wizard does not have.
 *
 * So answers are now read through the slots the classes grant. The primary
 * class keeps its plain level keys, `"4"`, which is what every saved draft
 * already holds; another class's are `"wizard:4"`. An answer no slot asks for
 * is kept in the draft — switching back gives it back — and counts for
 * nothing.
 */

import {
  mergeBonuses,
  pointsPerImprovement,
  pointsSpent,
  type AbilityBonusMap,
  type LevelChoice,
} from "@bertinis-vault/domain";
import type { RulesVersion } from "@bertinis-vault/vetools-ref";

import type { BuilderState } from "./builder-state";
import { levellingFor } from "./index-options";

/** One point on the way up where a class asks for an improvement or a feat. */
export type ImprovementSlot = {
  /** Where the answer is stored in `levelChoices`. */
  key: string;
  /** The class level that asks. */
  level: number;
  classId: string;
  /** True for the first class, whose keys are bare levels. */
  primary: boolean;
};

/** The key another class's answer is stored under. */
export function extraChoiceKey(classId: string, level: number): string {
  return `${classId}:${level}`;
}

function rulesVersionOf(state: BuilderState): RulesVersion {
  return state.rulesVersion === "5e-2024" ? "2024" : "2014";
}

/** Every slot the character's classes grant, first class first, in level order. */
export function improvementSlotsFor(state: BuilderState): ImprovementSlot[] {
  const rulesVersion = rulesVersionOf(state);
  const slots: ImprovementSlot[] = [];

  for (const level of levellingFor(state.classId, rulesVersion).improvementLevels) {
    if (level <= state.level) {
      slots.push({ key: String(level), level, classId: state.classId, primary: true });
    }
  }

  // A class counted once: two rows of the same class are one class with the
  // levels split, and its answers live under one set of keys.
  const seen = new Set([state.classId]);
  for (const extra of state.extraClasses) {
    if (!extra.classId || extra.level < 1 || seen.has(extra.classId)) continue;
    seen.add(extra.classId);

    for (const level of levellingFor(extra.classId, rulesVersion).improvementLevels) {
      if (level <= extra.level) {
        slots.push({ key: extraChoiceKey(extra.classId, level), level, classId: extra.classId, primary: false });
      }
    }
  }

  return slots;
}

/** The answers the slots hold, in slot order. Unanswered slots are skipped. */
export function levelChoicesInEffect(state: BuilderState, exceptKey?: string): LevelChoice[] {
  return improvementSlotsFor(state).flatMap((slot) => {
    if (slot.key === exceptKey) return [];
    const choice = state.levelChoices[slot.key];
    return choice ? [choice] : [];
  });
}

/** What the improvements raise. A feat's own raise belongs to the feat, not here. */
export function levelBonusesFor(state: BuilderState, exceptKey?: string): AbilityBonusMap {
  return mergeBonuses(
    ...levelChoicesInEffect(state, exceptKey).map((choice) =>
      choice.kind === "improvement" ? choice.bonuses : {},
    ),
  );
}

/** The feats taken in place of an improvement, in slot order, without blanks. */
export function levelFeatsFor(state: BuilderState): string[] {
  return levelChoicesInEffect(state).flatMap((choice) =>
    choice.kind === "feat" && choice.featId ? [choice.featId] : [],
  );
}

/** Slots still waiting: no answer, a feat not named, or points left to spend. */
export function unansweredSlotsFor(state: BuilderState): ImprovementSlot[] {
  return improvementSlotsFor(state).filter((slot) => {
    const choice = state.levelChoices[slot.key];
    if (!choice) return true;
    if (choice.kind === "feat") return !choice.featId;
    return pointsSpent(choice.bonuses) < pointsPerImprovement;
  });
}
