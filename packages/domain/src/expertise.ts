/**
 * Expertise: which proficiencies a character doubles, and whether the choice
 * was answered.
 *
 * Expertise is not a proficiency. It doubles one the character already has,
 * which is why the pool cannot be listed in the data — it depends on the
 * build. A rogue who took Stealth can double Stealth; one who did not, cannot.
 * That dependency is the whole reason this needs rules rather than a table.
 *
 * Under bounded accuracy the doubling is worth more than it looks: it is the
 * only multiplier on a d20 check in the game, and it lands twice for the rogue
 * (levels 1 and 6) on the two skills the character was already best at. This
 * is why a rogue's opening skill picks are not interchangeable.
 *
 * What is *not* here is which class grants what and when. That comes off the
 * index, which reads it from 5etools' Foundry companion data.
 */

/** One way of taking a grant. `anySkill`/`anyTool` draw from what you have. */
export type ExpertiseSetLike = {
  anySkill: number;
  anyTool: number;
  skills: string[];
  tools: string[];
};

/** A grant, and the feature that hands it out. */
export type ExpertiseGrantLike = {
  name: string;
  source: string;
  level: number;
  isVariant: boolean;
  sets: ExpertiseSetLike[];
};

/**
 * Whether a grant asks the player anything.
 *
 * The scout's Survivalist doubles Nature and Survival and offers nothing to
 * decide; the rogue's offers two ways of spending two picks. Asking about the
 * first would be a question with one answer, which is the kind of interaction
 * this builder is trying to spend less of.
 *
 * This is the same test Plutonium's own picker makes, and it is made on the
 * shape rather than on a list of feature names.
 */
export function isExpertiseChoice(grant: ExpertiseGrantLike): boolean {
  if (grant.sets.length !== 1) return grant.sets.length > 1;

  const only = grant.sets[0];
  return (only?.anySkill ?? 0) > 0 || (only?.anyTool ?? 0) > 0;
}

/**
 * The grants a character has actually earned.
 *
 * A level gate and a variant gate, in that order. The variant gate matters for
 * exactly one grant in the data and matters a lot: Deft Explorer is Tasha's
 * *replacement* for the 2014 ranger's Natural Explorer, so a ranger who kept
 * the original gets no expertise from it. Handing it out regardless would give
 * every 2014 ranger a doubled skill it never chose — answered wrong rather
 * than left blank, which is the worse failure.
 */
export function activeExpertiseGrants({
  grants,
  level,
  variantsTaken = [],
}: {
  grants: ExpertiseGrantLike[];
  level: number;
  variantsTaken?: string[];
}): ExpertiseGrantLike[] {
  const taken = new Set(variantsTaken.map((name) => name.toLowerCase()));

  return grants
    .filter((grant) => grant.level <= level)
    .filter((grant) => !grant.isVariant || taken.has(grant.name.toLowerCase()))
    .sort((a, b) => a.level - b.level);
}

/** Why an answer does not match what the grant offers. */
export type ExpertiseProblem =
  /** More than one set on offer and none chosen. */
  | { kind: "unchosen" }
  /** The chosen set is not one the grant offers. */
  | { kind: "no-such-set"; index: number; sets: number }
  /** Fewer picks than the set allows. */
  | { kind: "unspent"; of: "skill" | "tool"; allowed: number; picked: number }
  /** More picks than the set allows. */
  | { kind: "overspent"; of: "skill" | "tool"; allowed: number; picked: number }
  /** Expertise doubles a proficiency; this one is not held. */
  | { kind: "not-proficient"; of: "skill" | "tool"; id: string }
  /** Already doubled, by this grant or an earlier one. */
  | { kind: "duplicate"; of: "skill" | "tool"; id: string };

/** What the player answered for one grant. */
export type ExpertiseAnswer = {
  /** Which of the grant's sets they took. */
  setIndex: number;
  /** Skills picked to fill the set's `anySkill` slots. */
  skills: string[];
  /** Tools picked to fill the set's `anyTool` slots. */
  tools: string[];
};

/**
 * Check one answer against the grant, the character's proficiencies, and what
 * is already doubled.
 *
 * `alreadyExpert` is what earlier grants took, so the rogue cannot spend its
 * level 6 picks on the skills it doubled at level 1. Nothing in the text
 * forbids that in so many words; it is simply that a bonus already doubled
 * cannot be doubled again, and a builder that allowed it would quietly waste
 * a pick the player believed they had spent.
 */
