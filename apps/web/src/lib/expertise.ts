/**
 * Expertise, as the Forge has to ask it.
 *
 * The rules live in `packages/domain/src/expertise.ts` — what a grant offers,
 * whether it asks anything, and whether an answer is legal. This file is only
 * the wiring: it reads the grants off the index for every class the character
 * has, works out which proficiencies they actually hold, and hands both to the
 * rules layer.
 *
 * The pool is the interesting part. Expertise doubles a proficiency, so it
 * cannot be listed in the data: a rogue who took Stealth can double Stealth
 * and one who did not, cannot. The offer changes as the player picks skills in
 * an earlier chamber, which is why this is computed rather than stored.
 */

import {
  activeExpertiseGrants,
  expertiseFrom,
  expertiseProblems,
  isExpertiseChoice,
  type ExpertiseAnswer,
  type ExpertiseGrantLike,
  type ExpertiseProblem,
} from "@bertinis-vault/domain";
import type { RulesVersion } from "@bertinis-vault/vetools-ref";

import { classesFor, classifyProficiencyKind, type BuilderState } from "./builder";
import { classInfoFor, subclassInfoFor } from "./index-options";
import { proficiencyPlan } from "./grants";
import { parseLineList, uniqueEntries } from "./builder";

/** One grant, with whatever the player has answered for it. */
export type ExpertiseSlot = {
  /**
   * Stable across renders and across reordering.
   *
   * A rogue has two grants both named "Expertise", at levels 1 and 6, so the
   * name alone would collapse them into one answer and silently spend the
   * level 6 picks on the level 1 question.
   */
  key: string;
  grant: ExpertiseGrantLike;
  /** The class or subclass that hands it out, for the label. */
  from: string;
  /** False when the grant names what it doubles and asks nothing. */
  isChoice: boolean;
  answer: ExpertiseAnswer | null;
  problems: ExpertiseProblem[];
};

export type ExpertisePlan = {
  slots: ExpertiseSlot[];
  /** What the character is proficient in, which is what they may double. */
  proficientSkills: string[];
  proficientTools: string[];
  /** Everything doubled so far, chosen and named together. */
  doubled: { skills: string[]; tools: string[] };
};

const keyOf = (classId: string, grant: ExpertiseGrantLike) =>
  `${classId}:${grant.source}:${grant.name}:${grant.level}`;

/**
 * The proficiencies this character holds, split into skills and tools.
 *
 * Read off the same text the Skills chamber writes, so a skill the player
 * picks there becomes doublable here without a second source of truth.
 */
function heldProficiencies(state: BuilderState, rulesVersion: RulesVersion) {
  const plan = proficiencyPlan(state, rulesVersion);
  const written = uniqueEntries([
    ...plan.grantedSkills,
    ...plan.grantedTools,
    ...parseLineList(state.proficienciesText),
  ]);

  const skills: string[] = [];
  const tools: string[] = [];

  for (const entry of written) {
    const kind = classifyProficiencyKind(entry).kind;
    if (kind === "skill") skills.push(entry);
    else if (kind === "tool") tools.push(entry);
  }

  return { skills, tools };
}

/**
 * Every expertise grant this character has earned, in the order they earned
 * them, with the problems each answer has.
 *
 * Order matters beyond presentation: a grant can only double what an earlier
 * one has not, so the level 6 rogue grant is checked against what the level 1
 * grant already took.
 */
export function expertisePlanFor(state: BuilderState, rulesVersion: RulesVersion): ExpertisePlan {
  const { skills: proficientSkills, tools: proficientTools } = heldProficiencies(
    state,
    rulesVersion,
  );

  const slots: ExpertiseSlot[] = [];

  for (const entry of classesFor(state)) {
    const classRow = classInfoFor(entry.classId, rulesVersion);
    const subclassRow = entry.subclassId
      ? subclassInfoFor(entry.subclassId, entry.classId, rulesVersion)
      : null;

    const sources: { label: string; grants: ExpertiseGrantLike[] }[] = [
      { label: classRow?.name ?? entry.classId, grants: (classRow?.expertise ?? []) as ExpertiseGrantLike[] },
      { label: subclassRow?.name ?? "", grants: (subclassRow?.expertise ?? []) as ExpertiseGrantLike[] },
    ];

    for (const source of sources) {
      const active = activeExpertiseGrants({
        grants: source.grants,
        level: entry.level,
        // Deft Explorer is Tasha's replacement for Natural Explorer: a 2014
        // ranger who kept the original earns no expertise from it. Read off
        // the talents the player actually took.
        variantsTaken: state.optionalFeatureIds,
      });

      for (const grant of active) {
        const key = keyOf(entry.classId, grant);
        slots.push({
          key,
          grant,
          from: source.label,
          isChoice: isExpertiseChoice(grant),
          answer: state.expertiseChoices[key] ?? null,
          problems: [],
        });
      }
    }
  }

  // Checked in earned order, each against what the ones before it took.
  const doubled = { skills: [] as string[], tools: [] as string[] };

  for (const slot of slots) {
    slot.problems = expertiseProblems({
      grant: slot.grant,
      answer: slot.answer,
      proficientSkills,
      proficientTools,
      alreadyExpert: { skills: [...doubled.skills], tools: [...doubled.tools] },
    });

    const taken = expertiseFrom([{ grant: slot.grant, answer: slot.answer }]);
    doubled.skills.push(...taken.skills);
    doubled.tools.push(...taken.tools);
  }

  return {
    slots,
    proficientSkills,
    proficientTools,
    doubled: {
      skills: uniqueEntries(doubled.skills),
      tools: uniqueEntries(doubled.tools),
    },
  };
}
