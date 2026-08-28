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
/**
 * How far a species moves, in every way it moves.
 *
 * 5etools writes one number when walking is all there is, and an object when
 * there is more. Inside that object `true` is not a boolean: it means "the
 * same as your walking speed", which is how the Dhampir's climb and the
 * Aarakocra's fly are printed. Kept as numbers here so nothing downstream has
 * to know that.
 *
 * The walk speed is returned separately because it is the one every character
 * has and the one the sheet shows first.
 */
function speedsOf(entity) {
  const raw = entity.speed;
  if (raw === undefined || raw === null) return null;
  if (typeof raw === "number") return { walk: raw };

  const walk = typeof raw.walk === "number" ? raw.walk : null;
  const speeds = {};
  if (walk !== null) speeds.walk = walk;

  for (const mode of ["burrow", "climb", "fly", "swim"]) {
    const value = raw[mode];
    if (value === undefined || value === null || value === false) continue;
    // `true` is "as fast as you walk". With no walk speed to match it there is
    // no number to write, and a guess would be a speed nobody printed.
    const resolved = value === true ? walk : typeof value === "number" ? value : null;
    if (resolved !== null) speeds[mode] = resolved;
  }

  return Object.keys(speeds).length ? speeds : null;
}

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
 * How many cantrips and spells a class has at each of its levels.
 *
 * Every casting class prints this in its own level table, in both editions,
 * and nothing read it: the builder carried a hand-written switch covering
 * eight classes with the 2014 numbers, used for both editions.

 * The editions disagree about more than the numbers. 2014 has "Spells Known"
 * for the classes that learn a fixed list and a formula — level plus the
 * casting modifier — for the ones that prepare. 2024 replaced both with a
 * "Prepared Spells" column for every caster, which is why the 2024 rows carry
 * no formula at all: the table *is* the rule now.
 *
 * A cantrip column is a cantrip column in both, under two names.
 */
function spellTableOf(entity) {
  const columns = { cantrips: null, known: null, prepared: null };

  for (const group of entity.classTableGroups ?? []) {
    (group.colLabels ?? []).forEach((label, index) => {
      const text = stripTags(String(label));
      const key = /cantrip/i.test(text)
        ? "cantrips"
        : /prepared/i.test(text)
          ? "prepared"
          : /spells known/i.test(text)
            ? "known"
            : null;
      if (!key || columns[key]) return;

      columns[key] = (group.rows ?? []).map((row) => {
        const value = Number(row[index]);
        if (!Number.isFinite(value)) {
          throw new Error(`unreadable ${key} count for ${entity.name}: ${JSON.stringify(row[index])}`);
        }
        return value;
      });
    });
  }

  if (!columns.cantrips && !columns.known && !columns.prepared) return null;
  return columns;
}

/**
 * The level a class starts casting at, read from its own feature list.
 *
 * Not a constant: 2024 moved the paladin's and the ranger's Spellcasting from
 * level 2 to level 1, so a hardcoded "half casters start at 2" is wrong for
 * exactly the two classes it was written for.
 */
