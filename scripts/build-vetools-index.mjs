/**
 * Build the browsing index the web builder ships with.
 *
 * The index carries only what a picker needs to list, search, sort and filter:
 * enough to render a row and build a Plutonium reference, and nothing else.
 * Full entity text stays out — it is an order of magnitude larger and is only
 * needed once the player opens a single entity.
 *
 * Usage:
 *   node scripts/build-vetools-index.mjs <path-to-5etools-data-dir>
 *
 * The data directory is the one shipped inside Plutonium (`data/`), or any
 * 5etools data checkout with the same layout.
 */

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const OUT_DIR = path.join(process.cwd(), "packages", "vetools-index", "src", "data");

/** Companion files that repeat entities already present in the source files. */
const SKIP_FILES = new Set(["foundry.json", "roll20.json", "index.json", "sources.json", "fluff-index.json"]);

function readCollection(dataDir, subdir, prop) {
  const dir = path.join(dataDir, subdir);
  const out = [];
  for (const file of fs.readdirSync(dir)) {
    if (SKIP_FILES.has(file) || file.includes("fluff") || !file.endsWith(".json")) continue;
    const parsed = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    out.push(...(parsed[prop] ?? []));
  }
  return out;
}

function readFileCollection(dataDir, file, prop) {
  const parsed = JSON.parse(fs.readFileSync(path.join(dataDir, file), "utf8"));
  return parsed[prop] ?? [];
}

/** A source is required to build a reference; magic variants inherit theirs. */
function sourceOf(entity) {
  return entity.source ?? entity.inherits?.source ?? null;
}

/** Spell components come as an object of flags; flatten to "vsm". */
function componentsOf(spell) {
  const c = spell.components ?? {};
  return ["v", "s", "m"].filter((k) => c[k]).join("");
}

/**
 * Which classes can cast a spell, and under which edition's class list.
 *
 * 5etools keeps this in a reverse index rather than on the spell, because a
 * spell is on a class list by the class's say-so, not its own. The entry names
 * the class's source too, so the 2014 and 2024 lists stay apart: Fire Bolt is
 * a Wizard spell under both PHB and XPHB, and those are different documents.
 */
function readSpellClasses(dataDir) {
  const file = path.join(dataDir, "spells", "sources.json");
  if (!fs.existsSync(file)) return new Map();

  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  const bySpell = new Map();

  for (const [source, spells] of Object.entries(parsed)) {
    if (source.startsWith("_")) continue;

    for (const [name, entry] of Object.entries(spells)) {
      const classes = [
        ...(entry.class ?? []),
        ...(entry.classVariant ?? []),
      ].map((row) => `${row.name}|${row.source}`);

      if (classes.length) bySpell.set(`${name}|${source}`, [...new Set(classes)]);
    }
  }

  return bySpell;
}

/** Subclasses live on the class page, one file per class. */
function readSubclasses(dataDir) {
  const dir = path.join(dataDir, "class");
  const out = [];

  for (const file of fs.readdirSync(dir)) {
    if (SKIP_FILES.has(file) || file.includes("fluff") || !file.endsWith(".json")) continue;
    const parsed = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    out.push(...(parsed.subclass ?? []));
  }

  // A subclass appears once per edition of its class: School of Abjuration is
  // attached to both the 2014 and the 2024 Wizard, under the same source. Two
  // rows with the same name and source are indistinguishable to the resolver,
  // which would report every subclass as ambiguous. Keep the original.
  const byKey = new Map();
  for (const entry of out) {
    const key = `${entry.name}|${sourceOf(entry)}`;
    const existing = byKey.get(key);
    if (!existing || (existing._copy && !entry._copy)) byKey.set(key, entry);
  }

  return [...byKey.values()];
}

/**
 * The level a class's features are earned at, from its feature list.
 *
 * A class feature is referenced as `"Name|Class|Source|Level"`, and a feature
 * that unlocks the subclass is wrapped in an object with `gainSubclassFeature`.
 * Reading both out of the data is the only way to get these right per edition:
 * the fighter and the rogue take extra ability score improvements, the 2024
 * classes all choose a subclass at 3 where the 2014 ones range from 1 to 3,
 * and 2024 replaced the level 19 improvement with an epic boon.
 */
function levelsOf(entity) {
  const improvements = [];
  let subclassLevel = null;

  for (const feature of entity.classFeatures ?? []) {
    const reference = typeof feature === "string" ? feature : feature.classFeature;
    if (typeof reference !== "string") continue;

    const [name, , , levelText] = reference.split("|");
    const level = Number.parseInt(levelText ?? "", 10);
    if (!Number.isInteger(level)) continue;

    if (name?.startsWith("Ability Score Improvement")) improvements.push(level);
    if (typeof feature !== "string" && feature.gainSubclassFeature && subclassLevel === null) {
      subclassLevel = level;
    }
  }

  return { improvements: [...new Set(improvements)].sort((a, b) => a - b), subclassLevel };
}

/**
 * The feats a background grants, as one choice.
 *
 * 5etools records these as an array under `feats`, and every background in the
 * data that lists more than one entry reads as an *alternative* rather than a
 * second grant: Ruined is "the Alert, Skilled, or Tough feat (your choice)",
 * Haunted One is "Survivor or a Dark Gift feat of your choice". So the whole
 * array flattens into one list of options — reading it as several grants would
 * hand Ruined all three feats.
 *
 * Four backgrounds carry more than one entry and all four are worded "or",
 * which is the whole evidence for that reading. A background that genuinely
 * grants two feats would be misread, and none exists in this data.
 *
 * A key is `"<name>|<source>"`, and the name can carry a qualifier after a
 * semicolon: `"magic initiate; cleric|xphb"` is Magic Initiate with its spell
 * list already chosen. The qualifier is kept for the label and dropped from
 * the name, which is what a reference resolves on.
 *
 * `anyFromCategory` names a kind of feat rather than a feat. It has no list to
 * enumerate, so the choice is marked open and the builder offers the whole
 * feat picker.
 */
function featChoiceOf(background) {
  const options = [];
  let isOpen = false;

  for (const grant of background.feats ?? []) {
    if (!grant || typeof grant !== "object") continue;

    for (const [key, value] of Object.entries(grant)) {
      if (value === false) continue;
      if (key === "any" || key === "anyFromCategory") {
        isOpen = true;
        continue;
      }

      const [nameWithQualifier, source] = key.split("|");
      const [name, qualifier] = (nameWithQualifier ?? "").split(";").map((part) => part.trim());
      if (!name || !source) continue;

      options.push({
        name: titleCase(name),
        source: source.toUpperCase(),
        ...(qualifier ? { qualifier: titleCase(qualifier) } : {}),
      });
    }
  }

  if (options.length === 0 && !isOpen) return null;

  return { options, ...(isOpen ? { isOpen } : {}) };
}

