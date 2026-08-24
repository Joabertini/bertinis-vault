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

  feat: (entities) => entities.map((f) => ({ name: f.name, source: sourceOf(f) })),

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

  class: (entities) =>
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
      };
    }),

  subclass: (entities) =>
    entities.map((c) => ({
      name: c.name,
      source: sourceOf(c),
      shortName: c.shortName ?? null,
      className: c.className ?? null,
      classSource: c.classSource ?? null,
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
  };

  const context = { spellClasses: readSpellClasses(dataDir) };

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
