/**
 * What the index says a class doubles, against what the books say.
 *
 * Expertise is prose in the class text and structured only in 5etools' Foundry
 * companion file, so these check the join actually happened and that the two
 * readings that could silently go wrong did not: a grant read as several
 * grants instead of several alternatives, and an optional feature handed out
 * as if it were a given.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "data");
const read = (name) => JSON.parse(fs.readFileSync(path.join(DATA, `${name}.json`), "utf8"));

const classes = read("class");
const subclasses = read("subclass");
const feats = read("feat");

const findClass = (name, source) => classes.find((row) => row.name === name && row.source === source);
const findSubclass = (short, source) =>
  subclasses.find((row) => row.shortName === short && row.source === source);
const findFeat = (name, source) => feats.find((row) => row.name === name && row.source === source);

const SKILLS = new Set([
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
]);

test("the classes that double a proficiency are the ones that should", () => {
  const granting = classes
    .filter((row) => row.expertise.length)
    .map((row) => `${row.name}|${row.source}`)
    .sort();

  // Named rather than counted: if the join breaks, the count could stay right
  // while the rows moved. Expert Sidekick is Tasha's sidekick "class", which
  // is a class in this data and does grant expertise.
  assert.deepEqual(granting, [
    "Bard|PHB",
    "Bard|XPHB",
    "Expert Sidekick|TCE",
    "Ranger|PHB",
    "Ranger|XPHB",
    "Rogue|PHB",
    "Rogue|XPHB",
    "Wizard|XPHB",
  ]);
});

test("the rogue's is two alternatives, not two grants", () => {
  // The failure this guards is arithmetic: read as two grants, the 2014 rogue
  // doubles three proficiencies at level 1 instead of two.
  const grant = findClass("Rogue", "PHB").expertise.find((entry) => entry.level === 1);

  assert.equal(grant.sets.length, 2);
  assert.deepEqual(grant.sets[0], { anySkill: 2, anyTool: 0, skills: [], tools: [] });
  assert.deepEqual(grant.sets[1], {
    anySkill: 1,
    anyTool: 0,
    skills: [],
    tools: ["Thieves' Tools"],
  });

  assert.deepEqual(
    findClass("Rogue", "PHB").expertise.map((entry) => entry.level),
    [1, 6],
  );
});

test("2024 dropped the thieves' tools alternative", () => {
  // Not a data glitch to be smoothed over: the 2024 rogue's Expertise is two
  // skill proficiencies with no tool option. Editions differ, and the index
  // is the place that difference survives.
  const grant = findClass("Rogue", "XPHB").expertise.find((entry) => entry.level === 1);

  assert.equal(grant.sets.length, 1);
  assert.deepEqual(grant.sets[0], { anySkill: 2, anyTool: 0, skills: [], tools: [] });
});

test("the bard doubles at different levels in each edition", () => {
  assert.deepEqual(
    findClass("Bard", "PHB").expertise.map((entry) => entry.level),
    [3, 10],
  );
  assert.deepEqual(
    findClass("Bard", "XPHB").expertise.map((entry) => entry.level),
    [2, 9],
  );
});

test("the 2014 ranger's expertise is marked optional, the 2024 one is not", () => {
  // Deft Explorer is Tasha's *replacement* for Natural Explorer. Applied
  // unconditionally it hands every 2014 ranger a doubled skill it never chose.
  const [deftExplorer] = findClass("Ranger", "PHB").expertise;

  assert.equal(deftExplorer.name, "Deft Explorer");
  assert.equal(deftExplorer.source, "TCE");
  assert.equal(deftExplorer.isVariant, true);

  // In 2024 Deft Explorer is simply the class feature, at a different level.
  const twentyFour = findClass("Ranger", "XPHB").expertise;
  assert.deepEqual(
    twentyFour.map((entry) => [entry.name, entry.level, entry.isVariant]),
    [
      ["Deft Explorer", 2, false],
      ["Expertise", 9, false],
    ],
  );
});

test("a list of fixed one-skill sets is a choice between them", () => {
  // The 2024 wizard's Scholar doubles one of six named skills. Six sets of one
  // fixed skill is how the data says "pick one", and reading it as six grants
  // would double all six.
  const [scholar] = findClass("Wizard", "XPHB").expertise;

  assert.equal(scholar.name, "Scholar");
  assert.equal(scholar.sets.length, 6);
  assert.deepEqual(
    scholar.sets.flatMap((set) => set.skills),
    ["Arcana", "History", "Investigation", "Medicine", "Nature", "Religion"],
  );
  for (const set of scholar.sets) {
    assert.equal(set.anySkill, 0, "Scholar names its skills; nothing is free to choose");
  }
});

test("a subclass can grant expertise, and two do", () => {
  const scout = findSubclass("Scout", "XGE");
  const banneret = findSubclass("Purple Dragon Knight (Banneret)", "SCAG");

  // One set, nothing to choose: the scout simply has both.
  assert.deepEqual(scout.expertise, [
    {
      name: "Survivalist",
      source: "XGE",
      level: 3,
      isVariant: false,
      sets: [{ anySkill: 0, anyTool: 0, skills: ["Nature", "Survival"], tools: [] }],
    },
  ]);

  assert.deepEqual(banneret.expertise[0].sets, [
    { anySkill: 0, anyTool: 0, skills: ["Persuasion"], tools: [] },
  ]);

  const granting = subclasses.filter((row) => row.expertise.length).length;
  assert.equal(granting, 2, "a subclass started or stopped granting expertise");
});

test("the feats that double a proficiency carry it", () => {
  const granting = feats
    .filter((row) => row.expertise.length)
    .map((row) => `${row.name}|${row.source}`)
    .sort();

  assert.deepEqual(granting, [
    "Aberrant Anatomy|RHW",
    "Boon of Skill|XPHB",
    "Boon of Terror|FRHoF",
    "Echoing Soul|RHW",
    "Prodigy|XGE",
    "Skill Expert|TCE",
    "Skill Expert|XPHB",
  ]);

  // Skill Expert grants a skill proficiency *and* expertise in a skill you are
  // proficient in — which can be the one it just granted. The two halves are
  // separate fields for that reason.
  assert.deepEqual(findFeat("Skill Expert", "XPHB").expertise, [
    { anySkill: 1, anyTool: 0, skills: [], tools: [] },
  ]);
});

test("every set is a shape the rules can be applied to", () => {
  const sets = [
    ...classes.flatMap((row) => row.expertise.flatMap((entry) => entry.sets)),
    ...subclasses.flatMap((row) => row.expertise.flatMap((entry) => entry.sets)),
    ...feats.flatMap((row) => row.expertise),
  ];

  assert.ok(sets.length >= 20, `only ${sets.length} expertise sets in the whole index`);

  for (const set of sets) {
    const where = JSON.stringify(set);

    assert.ok(Number.isInteger(set.anySkill) && set.anySkill >= 0, where);
    assert.ok(Number.isInteger(set.anyTool) && set.anyTool >= 0, where);

    for (const skill of set.skills) {
      assert.ok(SKILLS.has(skill), `${where}: "${skill}" is not one of the eighteen skills`);
    }
    // A tool is anything that is not a skill, which is the only reading the
    // data supports. Asserting the negative keeps a misclassified skill from
    // silently becoming a tool nobody has.
    for (const tool of set.tools) {
      assert.ok(!SKILLS.has(tool), `${where}: "${tool}" is a skill filed as a tool`);
    }

    const total = set.anySkill + set.anyTool + set.skills.length + set.tools.length;
    assert.ok(total > 0, `${where}: a set that doubles nothing`);
  }
});