/**
 * Restore a name the data lowercased for its key.
 *
 * The resolver matches names case-insensitively, so this is for the label the
 * player reads rather than for lookup.
 */
function titleCase(value) {
  // A word boundary is the wrong rule here: an apostrophe is one, so
  // `\b[a-z]` turns "tinker's tools" into "Tinker'S Tools". Only a space or
  // an opening bracket starts a word worth capitalising.
  return value.replace(/(^|[\s(])([a-z])/g, (_, before, letter) => before + letter.toUpperCase());
}

/**
 * Every skill 5e has, in the casing the sheet and this generator both use.
 *
 * Duplicated from `packages/domain/src/proficiencies.ts` rather than
 * imported: that package resolves a *typed* label back to a `dnd5e` skill id,
 * this script only ever needs the eighteen canonical names, and importing a
 * built package into a plain data-generation script would tie regeneration to
 * a build order it does not otherwise need. Eighteen skills have not changed
 * since 2014 and are not expected to.
 */
const SKILL_NAMES = {
  acrobatics: "Acrobatics",
  "animal handling": "Animal Handling",
  arcana: "Arcana",
  athletics: "Athletics",
  deception: "Deception",
  history: "History",
  insight: "Insight",
  intimidation: "Intimidation",
  investigation: "Investigation",
  medicine: "Medicine",
  nature: "Nature",
  perception: "Perception",
  performance: "Performance",
  persuasion: "Persuasion",
  religion: "Religion",
  "sleight of hand": "Sleight of Hand",
  stealth: "Stealth",
  survival: "Survival",
};

const ALL_SKILL_NAMES = Object.values(SKILL_NAMES);

function skillNameOf(key) {
  return SKILL_NAMES[key.toLowerCase()] ?? titleCase(key);
}

/**
 * A class's skill choice, read from `startingProficiencies.skills`.
 *
 * 5etools writes this as `{choose: {from, count}}` when the class names a
 * shortlist, or `{any: N}` when it does not (the bard and, in the 2024 rules,
 * nobody else). `any` resolves to every skill rather than an empty list with
 * a flag: "choose 3 of these 18" and "choose 3, no shortlist" are the same
 * instruction, and a picker should not have to special-case the second one.
 */
function skillChoiceOf(entity) {
  const entry = entity.startingProficiencies?.skills?.[0];
  if (!entry) return null;

  if (entry.choose) {
    const options = entry.choose.from.map(skillNameOf);
    return { options, count: entry.choose.count ?? options.length };
  }
  if (typeof entry.any === "number") {
    return { options: ALL_SKILL_NAMES, count: entry.any, isOpen: true };
  }

  return null;
}

/**
 * The skills and tools a background grants outright, plus any bounded skill
 * choice stacked on top (a handful of Sword Coast Adventurer's Guide
 * backgrounds grant one fixed skill and a choice of a second).
 *
 * Tool grants that are themselves category-scoped ("any gaming set", "any
 * musical instrument") are left out of `toolsGranted`: they are already a
 * choice with no single name to pre-fill, and the free-text proficiency field
 * a player types into already accepts whatever name they choose.
 *
 * A background whose grant is an array of more than one element is not a
 * second grant added to the first — the one background this happens to
 * (House Agent, ERLW) is worded as several alternative *pairs* to choose one
 * of, a shape this does not attempt to model. Skipped rather than merged into
 * a single fixed list, which would hand the player tools they do not
 * actually get.
 */
function proficiencyGrantOf(background) {
  const skillEntries = background.skillProficiencies ?? [];
  const toolEntries = background.toolProficiencies ?? [];

  const skillsGranted = [];
  let skillChoice = null;
  if (skillEntries.length === 1) {
    for (const [key, value] of Object.entries(skillEntries[0])) {
      if (value === true) skillsGranted.push(skillNameOf(key));
    }
    if (skillEntries[0].choose) {
      const options = skillEntries[0].choose.from.map(skillNameOf);
      skillChoice = { options, count: skillEntries[0].choose.count ?? 1 };
    } else if (typeof skillEntries[0].any === "number") {
      skillChoice = { options: ALL_SKILL_NAMES, count: skillEntries[0].any, isOpen: true };
    }
  }

  const toolsGranted = [];
  if (toolEntries.length === 1) {
    for (const [key, value] of Object.entries(toolEntries[0])) {
      if (value === true) toolsGranted.push(titleCase(key));
    }
  }

  return { skillsGranted, skillChoice, toolsGranted };
}

/** A distance the picker can print, e.g. "120 feet", "Self", "Touch". */
function rangeOf(spell) {
  const range = spell.range;
  if (!range) return null;

  const distance = range.distance;
  if (!distance) return range.type ?? null;
  if (distance.type === "self") return "self";
  if (distance.type === "touch") return "touch";
  if (distance.amount == null) return distance.type;

  return `${distance.amount} ${distance.type}`;
}

/** The species ability bonus, flattened. Null when the player chooses it. */
function abilityOf(entity) {
  const ability = entity.ability?.[0];
  if (!ability) return null;

  const fixed = {};
  for (const [key, amount] of Object.entries(ability)) {
    if (typeof amount === "number") fixed[key] = amount;
  }

  // `choose` means the bonus is floating, which most species reprinted in
  // Monsters of the Multiverse are. Recording the fixed part as empty is the
  // honest answer: the builder has to ask.
  return Object.keys(fixed).length ? fixed : null;
}

/**
 * The ability increase a background grants, which is a 2024 rule.
 *
 * 2014 put the increase on the species: a mountain dwarf was +2 Strength and
 * +2 Constitution whoever they were. 2024 moved it to the background, so a
 * 2024 species grants none at all — every one of the ten carries no ability
 * field, and a builder that only reads the species leaves a 2024 character
 * three points short with nothing saying so.
 *
 * The shape is uniform across all sixty backgrounds that have one: two
 * alternatives over the same three abilities, +2 and +1 to two of them, or +1
 * to each of the three. Which abilities is the player's answer; how much is
 * not.
 */
function abilityChoiceOf(entity) {
  const alternatives = entity.ability;
  if (!alternatives?.length) return null;

  return alternatives.map((alternative) => {
    const weighted = alternative.choose?.weighted;
    if (!weighted?.from || !weighted.weights) {
      throw new Error(`unmodelled background ability: ${JSON.stringify(alternative)}`);
    }
    return { options: weighted.from, amounts: weighted.weights };
  });
}

/**
 * Mastery properties, 2024's weapon system. Stored as bare names.
 *
 * Nearly every entry is the string "Topple|XPHB". One is not: the Psychic
 * Blade carries an object with a note saying its Vex does not count against
 * the number of properties a character may use. `String(entry)` turned that
 * one into the literal text "[object Object]", which shipped in the index —
 * a name no weapon has, on the only weapon whose rule differs.
 *
 * The note is a rule rather than prose, so it is kept as one: a property that
 * costs no slot is listed separately instead of being described.
 */
function masteryOf(item) {
  if (!item.mastery?.length) return null;

  const names = [];
  const free = [];

  for (const entry of item.mastery) {
    if (typeof entry === "string") {
      names.push(entry.split("|")[0]);
      continue;
    }
    if (!entry.uid) throw new Error(`unmodelled mastery entry: ${JSON.stringify(entry)}`);

    const name = String(entry.uid).split("|")[0];
    names.push(name);
    if (/does\s*n[o']?t count against/i.test(entry.note ?? "")) free.push(name);
  }

  return { names, free };
}

/**
 * How many mastery properties a class lets a character use, by level.
 *
 * Five 2024 classes grant the feature and they state the number two different
 * ways. The fighter and the barbarian put it in a column of their own level
 * table, because it grows; the paladin, the ranger and the rogue say "two
 * kinds" in the feature text and never change it. Reading only the table would
 * lose three classes, and reading only the prose would freeze the fighter at
 * three when the rules take them to six.
 *
 * The barbarian's is also narrower — Simple or Martial *Melee* — which is in
 * the filter tag rather than in a field.
 */
const NUMBER_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };

function weaponMasteryOf(entity, features) {
  const feature = features.find(
    (row) =>
      row.name === "Weapon Mastery" &&
      row.className === entity.name &&
      row.classSource === sourceOf(entity),
  );
  if (!feature) return null;

  const text = JSON.stringify(feature.entries ?? []);
  const countByLevel = masteryCountsFromTable(entity);

  if (!countByLevel) {
    const match = /of\s+(one|two|three|four|five|six)\s+kinds/i.exec(stripTags(text));
    if (!match) throw new Error(`no mastery count for ${entity.name}`);
    const flat = NUMBER_WORDS[match[1].toLowerCase()];
    return { countByLevel: Array(MAX_LEVEL).fill(flat), meleeOnly: /melee weapon/i.test(text) };
  }

  return { countByLevel, meleeOnly: /melee weapon/i.test(text) };
}

/** The Weapon Mastery column of a class's own level table, if it has one. */
function masteryCountsFromTable(entity) {
  for (const group of entity.classTableGroups ?? []) {
    const column = (group.colLabels ?? []).findIndex((label) => /weapon mastery/i.test(label));
    if (column < 0) continue;
    return (group.rows ?? []).map((row) => Number(row[column]));
  }
  return null;
}

/** A character never exceeds this, and every progression is stated to it. */
const MAX_LEVEL = 20;

/**
 * The ability increase a feat carries, if any.
 *
 * 160 of the 276 feats raise something, and the raise is half of why they are
 * worth taking: on an odd score a half-feat buys its effect *and* the modifier
 * point a plain improvement would have bought, which no flat improvement can
 * match in the same slot. Losing it silently — which is what happened until
 * now, because nothing recorded that a feat raised anything — makes the sheet
 * quietly wrong rather than visibly incomplete.
 *
 * Two forms. A fixed key names the ability outright (`{"con": 1}`). A `choose`
 * offers a list: `count` different abilities from `from`, each by `amount`,
 * both defaulting to one.
 *
 * `hidden` entries are dropped, and every one of them belongs to the same
 * entity: the 2024 rules model the plain ability score improvement *as a feat*
 * called "Ability Score Improvement", so its `ability` is the improvement
 * itself rather than a half-feat's bonus. Presenting it as one would ask the
 * player the same question twice.
 */
function featAbilityOf(feat) {
  const grants = [];

  for (const entry of feat.ability ?? []) {
    if (entry.hidden) continue;

    if (entry.choose) {
      grants.push({
        kind: "choice",
        from: entry.choose.from ?? [],
        amount: entry.choose.amount ?? 1,
        count: entry.choose.count ?? 1,
      });
      continue;
    }

    const bonuses = {};
    for (const [key, value] of Object.entries(entry)) {
      if (key === "max" || key === "hidden") continue;
      if (typeof value === "number") bonuses[key] = value;
    }
    if (Object.keys(bonuses).length) grants.push({ kind: "fixed", bonuses });
  }

  return grants;
}

/**
 * Whether this feat *is* the ability score improvement.
 *
 * 2024 folded the improvement into the feat list, so "take an improvement" and
 * "take a feat" stopped being alternatives. A builder that offers both as a
 * choice needs to know which feat is the one that means the former.
 */
function isAbilityScoreImprovementFeat(feat) {
  return (feat.ability ?? []).some((entry) => entry.hidden === true);
}

/**
 * How many options a class knows at each level, from level 1 to 20.
 *
 * 5etools states this two ways and both are cumulative totals rather than
 * per-level gains. An array is indexed by level minus one — the warlock's
 * invocations. An object is sparse and keyed by the level a new total takes
 * effect, holding until the next key — the battle master's maneuvers,
 * `{"3": 3, "7": 5, ...}`. Both become the same 20-long array here, so that
 * nothing downstream has to know which shape a given class used.
 */
function progressionToLevels(progression) {
  const levels = new Array(MAX_LEVEL).fill(0);

  if (Array.isArray(progression)) {
    for (let i = 0; i < MAX_LEVEL; i += 1) levels[i] = progression[i] ?? 0;
    return levels;
  }

  let running = 0;
  for (let level = 1; level <= MAX_LEVEL; level += 1) {
    const at = progression[String(level)];
    if (at != null) running = at;
    levels[level - 1] = running;
  }

  return levels;
}

/**
 * The optional-feature choices an entity grants, if any.
 *
 * This is what makes the level-up choices data rather than a table: which
 * choice a class offers, from which pool, and how many by level, all stated by
 * the class itself. It is also how the editions stay apart without a rule —
 * the 2024 sorcerer's metamagic progression differs from the 2014 one, and the
 * 2024 paladin has no fighting style at all because fighting styles became
 * feats, which shows up here as the entry simply not existing.
 */
function optionalFeatureProgressionOf(entity) {
  return (entity.optionalfeatureProgression ?? []).map((entry) => ({
    name: entry.name,
    featureType: entry.featureType ?? [],
    countByLevel: progressionToLevels(entry.progression ?? {}),
  }));
}

/**
 * The expertise a feature grants, as the alternative sets it offers.
 *
 * A grant is a list of *alternatives*, not a list of grants. The 2014 rogue's
 * `[{anyProficientSkill: 2}, {anyProficientSkill: 1, "thieves' tools": true}]`
 * is "two skills, or one skill and thieves' tools"; reading it as two grants
 * would hand out three expertises. The wizard's Scholar is six sets of one
 * fixed skill each, which is the same shape saying "pick one of six". A single
 * set with nothing to choose — the scout's `{nature, survival}` — is not a
 * question at all, and the builder should apply it rather than ask.
 *
 * A key whose value is not `true` is a shape this does not model, and the
 * build stops rather than dropping it. `choose` is the one 5etools has a slot
 * for and does not currently use anywhere in expertise; if it appears, the
 * expertise would silently go missing, which is the failure this project keeps
 * finding and the reason for the throw.
 */
function expertiseSetOf(raw, where) {
  const set = { anySkill: 0, anyTool: 0, skills: [], tools: [] };

  for (const [key, value] of Object.entries(raw)) {
    if (key === "anyProficientSkill") {
      set.anySkill += Number(value) || 1;
      continue;
    }
    if (key === "anyProficientTool") {
      set.anyTool += Number(value) || 1;
      continue;
    }
    if (value !== true) {
      throw new Error(
        `${where}: expertise names "${key}" as ${JSON.stringify(value)}, a shape this does not model`,
      );
    }

    // Anything that is not one of the eighteen skills is a tool. That is the
    // same reading Plutonium's own picker makes, and the data gives no other
    // marker to go by.
    if (SKILL_NAMES[key.toLowerCase()]) set.skills.push(skillNameOf(key));
    else set.tools.push(titleCase(key));
  }

  return set;
}

function expertiseSetsOf(sets, where) {
  return sets.map((raw) => expertiseSetOf(raw, where));
}

const classFeatureKey = (f) => [f.name, f.source, f.className, f.classSource, f.level].join("|");

const subclassFeatureKey = (f) =>
  [f.name, f.source, f.className, f.classSource, f.subclassShortName, f.subclassSource, f.level].join("|");

/**
 * Which features grant expertise, read out of `class/foundry.json`.
 *
 * Expertise is not structured anywhere in the class text — the rogue's is two
 * sentences of prose. It is structured in the companion file 5etools maintains
 * for the Foundry integration, which is otherwise skipped here because it
 * repeats entities. The alternative would be a hand-written table of who
 * doubles what and when, which is the thing this index exists to avoid.
 *
 * The join runs through the real feature rather than straight off the
 * companion file, because only the real feature says whether it is a variant.
 * Deft Explorer is a Tasha's *replacement* for Natural Explorer: attaching its
 * expertise unconditionally would hand every 2014 ranger a doubled skill it
 * never took.
 */
function readExpertise(dataDir) {
  const companion = path.join(dataDir, "class", "foundry.json");
  const parsed = fs.existsSync(companion) ? JSON.parse(fs.readFileSync(companion, "utf8")) : {};

  const byClassFeature = new Map((parsed.classFeature ?? []).map((r) => [classFeatureKey(r), r]));
  const bySubclassFeature = new Map(
    (parsed.subclassFeature ?? []).map((r) => [subclassFeatureKey(r), r]),
  );

  const collect = (features, companionByKey, keyOf, groupOf) => {
    const grouped = new Map();
    const seen = new Set();

    for (const feature of features) {
      const key = keyOf(feature);
      if (seen.has(key)) continue;

      const sets = companionByKey.get(key)?.entryData?.expertise;
      if (!sets?.length) continue;
      seen.add(key);

      const where = `${feature.className} ${feature.name} (${feature.source}) level ${feature.level}`;
      const entry = {
        name: feature.name,
        source: feature.source,
        level: feature.level,
        isVariant: feature.isClassFeatureVariant === true || feature.isSubclassFeatureVariant === true,
        sets: expertiseSetsOf(sets, where),
      };

      const group = groupOf(feature);
      if (!grouped.has(group)) grouped.set(group, []);
      grouped.get(group).push(entry);
    }

    for (const entries of grouped.values()) entries.sort((a, b) => a.level - b.level);
    return grouped;
  };

  return {
    forClass: collect(
      readCollection(dataDir, "class", "classFeature"),
      byClassFeature,
      classFeatureKey,
      (f) => `${f.className}|${f.classSource}`,
    ),
    forSubclass: collect(
      readCollection(dataDir, "class", "subclassFeature"),
      bySubclassFeature,
      subclassFeatureKey,
      (f) => `${f.className}|${f.classSource}|${f.subclassShortName}|${f.subclassSource}`,
    ),
  };
}

const ABILITY_IDS = ["str", "dex", "con", "int", "wis", "cha"];

/** The score 5e has asked for since 2014, and still asks for. */
const MULTICLASS_MINIMUM = 13;

/**
 * What a character must have to take a level in this class.
 *
 * The outer list is alternatives and the inner object is requirements, so
 * `[{str: 13}, {dex: 13}]` is "Strength or Dexterity" and `[{dex: 13, wis: 13}]`
 * is "Dexterity and Wisdom". Every requirement in the game fits that shape,
 * and both editions reach it from different fields:
 *
 *   2014 states it per class under `multiclassing.requirements`. Top-level
 *   keys are all required — the monk needs both. The fighter is the only class
 *   in the entire dataset with an `or`, and inside that `or` the keys are
 *   alternatives rather than requirements, which is the opposite of the
 *   top-level reading. One sample is thin evidence for a rule; it is also all
 *   there is, so anything that does not fit stops the build rather than being
 *   guessed at.
 *
 *   2024 dropped the per-class block because the rule became uniform: 13 in
 *   the primary ability of the class. `primaryAbility` is already a list of
 *   alternatives of objects of requirements, which is the same shape one layer
 *   up, so it needs no interpretation at all.
 */
function multiclassRequirementsOf(entity) {
  const where = `${entity.name} (${sourceOf(entity)})`;
  const raw = entity.multiclassing?.requirements;

  if (raw) {
    const { or, ...rest } = raw;

    const fixed = abilityMinimumsOf(rest, where);
    if (!or) return fixed.length ? [fixed[0]] : [];

    if (!Array.isArray(or) || or.length !== 1) {
      throw new Error(`${where}: an "or" requirement with ${or?.length} branches, which this does not model`);
    }

    // Inside the `or`, each key is a way of meeting the requirement.
    const alternatives = abilityMinimumsOf(or[0], where)[0] ?? {};
    const options = Object.entries(alternatives).map(([ability, score]) => ({ [ability]: score }));

    // A class with both — a fixed part and a choice — would need every option
    // to carry the fixed part too. None exists; failing beats guessing.
    if (fixed.length) {
      throw new Error(`${where}: mixes a fixed requirement with an "or", which this does not model`);
    }
    return options;
  }

  return (entity.primaryAbility ?? []).map((option) => {
    const out = {};
    for (const [ability, value] of Object.entries(option)) {
      if (value !== true) {
        throw new Error(`${where}: primary ability "${ability}" is ${JSON.stringify(value)}`);
      }
      if (!ABILITY_IDS.includes(ability)) {
        throw new Error(`${where}: primary ability "${ability}" is not an ability`);
      }
      out[ability] = MULTICLASS_MINIMUM;
    }
    return out;
  });
}

/** `{str: 13, cha: 13}` as one requirement object, or nothing. */
function abilityMinimumsOf(raw, where) {
  const out = {};
  for (const [ability, score] of Object.entries(raw ?? {})) {
    if (!ABILITY_IDS.includes(ability)) {
      throw new Error(`${where}: requires "${ability}", which is not an ability`);
    }
    if (!Number.isInteger(score)) {
      throw new Error(`${where}: requires ${JSON.stringify(score)} in ${ability}`);
    }
    out[ability] = score;
  }
  return Object.keys(out).length ? [out] : [];
}

/**
 * What taking a level in this class grants a character who already has one.
 *
 * A second class does not hand over its starting proficiencies. It hands over
 * a shorter list the books print separately: a rogue's first level gives four
 * skills and thieves' tools, and a rogue level taken second gives one skill
 * and thieves' tools. Reading the starting list for both would give a dipping
 * character three skills they never chose.
 *
 * Four shapes come out of `proficienciesGained`, and the messy halves are the
 * tools and the weapons: both are written as 5etools item tags, and one of the
 * tool entries is a sentence rather than a name ("one musical instrument of
 * your choice"). A sentence is a choice, and the thing being chosen from is
 * the tool category the tag names — which the tool table already resolves.
 */
function multiclassGrantsOf(entity) {
  const gained = entity.multiclassing?.proficienciesGained;
  if (!gained) return null;

  const skills = gained.skills?.[0]?.choose;
  const tools = [];
  let toolChoice = null;

  for (const raw of gained.tools ?? []) {
    const name = stripTags(String(raw)).trim();
    // "one musical instrument of your choice" and "Choose one Musical
    // Instrument" are the same instruction in two editions' phrasing. What is
    // left after the instruction is the category to choose from.
    if (/choose|of your choice/i.test(name)) {
      toolChoice = name
        .replace(/^choose\s+(one|a|an)\s+/i, "")
        .replace(/^(one|a|an)\s+/i, "")
        .replace(/\s+of your choice$/i, "")
        .trim();
      continue;
    }
    tools.push(titleCase(name));
  }

  return {
    // "light", "medium", "shield". The object form carries a caveat in prose —
    // the druid's refusal of metal — which is a table's business, not a
    // number's, so only the proficiency itself is kept.
    armor: (gained.armor ?? []).map((entry) =>
      typeof entry === "string" ? entry : (entry.proficiency ?? ""),
    ).filter(Boolean),
    // "simple", "martial", or a named weapon: the 2014 monk's second level
    // grants simple weapons and shortswords specifically.
    weapons: (gained.weapons ?? []).map((entry) => stripTags(String(entry))),
    skillChoice: skills
      ? { options: (skills.from ?? []).map(skillNameOf), count: skills.count ?? 1 }
      : null,
    tools,
    toolChoice,
  };
}

/**
 * What a class or a background hands a character at level one.
 *
 * The prose form is a sentence — "(a) a rapier or (b) a shortsword" — and it is
 * the only form the builder used, which is why equipment was a fixed list: a
 * sentence cannot be offered as a choice. 5etools carries the same list a
 * second time in structured form, and that is what is read here.
 *
 * A row is an object whose keys are the alternatives. `_` means the row is
 * granted outright; anything else is a letter, lower case in 2014 and upper
 * case in 2024, and the character takes exactly one. The two editions divide
 * the list differently — 2014 asks four small questions and 2024 asks one big
 * one — but the shape is the same, so both are read the same way.
 *
 * Five kinds of thing appear inside an alternative, and all five matter:
 *
 * - an item, sometimes more than one of it (two daggers)
 * - a category to choose from, e.g. "any simple weapon"
 * - coins, in copper, which is how 2024 states the "or take the money" option
 * - a special: something with no item entry, like the wizard's spellbook
 * - a pouch that contains coins, which is both an item and money
 */
function startingEquipmentEntry(raw) {
  // The index ships to the browser, and equipment is the largest thing in it.
  // A quantity of one and an absent display name are the overwhelming majority,
  // so they are left out rather than written as `1` and `null` a thousand times.
  const item = (ref, quantity, displayName) => {
    const [name, source = null] = String(ref).split("|");
    return {
      kind: "item",
      name,
      source,
      ...(quantity && quantity !== 1 ? { quantity } : {}),
      ...(displayName ? { displayName } : {}),
    };
  };

  if (typeof raw === "string") return [item(raw)];

  if (raw.equipmentType || raw.equipmentTypes) {
    return [
      {
        kind: "category",
        categories: raw.equipmentTypes ?? [raw.equipmentType],
        ...(raw.quantity && raw.quantity !== 1 ? { quantity: raw.quantity } : {}),
      },
    ];
  }

  if (raw.special) {
    return [
      {
        kind: "special",
        label: raw.special,
        ...(raw.quantity && raw.quantity !== 1 ? { quantity: raw.quantity } : {}),
      },
    ];
  }

  if (raw.item) {
    const entries = [item(raw.item, raw.quantity, raw.displayName)];
    // "A pouch containing 15 gp" is an item and money in one entry. The pouch
    // is worth having and so is what is in it.
    if (raw.containsValue) entries.push({ kind: "coins", copper: raw.containsValue });
    return entries;
  }

  if (typeof raw.value === "number") return [{ kind: "coins", copper: raw.value }];

  throw new Error(`unmodelled starting equipment entry: ${JSON.stringify(raw)}`);
}

function startingEquipmentRows(rows) {
  return (rows ?? []).map((row) => {
    const keys = Object.keys(row);
    const fixed = keys.length === 1 && keys[0] === "_";
    return {
      fixed,
      options: keys.map((key) => ({
        key,
        entries: (row[key] ?? []).flatMap(startingEquipmentEntry),
      })),
    };
  });
}

function startingEquipmentOf(entity) {
  // A background states its list directly; a class wraps it in an object that
  // also carries the gold alternative and the prose.
  const block = entity.startingEquipment;
  if (!block) return null;
  const rows = Array.isArray(block) ? block : block.defaultData;
  if (!rows) return null;

  return {
    rows: startingEquipmentRows(rows),
    // "or 4d4 × 10 gp". A 2014 rule only: 2024 folded the money into the
    // options themselves, which is why it reads as a plain B alternative there.
    goldAlternative: Array.isArray(block) ? null : (stripTags(block.goldAlternative ?? "") || null),
    additionalFromBackground: Array.isArray(block) ? false : Boolean(block.additionalFromBackground),
  };
}

/** The features that replace armour class, by the name they all share. */
const RE_UNARMORED_DEFENSE = /^unarmored defen[sc]e/i;

const ABILITY_BY_WORD = {
  strength: "str",
  dexterity: "dex",
  constitution: "con",
  intelligence: "int",
  wisdom: "wis",
  charisma: "cha",
};

/** 5etools markup reduced to the words a reader sees. */
function stripTags(value) {
  return value.replace(/\{@\w+ ([^}|]+)(?:\|[^}]*)?\}/g, "$1");
}

