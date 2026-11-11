/**
 * Build the rules text the builder shows when the player asks what something is.
 *
 * The browsing index (`build-vetools-index.mjs`) carries only what a picker needs to list and
 * filter. This carries the other thing: the full text of an entity, so that choosing "Fireball" or
 * "Incapacitated" can say what it does. It is written as one small file per kind, to be fetched
 * only when a player first looks at something of that kind.
 *
 * Text is kept as 5etools writes it, `{@condition incapacitated}` tags and all, because the tags
 * are what turn a word in a description into a link to its own description.
 *
 * Usage:
 *   node scripts/build-rules-text.mjs <path-to-5etools-data-dir> <out-dir>
 *
 * The data directory is the one shipped inside Plutonium (`data/`).
 */

import fs from "node:fs";
import path from "node:path";

const [dataDir, outDir] = process.argv.slice(2);
if (!dataDir || !outDir) {
  console.error("usage: node build-rules-text.mjs <5etools-data-dir> <out-dir>");
  process.exit(1);
}

const SKIP = (file) => file.includes("fluff") || ["foundry.json", "roll20.json", "index.json", "sources.json"].includes(file) || !file.endsWith(".json");

function readDir(sub, prop) {
  const dir = path.join(dataDir, sub);
  const out = [];
  for (const file of fs.readdirSync(dir)) {
    if (SKIP(file)) continue;
    out.push(...(JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"))[prop] ?? []));
  }
  return out;
}

function readFile(file, prop) {
  const target = path.join(dataDir, file);
  if (!fs.existsSync(target)) return [];
  return JSON.parse(fs.readFileSync(target, "utf8"))[prop] ?? [];
}

/** Keep only the listed keys, dropping what is empty. */
function pick(row, keys) {
  const out = {};
  for (const key of keys) {
    const value = row[key];
    if (value === undefined || value === null) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    out[key] = value;
  }
  return out;
}

const keyOf = (row, ...extra) => [row.name, ...extra, row.source].join("|").toLowerCase();

const lc = (value) => String(value ?? "").toLowerCase();

/**
 * 5etools reprints are written as `_copy`: "Goblin (Eberron) is Goblin (Volo's) with this paragraph
 * replaced". Left alone they have no text of their own, so the entry opened empty. This applies the
 * copy and the entry edits it carries (`_mod.entries`), which is all the books use on prose.
 */
function resolveCopies(rows) {
  const byKey = new Map(rows.map((row) => [`${lc(row.name)}|${lc(row.source)}`, row]));
  const done = new Map();

  const applyOps = (entries, ops) => {
    let out = [...entries];
    for (const op of Array.isArray(ops) ? ops : [ops]) {
      if (!op || typeof op !== "object") continue;
      const items = op.items === undefined ? [] : Array.isArray(op.items) ? op.items : [op.items];
      const indexOf = (target) => out.findIndex((entry) => (typeof entry === "string" ? entry === target : entry?.name === target));
      if (op.mode === "appendArr") out = [...out, ...items];
      else if (op.mode === "prependArr") out = [...items, ...out];
      else if (op.mode === "appendIfNotExistsArr") out = [...out, ...items.filter((item) => !out.some((e) => JSON.stringify(e) === JSON.stringify(item)))];
      else if (op.mode === "replaceArr") {
        const at = typeof op.replace === "string" ? indexOf(op.replace) : (op.replace?.index ?? -1);
        if (at >= 0) out.splice(at, 1, ...items);
        else out = [...out, ...items];
      } else if (op.mode === "insertArr") out.splice(op.index ?? out.length, 0, ...items);
      else if (op.mode === "removeArr") {
        const names = op.names === undefined ? [] : Array.isArray(op.names) ? op.names : [op.names];
        out = out.filter((entry) => !names.includes(typeof entry === "string" ? entry : entry?.name));
      }
    }
    return out;
  };

  const resolve = (row, seen = new Set()) => {
    if (!row._copy) return row;
    const key = `${lc(row.name)}|${lc(row.source)}`;
    if (done.has(key)) return done.get(key);
    if (seen.has(key)) return row;
    seen.add(key);

    const base = byKey.get(`${lc(row._copy.name)}|${lc(row._copy.source)}`);
    if (!base) return row;
    const parent = resolve(base, seen);

    const merged = { ...parent };
    for (const [field, value] of Object.entries(row)) {
      if (field === "_copy" || field === "_mod" || field === "_preserve") continue;
      if (value !== null && value !== undefined) merged[field] = value;
    }
    const mod = row._copy._mod ?? row._mod;
    if (mod?.entries !== undefined && Array.isArray(parent.entries) && row.entries === undefined) {
      merged.entries = applyOps(parent.entries, mod.entries);
    }
    done.set(key, merged);
    return merged;
  };

  return rows.map((row) => resolve(row));
}

/**
 * Subclasses that do not list their features. 5etools keeps the features as separate rows that name
 * their subclass, and a few subclasses (Drakewarden, the Artificer's, the original Barbarian paths)
 * carry no list at all, so they opened as a title and nothing under it.
 */
const subclassFeatureRows = readDir("class", "subclassFeature");
function withSubclassFeatures(rows) {
  return rows.map((row) => {
    if (Array.isArray(row.subclassFeatures) && row.subclassFeatures.length) return row;
    const list = subclassFeatureRows
      .filter((f) => lc(f.className) === lc(row.className) && lc(f.subclassShortName) === lc(row.shortName) && lc(f.subclassSource) === lc(row.source))
      .sort((a, b) => (a.level ?? 0) - (b.level ?? 0))
      .map((f) => [f.name, f.className, f.classSource ?? "", f.subclassShortName, f.subclassSource ?? "", f.level, f.source].join("|"));
    return { ...row, subclassFeatures: list };
  });
}

function collect(rows, keys, extraKey) {
  const out = {};
  for (const row of resolveCopies(rows)) {
    if (!row.name || !row.source) continue;
    out[keyOf(row, ...(extraKey ? extraKey(row) : []))] = pick(row, keys);
  }
  return out;
}

const COMMON = ["name", "source", "page", "entries", "otherSources", "reprintedAs"];

const kinds = {
  spell: collect(
    readDir("spells", "spell"),
    [...COMMON, "level", "school", "time", "range", "components", "duration", "meta", "entriesHigherLevel", "damageInflict", "conditionInflict", "savingThrow", "abilityCheck", "spellAttack"],
  ),

  item: {
    ...collect(
      readFile("items.json", "item"),
      [...COMMON, "type", "rarity", "weight", "value", "dmg1", "dmg2", "dmgType", "property", "range", "ac", "strength", "stealth", "reqAttune", "reqAttuneTags", "bonusWeapon", "bonusAc", "bonusSpellAttack", "bonusSpellSaveDc", "weaponCategory", "mastery", "ammoType", "baseItem", "charges", "recharge", "rechargeAmount", "tier", "curse", "poison", "resist", "scfType", "focus", "containerCapacity", "packContents"],
    ),
    ...collect(
      readFile("items-base.json", "baseitem"),
      [...COMMON, "type", "rarity", "weight", "value", "dmg1", "dmg2", "dmgType", "property", "range", "ac", "strength", "stealth", "weaponCategory", "mastery", "ammoType", "packContents", "containerCapacity"],
    ),
  },

  condition: {
    ...collect(readFile("conditionsdiseases.json", "condition"), COMMON),
    ...collect(readFile("conditionsdiseases.json", "disease"), COMMON),
    ...collect(readFile("conditionsdiseases.json", "status"), COMMON),
  },

  feat: collect(readFile("feats.json", "feat"), [...COMMON, "prerequisite", "ability", "category", "additionalSpells", "skillProficiencies", "toolProficiencies", "languageProficiencies", "resist", "senses"]),

  background: collect(readFile("backgrounds.json", "background"), [...COMMON, "skillProficiencies", "toolProficiencies", "languageProficiencies", "startingEquipment", "feats", "ability", "prerequisite"]),

  race: {
    ...collect(readFile("races.json", "race"), [...COMMON, "size", "speed", "ability", "darkvision", "age", "lineage", "resist", "traitTags", "languageProficiencies", "skillProficiencies", "creatureTypes", "heightAndWeight"]),
    ...collect(readFile("races.json", "subrace"), [...COMMON, "raceName", "raceSource", "size", "speed", "ability", "darkvision", "resist", "languageProficiencies", "skillProficiencies"], (row) => [row.raceName ?? ""]),
  },

  class: collect(readDir("class", "class"), [...COMMON, "hd", "proficiency", "startingProficiencies", "startingEquipment", "multiclassing", "spellcastingAbility", "casterProgression", "subclassTitle", "classFeatures", "primaryAbility"]),

  subclass: collect(withSubclassFeatures(readDir("class", "subclass")), [...COMMON, "className", "classSource", "shortName", "subclassFeatures", "spellcastingAbility", "casterProgression", "additionalSpells"], (row) => [row.className ?? ""]),

  classFeature: collect(readDir("class", "classFeature"), [...COMMON, "className", "classSource", "level"], (row) => [row.className ?? "", row.classSource ?? "", String(row.level ?? "")]),

  subclassFeature: collect(readDir("class", "subclassFeature"), [...COMMON, "className", "classSource", "subclassShortName", "subclassSource", "level"], (row) => [row.className ?? "", row.classSource ?? "", row.subclassShortName ?? "", row.subclassSource ?? "", String(row.level ?? "")]),

  optionalfeature: collect(readFile("optionalfeatures.json", "optionalfeature"), [...COMMON, "featureType", "prerequisite", "consumes"]),

  action: collect(readFile("actions.json", "action"), [...COMMON, "time", "fromVariant"]),

  variantrule: collect(readFile("variantrules.json", "variantrule"), [...COMMON, "ruleType"]),

  skill: collect(readFile("skills.json", "skill"), COMMON),

  sense: collect(readFile("senses.json", "sense"), COMMON),

  itemProperty: collect(
    readFile("items-base.json", "itemProperty").map((row) => ({ ...row, name: row.name ?? row.entries?.[0]?.name })),
    [...COMMON, "abbreviation"],
  ),

  mastery: collect(readFile("items-base.json", "itemMastery"), COMMON),

  language: collect(readFile("languages.json", "language"), [...COMMON, "type", "typicalSpeakers", "script"]),
};

fs.mkdirSync(outDir, { recursive: true });
for (const [kind, rows] of Object.entries(kinds)) {
  const body = JSON.stringify(rows);
  fs.writeFileSync(path.join(outDir, `${kind}.json`), body);
  console.log(kind.padEnd(16), String(Object.keys(rows).length).padStart(6), "entries", String(Math.round(body.length / 1024)).padStart(6), "KB");
}
