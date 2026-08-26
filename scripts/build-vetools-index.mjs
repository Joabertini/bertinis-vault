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
  return value.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
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

/** Mastery properties, 2024's weapon system. Stored as bare names. */
function masteryOf(item) {
  if (!item.mastery?.length) return null;
  return item.mastery.map((entry) => String(entry).split("|")[0]);
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
      mastery: masteryOf(i),
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

  race: (entities) =>
    entities.map((r) => ({
      name: r.name,
      source: sourceOf(r),
      size: r.size?.[0] ?? null,
      ability: abilityOf(r),
      speed: typeof r.speed === "number" ? r.speed : r.speed?.walk ?? null,
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
      };
    }),

  subclass: (entities, context) =>
    entities.map((c) => ({
      name: c.name,
      source: sourceOf(c),
      shortName: c.shortName ?? null,
      className: c.className ?? null,
      classSource: c.classSource ?? null,
      // A subclass grants its own choices on top of the class's: the battle
      // master's maneuvers, the arcane archer's shots, the rune knight's runes.
      optionalFeatureProgression: optionalFeatureProgressionOf(c),
      expertise:
        context.expertise.forSubclass.get(
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

  const context = { spellClasses: readSpellClasses(dataDir), expertise: readExpertise(dataDir) };

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