/** Every string in a feature's entries, nesting included, as one blob. */
function proseOf(entries) {
  const out = [];
  const walk = (node) => {
    if (typeof node === "string") out.push(stripTags(node));
    else if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === "object") {
      if (node.name) out.push(node.name);
      walk(node.entries ?? node.items ?? []);
    }
  };
  walk(entries);
  return out.join(" ");
}

/**
 * An alternative way of computing armour class, read out of the feature text.
 *
 * This one is parsed from prose rather than taken from structured data,
 * because there is no structured data for it: 5etools' Foundry companion file
 * records an `ac.calc` override for the sorcerer and six species, and nothing
 * at all for the barbarian, the monk and the 2024 bard, which rely on the game
 * system's own SRD class items. Plutonium reads the prose for the same reason,
 * and this reads it the same two ways it does:
 *
 *   2014: "10 + your Dexterity modifier + your Constitution modifier"
 *   2024: "10 plus your Dexterity and Constitution modifiers"
 *
 * The base is parsed rather than assumed to be 10, which is the one place this
 * differs from Plutonium: the 2014 draconic sorcerer's is 13, and Plutonium
 * gets away with hardcoding 10 only because that feature also carries a named
 * `ac.calc` for it to fall back on.
 *
 * The shield clause is parsed too. A barbarian "can use a shield and still
 * gain this benefit"; a monk's applies only "while you are wearing no armor
 * and not wielding a shield". Neither Plutonium nor the game system models
 * that difference — both add the shield to the monk's total anyway.
 */