function spellcastingLevelOf(entity, features) {
  const feature = features.find(
    (row) =>
      // The warlock's is called Pact Magic. Matching only "Spellcasting"
      // leaves the one class whose magic works differently with no answer.
      (row.name === "Spellcasting" || row.name === "Pact Magic") &&
      row.className === entity.name &&
      row.classSource === sourceOf(entity),
  );
  return feature?.level ?? null;
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

/**
 * What a character must already have before a feat is legal.
 *
 * 205 of the 276 feats state one and nothing read any of them, so the builder
 * offered Heavily Armored to a wizard and Elemental Adept to a barbarian.
 *
 * The array is a list of *alternatives*: satisfying any one entry is enough,
 * and every field inside one entry must hold. That is the same shape the
 * multiclass requirements use, and it is read the same way.
 *
 * Half of what appears here can be checked against a build and half cannot.
 * A Ravenloft campaign, a dragonmark category, "no other dragonmark" — those
 * are a table's business, and pretending to check them would be worse than
 * saying plainly that they are not checked. They are kept as text so the
 * interface can show them beside the ones that are.
 */
function featPrerequisitesOf(entity) {
  const alternatives = entity.prerequisite;
  if (!alternatives?.length) return [];

  return alternatives.map((raw) => {
    const other = [];

    // Anything with no mechanical form. `otherSummary` is the short version of
    // `other`, and the short version is the one worth showing.
    if (raw.otherSummary?.entry) other.push(stripTags(raw.otherSummary.entry));
    else if (raw.other) other.push(stripTags(String(raw.other)));
    for (const campaign of raw.campaign ?? []) other.push(`Campaign: ${campaign}`);
    for (const category of raw.featCategory ?? []) other.push(`Feat category: ${category}`);
    for (const category of raw.exclusiveFeatCategory ?? []) {
      other.push(`No other feat of category ${category}`);
    }

    // A level is either a plain number or a level in a named class. The second
    // is not the character's level, and treating it as one would let a level 3
    // wizard take a feat that wants a level 3 fighter.
    const level = typeof raw.level === "number" ? raw.level : null;
    const classLevel =
      raw.level && typeof raw.level === "object"
        ? { className: raw.level.class?.name ?? "", level: raw.level.level ?? 1 }
        : null;

    const races = (raw.race ?? []).map((entry) => ({
      name: entry.name,
      ...(entry.subrace ? { subrace: entry.subrace } : {}),
    }));
    const proficiencies = (raw.proficiency ?? []).flatMap((entry) =>
      Object.entries(entry).map(([kind, value]) => ({
        // `weaponGroup` and `weapon` mean the same thing here and only the
        // spelling differs, so they are not two kinds.
        kind: kind === "weaponGroup" ? "weapon" : kind,
        value: String(value),
      })),
    );

    // Most alternatives state one thing. Writing the other nine fields as
    // empty arrays doubles the size of the feat index for no information.
    return {
      // A list of alternatives in its own right: [{int:13},{wis:13}] is
      // "Intelligence or Wisdom", the same shape the multiclass rule uses.
      ...(raw.ability?.length ? { abilities: raw.ability } : {}),
      ...(level === null ? {} : { level }),
      ...(classLevel ? { classLevel } : {}),
      ...(races.length ? { races } : {}),
      ...(raw.background?.length
        ? { backgrounds: raw.background.map((entry) => entry.name) }
        : {}),
      ...(raw.feat?.length
        ? { feats: raw.feat.map((entry) => String(entry).split("|")[0]) }
        : {}),
      // "Fighting Style", or "Spellcasting or Pact Magic" — a feature by name.
      ...(raw.feature?.length ? { features: raw.feature } : {}),
      ...(proficiencies.length ? { proficiencies } : {}),
      // Three spellings of the same requirement: the character must cast.
      ...(raw.spellcasting || raw.spellcasting2020 || raw.spellcastingFeature
        ? { spellcasting: true }
        : {}),
      ...(other.length ? { other } : {}),
    };
  });
}

/**
 * The spells a subclass adds, which for two subclasses are the only ones.
 *
 * A class's spell list comes off the spell rows themselves, and the fighter and
 * the rogue have none — so an Eldritch Knight and an Arcane Trickster were
 * offered *no spells at all*, in a builder that let you pick the subclass.
 * Their list is the wizard's, and the subclass is the only place that says so.
 *
 * The same field carries the domain, circle and oath spells that every prepare
 * caster gets on top of their own list, which is why 147 subclasses have one.
 *
 * Four kinds appear, and they are different rules rather than different
 * spellings. `prepared` and `expanded` join the list the character prepares
 * from; `known` is always known without costing a slot on the sheet; `innate`
 * is cast without preparing it at all, usually once a day.
 *
 * A spell is either named outright or described by a filter — "every wizard
 * cantrip". The filter is kept as a filter rather than expanded here: the
 * expansion needs the spell list, which lives in another collection, and
 * baking 300 names into a subclass row would be both large and stale.
 */
const SPELL_LIST_KINDS = ["expanded", "known", "prepared", "innate"];

function subclassSpellsOf(entity) {
  const blocks = entity.additionalSpells;
  if (!blocks?.length) return [];

  const out = [];

  for (const block of blocks) {
    for (const kind of SPELL_LIST_KINDS) {
      for (const [levelKey, raw] of Object.entries(block[kind] ?? {})) {
        // An innate block nests one more level deep, under how the spell is
        // regained: "daily", "rest", "resource", "ritual", or "_" for plain.
        const groups = Array.isArray(raw) ? { _: raw } : raw;
        const names = [];
        const filters = [];
        const choices = [];

        for (const group of Object.values(groups)) {
          // "daily" nests again, keyed by uses per day. Anything below is a
          // list of spells however deep it sits.
          const lists = Array.isArray(group) ? [group] : Object.values(group ?? {});

          for (const list of lists) {
            for (const entry of Array.isArray(list) ? list : [list]) {
              if (typeof entry === "string") {
                names.push(stripTags(entry).split("|")[0]);
                continue;
              }
              if (entry?.all) {
                filters.push({ filter: entry.all, count: null });
              } else if (typeof entry?.choose === "string") {
                filters.push({ filter: entry.choose, count: entry.count ?? 1 });
              } else if (entry?.choose?.from) {
                // A choice from a named shortlist rather than from a filter.
                // One subclass states it this way, and it is a different rule:
                // there is no filter to evaluate, only a list to pick from.
                choices.push({
                  from: entry.choose.from.map((name) => stripTags(String(name)).split("|")[0]),
                  count: entry.choose.count ?? entry.count ?? 1,
                });
              } else {
                throw new Error(`unmodelled subclass spell: ${JSON.stringify(entry)}`);
              }
            }
          }
        }

        // The warlock patrons key their expanded list by *spell* level —
        // "s1" through "s5" — because a warlock gains those spells when their
        // pact slots reach that level, not at a fixed class level. Reading an
        // "s3" as class level 3 would hand a level 3 warlock third-level
        // spells five levels early.
        const spellLevelKey = /^s(\d+)$/.exec(levelKey);
        // "_" means the spell arrives with the subclass itself and is gated by
        // nothing further. Both null is that: no class level, no spell level.
        const gated = levelKey !== "_";
        const level = spellLevelKey || !gated ? null : Number(levelKey);
        const spellLevel = spellLevelKey ? Number(spellLevelKey[1]) : null;

        if (level !== null && !Number.isFinite(level)) {
          throw new Error(`unreadable spell level: ${levelKey}`);
        }
        if (names.length || filters.length || choices.length) {
          out.push({ kind, level, spellLevel, names, filters, choices });
        }
      }
    }
  }

  return out.sort(
    (a, b) =>
      (a.level ?? 0) - (b.level ?? 0) ||
      (a.spellLevel ?? 0) - (b.spellLevel ?? 0) ||
      a.kind.localeCompare(b.kind),
  );
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
/**
 * What a class hands a character who takes it *first*.
 *
 * Three different things share one list in 5etools, and telling them apart is
 * the whole job: "simple" is a category, "{@item rapier|phb|rapiers}" is one
 * named weapon, and "Martial weapons that have the Light property" is a rule
 * the 2024 books print in place of a list. A category can be a checkbox on a
 * sheet, a named weapon can be one too, and a rule can only be a sentence.
 *
 * The armour half is the same shape as the multiclass block: a string, or an
 * object carrying prose the table does not need — the druid's refusal of metal
 * is a caveat, not a proficiency.
 */
function startingProficienciesOf(entity) {
  const starting = entity.startingProficiencies;
  if (!starting) return null;

  const weapons = [];
  const weaponItems = [];
  const weaponClauses = [];

  for (const raw of starting.weapons ?? []) {
    if (raw && typeof raw === "object") {
      // The artificer's firearms are an optional rule the DM turns on, not a
      // proficiency the class grants. Reading it as one would arm every
      // artificer at a table that never allowed guns.
      if (raw.optional) continue;
      if (raw.proficiency) weapons.push(String(raw.proficiency));
      continue;
    }

    const text = stripTags(String(raw)).trim();
    if (text === "simple" || text === "martial") {
      weapons.push(text);
      continue;
    }
    // A sentence about weapons is a rule. A weapon's name never says the word.
    if (/weapon|propert/i.test(text)) {
      weaponClauses.push(text);
      continue;
    }
    weaponItems.push(text);
  }

  return {
    armor: (starting.armor ?? [])
      .map((entry) => (typeof entry === "string" ? entry : (entry.proficiency ?? "")))
      .filter(Boolean),
    weapons,
    weaponItems,
    weaponClauses,
  };
}

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
      // Simple or martial. `type` says melee or ranged and nothing about the
      // category, so without this there is no way to answer "which martial
      // weapons have the Light property" — which is how the 2024 monk's and
      // rogue's proficiencies are printed. Null for everything that is not a
      // weapon, which is most of the table.
      weaponCategory: i.weaponCategory ?? null,
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
      // What a character must already have. 205 of the 276 state something,
      // and nothing read any of it.
      prerequisites: featPrerequisitesOf(f),
    })),

  race: (entities, context) =>
    entities.map((r) => ({
      name: r.name,
      source: sourceOf(r),
      size: r.size?.[0] ?? null,
      ability: abilityOf(r),
      speed: typeof r.speed === "number" ? r.speed : r.speed?.walk ?? null,
      // Flying, swimming, climbing and burrowing, for the species that do.
      // The Aarakocra's 50-foot fly speed is the whole point of playing one.
      speeds: speedsOf(r),
      // How far this species sees in the dark, in feet. Null for the ones that
      // see no better than a human, which is most of them.
      darkvision: r.darkvision ?? null,
      blindsight: r.blindsight ?? null,
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
      // A subrace overrides its race rather than adding to it: the wood elf
      // walks 35 where the elf walks 30, and the drow sees 120 feet where the
      // elf sees 60. Null means "whatever the race said", not "nothing".
      speed: typeof r.speed === "number" ? r.speed : r.speed?.walk ?? null,
      speeds: speedsOf(r),
      darkvision: r.darkvision ?? null,
      blindsight: r.blindsight ?? null,
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
        // The armour and weapons a first class grants. Split three ways
        // because the books write them three ways.
        startingProficiencies: startingProficienciesOf(c),
        // What a second class grants, which is not what a first one does.
        multiclassGrants: multiclassGrantsOf(c),
        // The A-or-B list, structured. The prose form says the same thing and
        // cannot be offered as a choice.
        startingEquipment: startingEquipmentOf(c),
        // 2024's weapon mastery. Null for every 2014 class, and for the 2024
        // classes that never learn it.
        weaponMastery: weaponMasteryOf(c, context.classFeatures),
        // Cantrips and spells per level, off the class's own table. The
        // builder used to carry these as a hand-written switch.
        spellTable: spellTableOf(c),
        // 2024 moved the paladin's and the ranger's spellcasting to level 1,
        // so the level a class starts casting at is data, not a constant.
        spellcastingLevel: spellcastingLevelOf(c, context.classFeatures),
      };
    }),

  subclass: (entities, context) =>
    entities.map((c) => ({
      name: c.name,
      source: sourceOf(c),
      shortName: c.shortName ?? null,
      className: c.className ?? null,
      classSource: c.classSource ?? null,
      // Domain, circle and oath spells — and, for the Eldritch Knight and the
      // Arcane Trickster, the only spell list they have at all.
      spells: subclassSpellsOf(c),
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
