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

function collect(rows, keys, extraKey) {
  const out = {};
  for (const row of rows) {
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

  subclass: collect(readDir("class", "subclass"), [...COMMON, "className", "classSource", "shortName", "subclassFeatures", "spellcastingAbility", "casterProgression", "additionalSpells"], (row) => [row.className ?? ""]),

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