function armorClassOf(entity) {
  const text = proseOf(entity.entries ?? []);
  const isNamedUnarmored = RE_UNARMORED_DEFENSE.test(entity.name ?? "");

  const sentence = text
    .split(/(?<=[.!?])\s+/)
    .find((part) => /armor class|\bAC\b/i.test(part) && /modifiers?\b/i.test(part));
  if (!sentence) return null;

  const classic = sentence.match(/(\d+)\s*\+\s*your\s+([a-z]+)\s+modifier/i);
  const modern = sentence.match(/(\d+)\s+plus\s+your\s+([a-z]+(?:\s+and\s+[a-z]+)*)\s+modifiers?/i);

  let base = null;
  const abilities = [];

  if (classic) {
    base = Number(classic[1]);
    for (const [, word] of sentence.matchAll(/your\s+([a-z]+)\s+modifier/gi)) {
      const id = ABILITY_BY_WORD[word.toLowerCase()];
      if (id && !abilities.includes(id)) abilities.push(id);
    }
  } else if (modern) {
    base = Number(modern[1]);
    for (const word of modern[2].split(/\s+and\s+/)) {
      const id = ABILITY_BY_WORD[word.trim().toLowerCase()];
      if (id && !abilities.includes(id)) abilities.push(id);
    }
  }

  if (base === null) return null;

  return {
    base,
    abilities,
    allowsShield: !/wielding[^.]{0,40}shield/i.test(text),
    // The 2024 bard's College of Dance states the formula and no condition:
    // "Your base Armor Class equals 10 plus your Dexterity and Charisma
    // modifiers." The condition is in the feature's name, which is data too,
    // and a bard who got this in plate would be shown an armour class it does
    // not have. Read from the prose where the prose says it, and from the name
    // where it does not.
    requiresNoArmor:
      isNamedUnarmored ||
      /(not wearing|aren't wearing|wearing no|isn't wearing|no armor)/i.test(text),
  };
}

