import test from "node:test";
import assert from "node:assert/strict";

import {
  activeExpertiseGrants,
  expertiseFrom,
  expertiseProblems,
  isExpertiseChoice,
  unansweredExpertise,
} from "../dist/index.js";

const set = (over = {}) => ({ anySkill: 0, anyTool: 0, skills: [], tools: [], ...over });

/** The 2014 rogue: two skills, or one skill and thieves' tools. */
const rogue = (level) => ({
  name: "Expertise",
  source: "PHB",
  level,
  isVariant: false,
  sets: [set({ anySkill: 2 }), set({ anySkill: 1, tools: ["Thieves' Tools"] })],
});

/** The scout's Survivalist: both, no question. */
const survivalist = {
  name: "Survivalist",
  source: "XGE",
  level: 3,
  isVariant: false,
  sets: [set({ skills: ["Nature", "Survival"] })],
};

/** Tasha's replacement for the 2014 ranger's Natural Explorer. */
const deftExplorer = {
  name: "Deft Explorer",
  source: "TCE",
  level: 1,
  isVariant: true,
  sets: [set({ anySkill: 1 })],
};

test("a grant with nothing to choose is not a question", () => {
  assert.equal(isExpertiseChoice(survivalist), false);
  assert.equal(isExpertiseChoice(rogue(1)), true);
  assert.equal(isExpertiseChoice(deftExplorer), true);
});

test("a fixed grant is applied without being asked", () => {
  assert.deepEqual(expertiseProblems({ grant: survivalist, answer: null, proficientSkills: [] }), []);
  assert.deepEqual(expertiseFrom([{ grant: survivalist }]), {
    skills: ["Nature", "Survival"],
    tools: [],
  });
});

test("a grant above the character's level has not been earned", () => {
  const grants = [rogue(1), rogue(6)];

  assert.deepEqual(
    activeExpertiseGrants({ grants, level: 5 }).map((g) => g.level),
    [1],
  );
  assert.deepEqual(
    activeExpertiseGrants({ grants, level: 6 }).map((g) => g.level),
    [1, 6],
  );
});

test("an optional feature is not granted unless it was taken", () => {
  // The 2014 ranger who kept Natural Explorer gets no expertise. This is the
  // difference between leaving a question blank and answering it wrong.
  assert.deepEqual(activeExpertiseGrants({ grants: [deftExplorer], level: 5 }), []);

  assert.deepEqual(
    activeExpertiseGrants({
      grants: [deftExplorer],
      level: 5,
      variantsTaken: ["Deft Explorer"],
    }),
    [deftExplorer],
  );
});

test("an unanswered choice is reported rather than dropped", () => {
  assert.deepEqual(expertiseProblems({ grant: rogue(1), answer: null, proficientSkills: ["ste"] }), [
    { kind: "unchosen" },
  ]);
});

test("expertise doubles a proficiency you have", () => {
  // A rogue who never took Arcana cannot double it. Until this existed the
  // pick would have travelled to Foundry and set a skill the sheet shows as
  // untrained to double proficiency.
  const problems = expertiseProblems({
    grant: rogue(1),
    answer: { setIndex: 0, skills: ["ste", "arc"], tools: [] },
    proficientSkills: ["ste", "slt"],
  });

  assert.deepEqual(problems, [{ kind: "not-proficient", of: "skill", id: "arc" }]);
});

test("the two picks are two, not one and not three", () => {
  const under = expertiseProblems({
    grant: rogue(1),
    answer: { setIndex: 0, skills: ["ste"], tools: [] },
    proficientSkills: ["ste", "slt", "prc"],
  });
  assert.deepEqual(under, [{ kind: "unspent", of: "skill", allowed: 2, picked: 1 }]);

  const over = expertiseProblems({
    grant: rogue(1),
    answer: { setIndex: 0, skills: ["ste", "slt", "prc"], tools: [] },
    proficientSkills: ["ste", "slt", "prc"],
  });
  assert.deepEqual(over, [{ kind: "overspent", of: "skill", allowed: 2, picked: 3 }]);
});

test("the second set spends one skill pick, not two", () => {
  // Choosing "one skill and thieves' tools" changes how many skills the same
  // grant offers. A builder that kept asking for two would overspend it.
  const problems = expertiseProblems({
    grant: rogue(1),
    answer: { setIndex: 1, skills: ["ste"], tools: [] },
    proficientSkills: ["ste", "slt"],
  });

  assert.deepEqual(problems, []);
  assert.deepEqual(expertiseFrom([{ grant: rogue(1), answer: { setIndex: 1, skills: ["ste"], tools: [] } }]), {
    skills: ["ste"],
    tools: ["Thieves' Tools"],
  });
});

test("a set the grant does not offer is reported", () => {
  assert.deepEqual(
    expertiseProblems({
      grant: rogue(1),
      answer: { setIndex: 4, skills: [], tools: [] },
      proficientSkills: ["ste"],
    }),
    [{ kind: "no-such-set", index: 4, sets: 2 }],
  );
});

test("a proficiency already doubled cannot be doubled again", () => {
  // The rogue's level 6 picks are two *more* skills. Spending one on Stealth
  // again buys nothing, and nothing on the sheet would say so.
  const problems = expertiseProblems({
    grant: rogue(6),
    answer: { setIndex: 0, skills: ["ste", "prc"], tools: [] },
    proficientSkills: ["ste", "slt", "prc"],
    alreadyExpert: { skills: ["ste", "slt"], tools: [] },
  });

  assert.deepEqual(problems, [{ kind: "duplicate", of: "skill", id: "ste" }]);
});

test("later grants see what the earlier ones took", () => {
  const entries = [
    { grant: rogue(1), answer: { setIndex: 0, skills: ["ste", "slt"], tools: [] } },
    { grant: rogue(6), answer: { setIndex: 0, skills: ["ste", "prc"], tools: [] } },
  ];

  const unanswered = unansweredExpertise(entries, {
    proficientSkills: ["ste", "slt", "prc", "inv"],
  });

  assert.deepEqual(
    unanswered.map((entry) => [entry.grant.level, entry.problems]),
    [[6, [{ kind: "duplicate", of: "skill", id: "ste" }]]],
  );
});

test("what reaches the sheet is every grant's answer, deduplicated", () => {
  const taken = expertiseFrom([
    { grant: rogue(1), answer: { setIndex: 1, skills: ["ste"], tools: [] } },
    { grant: survivalist },
    { grant: rogue(6), answer: { setIndex: 0, skills: ["slt", "prc"], tools: [] } },
  ]);

  assert.deepEqual(taken, {
    skills: ["ste", "Nature", "Survival", "slt", "prc"],
    tools: ["Thieves' Tools"],
  });
});

test("an unanswered choice contributes nothing rather than guessing", () => {
  assert.deepEqual(expertiseFrom([{ grant: rogue(1), answer: null }]), { skills: [], tools: [] });
});