export function expertiseProblems({
  grant,
  answer,
  proficientSkills,
  proficientTools = [],
  alreadyExpert = { skills: [], tools: [] },
}: {
  grant: ExpertiseGrantLike;
  answer: ExpertiseAnswer | null;
  proficientSkills: string[];
  proficientTools?: string[];
  alreadyExpert?: { skills: string[]; tools: string[] };
}): ExpertiseProblem[] {
  if (!isExpertiseChoice(grant)) return [];
  if (!answer) return [{ kind: "unchosen" }];

  const set = grant.sets[answer.setIndex];
  if (!set) return [{ kind: "no-such-set", index: answer.setIndex, sets: grant.sets.length }];

  const problems: ExpertiseProblem[] = [];

  const check = (
    of: "skill" | "tool",
    picked: string[],
    allowed: number,
    proficient: string[],
    fixed: string[],
    already: string[],
  ) => {
    const unique = [...new Set(picked)];
    if (unique.length < allowed) {
      problems.push({ kind: "unspent", of, allowed, picked: unique.length });
    }
    if (unique.length > allowed) {
      problems.push({ kind: "overspent", of, allowed, picked: unique.length });
    }

    const held = new Set(proficient);
    // A set's fixed half counts as already doubled for its own choice half:
    // the 2014 rogue's "one skill and thieves' tools" cannot spend its skill
    // pick on thieves' tools, and nothing should double the same thing twice.
    const doubled = new Set([...already, ...fixed]);

    for (const id of unique) {
      if (!held.has(id)) problems.push({ kind: "not-proficient", of, id });
      else if (doubled.has(id)) problems.push({ kind: "duplicate", of, id });
    }
  };

  check("skill", answer.skills, set.anySkill, proficientSkills, set.skills, alreadyExpert.skills);
  check("tool", answer.tools, set.anyTool, proficientTools, set.tools, alreadyExpert.tools);

  return problems;
}

/** A grant paired with whatever the player answered for it. */
export type ExpertiseEntry = { grant: ExpertiseGrantLike; answer?: ExpertiseAnswer | null };

/**
 * Everything a set of grants doubles, chosen and fixed together.
 *
 * Fixed grants are included because nothing else applies them: the scout's
 * Nature and Survival are never picked and would otherwise reach the sheet no
 * more than an unanswered choice would.
 */
export function expertiseFrom(entries: ExpertiseEntry[]): { skills: string[]; tools: string[] } {
  const skills: string[] = [];
  const tools: string[] = [];

  const add = (into: string[], values: string[]) => {
    for (const value of values) if (value && !into.includes(value)) into.push(value);
  };

  for (const { grant, answer } of entries) {
    if (!isExpertiseChoice(grant)) {
      for (const set of grant.sets) {
        add(skills, set.skills);
        add(tools, set.tools);
      }
      continue;
    }

    const set = answer ? grant.sets[answer.setIndex] : null;
    if (!set) continue;

    add(skills, set.skills);
    add(tools, set.tools);
    add(skills, answer?.skills ?? []);
    add(tools, answer?.tools ?? []);
  }

  return { skills, tools };
}

/**
 * Every grant whose choice is still unanswered or illegal.
 *
 * Grants are read in order and each one sees what the earlier ones took, which
 * is what makes "already doubled" mean anything.
 */
export function unansweredExpertise(
  entries: ExpertiseEntry[],
  context: { proficientSkills: string[]; proficientTools?: string[] },
): { grant: ExpertiseGrantLike; problems: ExpertiseProblem[] }[] {
  const out: { grant: ExpertiseGrantLike; problems: ExpertiseProblem[] }[] = [];
  const alreadyExpert: { skills: string[]; tools: string[] } = { skills: [], tools: [] };

  for (const entry of entries) {
    const problems = expertiseProblems({
      grant: entry.grant,
      answer: entry.answer ?? null,
      proficientSkills: context.proficientSkills,
      proficientTools: context.proficientTools ?? [],
      alreadyExpert,
    });
    if (problems.length) out.push({ grant: entry.grant, problems });

    const taken = expertiseFrom([entry]);
    for (const id of taken.skills) if (!alreadyExpert.skills.includes(id)) alreadyExpert.skills.push(id);
    for (const id of taken.tools) if (!alreadyExpert.tools.includes(id)) alreadyExpert.tools.push(id);
  }

  return out;
}