/** The Foundry formula a species' natural armour is recorded as. */
function armorClassFromFormula(formula) {
  const match = /^(\d+)((?:\s*\+\s*@abilities\.\w+\.mod)*)$/.exec(formula.trim());
  if (!match) return null;

  const abilities = [...match[2].matchAll(/@abilities\.(\w+)\.mod/g)].map((entry) => entry[1]);

  return {
    base: Number(match[1]),
    abilities,
    // Natural armour never excludes a shield: the tortle's shell and the
    // lizardfolk's scales both say a shield applies as normal.
    allowsShield: true,
    requiresNoArmor: true,
  };
}

function isArmorClassFeature(feature, companion) {
  if (JSON.stringify(companion ?? {}).includes("attributes.ac.calc")) return true;
  if (RE_UNARMORED_DEFENSE.test(feature.name ?? "")) return true;
  return (feature.entries ?? []).some(
    (entry) => entry?.name && RE_UNARMORED_DEFENSE.test(entry.name),
  );
}

/** What `dnd5e` calls this calculation, when the companion file names it. */
function calcOf(companion) {
  const change = (companion?.effects ?? [])
    .flatMap((effect) => effect.changes ?? [])
    .find((entry) => entry.key === "system.attributes.ac.calc");
  return change?.value ?? null;
}

function customFormulaOf(companion) {
  const change = (companion?.effects ?? [])
    .flatMap((effect) => effect.changes ?? [])
    .find((entry) => entry.key === "system.attributes.ac.formula");
  return change?.value ?? null;
}

/**
 * Every alternative armour class a class, subclass or species offers.
 *
 * Grouped the same way expertise is, and for the same reason: the level and
 * the variant flag come from the real feature, not the companion file.
 */
function readArmorClasses(dataDir) {
  const companion = fs.existsSync(path.join(dataDir, "class", "foundry.json"))
    ? JSON.parse(fs.readFileSync(path.join(dataDir, "class", "foundry.json"), "utf8"))
    : {};

  const byClassFeature = new Map((companion.classFeature ?? []).map((r) => [classFeatureKey(r), r]));
  const bySubclassFeature = new Map(
    (companion.subclassFeature ?? []).map((r) => [subclassFeatureKey(r), r]),
  );

  const collect = (features, companionByKey, keyOf, groupOf) => {
    const grouped = new Map();
    const seen = new Set();

    for (const feature of features) {
      const key = keyOf(feature);
      if (seen.has(key)) continue;

      const row = companionByKey.get(key);
      if (!isArmorClassFeature(feature, row)) continue;

      const formula = armorClassOf(feature);
      if (!formula) continue;
      seen.add(key);

      const group = groupOf(feature);
      if (!grouped.has(group)) grouped.set(group, []);
      grouped.get(group).push({
        name: feature.name,
        source: feature.source,
        level: feature.level,
        isVariant:
          feature.isClassFeatureVariant === true || feature.isSubclassFeatureVariant === true,
        calc: calcOf(row),
        ...formula,
      });
    }

    for (const entries of grouped.values()) entries.sort((a, b) => a.level - b.level);
    return grouped;
  };

  // A species' natural armour is recorded as a Foundry formula rather than
  // left in prose, so it is read from the formula: it is the same fact stated
  // exactly, and parsing English when a machine-readable form exists would be
  // choosing the worse source.
  const forRace = new Map();
  const racesFile = path.join(dataDir, "foundry-races.json");
  if (fs.existsSync(racesFile)) {
    const parsed = JSON.parse(fs.readFileSync(racesFile, "utf8"));
    for (const feature of parsed.raceFeature ?? []) {
      const custom = customFormulaOf(feature);
      if (!custom) continue;

      const formula = armorClassFromFormula(custom);
      if (!formula) continue;

      const group = `${feature.raceName}|${feature.raceSource}`;
      if (!forRace.has(group)) forRace.set(group, []);
      forRace.get(group).push({
        name: feature.name,
        source: feature.source,
        level: 1,
        isVariant: false,
        calc: calcOf(feature),
        ...formula,
      });
    }
  }

  return {
    forClass: collect(
      readCollection(dataDir, "class", "classFeature"),
      byClassFeature,
      classFeatureKey,
      (f) => `${f.className}|${f.classSource}`,
    ),
    forSubclass: collect(
      readCollection(dataDir, "class", "subclassFeature"),
      bySubclassFeature,
      subclassFeatureKey,
      (f) => `${f.className}|${f.classSource}|${f.subclassShortName}|${f.subclassSource}`,
    ),
    forRace,
  };
}

/**
 * An optional feature's prerequisites, split by whether they can be checked.
 *
 * Four of the six kinds 5etools uses are machine-checkable and are kept as
 * data: a class level, a pact boon, a spell already known, another optional
 * feature already taken. The other two — `item` and `otherSummary` — are
 * prose written for a person ("A suit of armor (requires attunement)",
 * "Dragonmarked House Renown 25+"), and pretending to check them would mean
 * guessing. They travel as text for the player to judge.
 */
function prerequisitesOf(entity) {
  const checkable = [];
  const text = [];

  for (const entry of entity.prerequisite ?? []) {
    if (entry.level != null) {
      const level = typeof entry.level === "number" ? entry.level : entry.level.level;
      checkable.push({
        kind: "level",
        level,
        className: entry.level?.class?.name ?? null,
        classSource: entry.level?.class?.source ?? null,
      });
    }

    if (entry.pact) checkable.push({ kind: "pact", pact: entry.pact });

    for (const spell of entry.spell ?? []) checkable.push({ kind: "spell", spell });

    for (const uid of entry.optionalfeature ?? []) {
      const [name, source = null] = String(uid).split("|");
      checkable.push({ kind: "optionalfeature", name, source });
    }

    for (const item of entry.item ?? []) text.push(item);
    if (entry.otherSummary) text.push(entry.otherSummary.entrySummary ?? entry.otherSummary.entry);
  }

  return { prerequisites: checkable, prerequisiteText: text };
}

const BUILDERS = {
  spell: (entities, context) =>
    entities.map((s) => ({
      name: s.name,
      source: sourceOf(s),
      level: s.level,
      school: s.school,
      time: s.time?.[0]?.unit ?? null,
      range: rangeOf(s),
      components: componentsOf(s),
      concentration: s.duration?.[0]?.concentration ? 1 : 0,
      ritual: s.meta?.ritual ? 1 : 0,
      classes: context.spellClasses.get(`${s.name}|${sourceOf(s)}`) ?? [],
    })),

  item: (entities) =>
    entities.map((i) => ({
      name: i.name,
      source: sourceOf(i),
      type: i.type ?? null,
      rarity: i.rarity ?? null,
      weight: i.weight ?? null,
      value: i.value ?? null,
      attunement: i.reqAttune ? 1 : 0,
      // Enough to show a weapon and to compute an armour class without
      // reaching back into a hand-written catalog.
      damage: i.dmg1 ?? null,
      damageType: i.dmgType ?? null,
      versatileDamage: i.dmg2 ?? null,
      properties: (i.property ?? []).map((entry) => String(entry).split("|")[0]),
      mastery: masteryOf(i)?.names ?? null,
      // The one property that costs no slot. Only the Psychic Blade has one,
      // and it is a rule rather than a footnote.
      masteryFree: masteryOf(i)?.free.length ? masteryOf(i).free : null,
      ac: i.ac ?? null,
      strength: i.strength ?? null,
      stealthDisadvantage: i.stealth ? 1 : 0,
    })),

  feat: (entities) =>
    entities.map((f) => ({
      name: f.name,
      source: sourceOf(f),
      ability: featAbilityOf(f),
      // Seven feats double a proficiency. Skill Expert is the one that makes
      // the shape matter: it grants a skill *and* expertise in a skill you are
      // proficient in, which can be the one it just granted.
      expertise: expertiseSetsOf(f.expertise ?? [], `${f.name} (${sourceOf(f)})`),
      isAbilityScoreImprovement: isAbilityScoreImprovementFeat(f) ? 1 : 0,
    })),

  race: (entities, context) =>
    entities.map((r) => ({
      name: r.name,
      source: sourceOf(r),
      size: r.size?.[0] ?? null,
      ability: abilityOf(r),
      speed: typeof r.speed === "number" ? r.speed : r.speed?.walk ?? null,
      // Natural armour: the tortle's shell, the lizardfolk's scales. Six
      // species have it and it beats leather for most of them.
      armorClass: context.armorClasses.forRace.get(`${r.name}|${sourceOf(r)}`) ?? [],
    })),

  subrace: (entities) =>
    entities.map((r) => ({
      // A subrace's own name is the variant, e.g. "Hill"; the pair is what a
      // player recognises.
      name: r.name ? `${r.raceName} (${r.name})` : r.raceName,
      source: sourceOf(r),
      raceName: r.raceName,
      raceSource: r.raceSource,
      ability: abilityOf(r),
    })),

  background: (entities) =>
    entities.map((b) => {
      const grant = proficiencyGrantOf(b);
      return {
        name: b.name,
        source: sourceOf(b),
        featChoice: featChoiceOf(b),
        skillsGranted: grant.skillsGranted,
        skillChoice: grant.skillChoice,
        toolsGranted: grant.toolsGranted,
        startingEquipment: startingEquipmentOf(b),
        // 2024 moved the ability increase off the species and onto the
        // background. Null for every 2014 background, which grants none.
        abilityChoice: abilityChoiceOf(b),
      };
    }),

  class: (entities, context) =>
    entities.map((c) => {
      const levels = levelsOf(c);
      return {
        name: c.name,
        source: sourceOf(c),
        hitDie: c.hd?.faces ?? null,
        savingThrows: c.proficiency ?? [],
        spellcastingAbility: c.spellcastingAbility ?? null,
        casterProgression: c.casterProgression ?? null,
        preparedSpells: c.preparedSpells ?? null,
        improvementLevels: levels.improvements,
        subclassLevel: levels.subclassLevel,
        skillChoice: skillChoiceOf(c),
        optionalFeatureProgression: optionalFeatureProgressionOf(c),
        expertise: context.expertise.forClass.get(`${c.name}|${sourceOf(c)}`) ?? [],
        armorClass: context.armorClasses.forClass.get(`${c.name}|${sourceOf(c)}`) ?? [],
        // What a character needs before they may take a level in this class.
        // Empty for the handful of classes that state none.
        multiclassRequirements: multiclassRequirementsOf(c),
        // What a second class grants, which is not what a first one does.
        multiclassGrants: multiclassGrantsOf(c),
        // The A-or-B list, structured. The prose form says the same thing and
        // cannot be offered as a choice.
        startingEquipment: startingEquipmentOf(c),
        // 2024's weapon mastery. Null for every 2014 class, and for the 2024
        // classes that never learn it.
        weaponMastery: weaponMasteryOf(c, context.classFeatures),
      };
    }),

  subclass: (entities, context) =>
    entities.map((c) => ({
      name: c.name,
      source: sourceOf(c),
      shortName: c.shortName ?? null,
      className: c.className ?? null,
      classSource: c.classSource ?? null,
      // A third-caster is a subclass, not a class: the eldritch knight and the
      // arcane trickster are the only two, and their progression is the
      // subclass's to state. Without this a fighter 12 / wizard 1 reads as one
      // caster level instead of five.
      casterProgression: c.casterProgression ?? null,
      spellcastingAbility: c.spellcastingAbility ?? null,
      // A subclass grants its own choices on top of the class's: the battle
      // master's maneuvers, the arcane archer's shots, the rune knight's runes.
      optionalFeatureProgression: optionalFeatureProgressionOf(c),
      expertise:
        context.expertise.forSubclass.get(
          `${c.className}|${c.classSource}|${c.shortName}|${sourceOf(c)}`,
        ) ?? [],
      armorClass:
        context.armorClasses.forSubclass.get(
          `${c.className}|${c.classSource}|${c.shortName}|${sourceOf(c)}`,
        ) ?? [],
    })),

  optionalfeature: (entities) =>
    entities.map((f) => ({
      name: f.name,
      source: sourceOf(f),
      // Which choice this answers. "EI" is an eldritch invocation, "MM"
      // metamagic, "FS:F" a fighter's fighting style; a class's progression
      // names the same codes, and that pairing is the whole mechanism.
      featureType: f.featureType ?? [],
      ...prerequisitesOf(f),
    })),
};

function main() {
  const dataDir = process.argv[2];
  if (!dataDir) {
    console.error("Usage: node scripts/build-vetools-index.mjs <path-to-5etools-data-dir>");
    process.exit(1);
  }
  if (!fs.existsSync(dataDir)) {
    console.error(`No such data directory: ${dataDir}`);
    process.exit(1);
  }

  const collections = {
    spell: readCollection(dataDir, "spells", "spell"),
    item: [
      ...readFileCollection(dataDir, "items.json", "item"),
      ...readFileCollection(dataDir, "items-base.json", "baseitem"),
    ],
    feat: readFileCollection(dataDir, "feats.json", "feat"),
    race: readFileCollection(dataDir, "races.json", "race"),
    background: readFileCollection(dataDir, "backgrounds.json", "background"),
    class: readCollection(dataDir, "class", "class"),
    subclass: readSubclasses(dataDir),
    subrace: readFileCollection(dataDir, "races.json", "subrace"),
    optionalfeature: readFileCollection(dataDir, "optionalfeatures.json", "optionalfeature"),
  };

  const context = {
    // The Weapon Mastery feature lives in the feature list, not on the class,
    // and three of the five classes state their count only in its text.
    classFeatures: readCollection(dataDir, "class", "classFeature"),
    spellClasses: readSpellClasses(dataDir),
    expertise: readExpertise(dataDir),
    armorClasses: readArmorClasses(dataDir),
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });

  let totalGzip = 0;
  const manifest = {};

  for (const [prop, entities] of Object.entries(collections)) {
    const rows = BUILDERS[prop](entities, context);

    const missing = rows.filter((row) => !row.source);
    if (missing.length) {
      // A row without a source cannot be turned into a reference, so it would
      // be unpickable. Fail rather than shipping an index with dead entries.
      console.error(`${prop}: ${missing.length} entities have no source, e.g. ${missing[0].name}`);
      process.exit(1);
    }

    const json = JSON.stringify(rows);
    const gzip = zlib.gzipSync(Buffer.from(json), { level: 9 }).length;
    totalGzip += gzip;

    fs.writeFileSync(path.join(OUT_DIR, `${prop}.json`), json);
    manifest[prop] = { count: rows.length, bytes: json.length, gzip };

    console.log(
      `${prop.padEnd(11)} ${String(rows.length).padStart(5)} entries  ` +
        `${(json.length / 1024).toFixed(0).padStart(4)}KB raw  ${(gzip / 1024).toFixed(0).padStart(3)}KB gzip`,
    );
  }

  fs.writeFileSync(path.join(OUT_DIR, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`${"".padEnd(11)} ${"".padStart(5)}          total ${(totalGzip / 1024).toFixed(0)}KB gzip`);
}

main();
