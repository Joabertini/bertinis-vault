import type { AbilityId } from "@bertinis-vault/contracts";

import { generatedToolsByName, type GeneratedToolEntry } from "@bertinis-vault/contracts";

export type ToolProficiencyEntry = {
  /** The key on `system.tools`. */
  id: string;
  /**
   * What the tool rolls. Absent for a category.
   *
   * "Artisan's tools" covers seventeen tools across four different abilities,
   * so there is no one answer and dnd5e's own default stands. A number
   * invented here would be one nobody in the rules chose.
   */
  ability?: AbilityId;
  label: string;
  /** Whether this names one tool or a kind of tool. */
  kind: "tool" | "category";
};

const SKILL_ALIAS_TO_ID: Record<string, string> = {
  acrobatics: "acr",
  acrobacia: "acr",
  "animal handling": "ani",
  "manejo de animales": "ani",
  arcana: "arc",
  athletics: "ath",
  atletismo: "ath",
  deception: "dec",
  engaño: "dec",
  engano: "dec",
  history: "his",
  historia: "his",
  insight: "ins",
  intuicion: "ins",
  intuición: "ins",
  intimidation: "itm",
  intimidacion: "itm",
  intimidación: "itm",
  investigation: "inv",
  investigacion: "inv",
  investigación: "inv",
  medicine: "med",
  medicina: "med",
  nature: "nat",
  naturaleza: "nat",
  perception: "prc",
  percepcion: "prc",
  percepción: "prc",
  performance: "prf",
  interpretacion: "prf",
  interpretación: "prf",
  persuasion: "per",
  persuasione: "per",
  religion: "rel",
  religione: "rel",
  "sleight of hand": "slt",
  "juego de manos": "slt",
  stealth: "ste",
  sigilo: "ste",
  survival: "sur",
  supervivencia: "sur",
};

const LANGUAGE_ALIAS_TO_ID: Record<string, string> = {
  common: "common",
  comun: "common",
  dwarvish: "dwarvish",
  dwarf: "dwarvish",
  enano: "dwarvish",
  elvish: "elvish",
  elfico: "elvish",
  élfico: "elvish",
  gnomish: "gnomish",
  gnomo: "gnomish",
  halfling: "halfling",
  mediano: "halfling",
  giant: "giant",
  gigante: "giant",
  goblin: "goblin",
  draconic: "draconic",
  draconico: "draconic",
  dracónico: "draconic",
  infernal: "infernal",
  abyssal: "abyssal",
  celestial: "celestial",
  primordial: "primordial",
  sylvan: "sylvan",
  orc: "orc",
  orcish: "orc",
  undercommon: "undercommon",
  "deep speech": "deep",
};

/**
 * Names the builder accepts for a tool, beyond its canonical one.
 *
 * The canonical names come from the generated table and are English, because
 * that is what the index and the importer both speak. These are what a player
 * actually types: Spanish, and the shapes an apostrophe-free keyboard makes.
 *
 * The `vehicle land` and `vehicle water` spellings are here because the table
 * this replaced used them, and a draft saved with one should still resolve.
 */
const TOOL_NAME_ALIASES: Record<string, string> = {
  "herramientas de ladron": "thieves' tools",
  "kit de herboristeria": "herbalism kit",
  "kit de disfraz": "disguise kit",
  "kit de falsificacion": "forgery kit",
  "kit de veneno": "poisoner's kit",
  "kit de envenenador": "poisoner's kit",
  "herramientas de navegacion": "navigator's tools",
  "herramientas de artesano": "artisan's tools",
  "artisan tools": "artisan's tools",
  "instrumento musical": "musical instrument",
  "set de juego": "gaming set",
  "juego de mesa": "gaming set",
  "vehiculos terrestres": "vehicles (land)",
  "vehiculos acuaticos": "vehicles (water)",
  "vehiculos aereos": "vehicles (air)",
  "vehicle land": "vehicles (land)",
  "vehicle water": "vehicles (water)",
};

/**
 * A tool name reduced to something two spellings of it share.
 *
 * Apostrophes are dropped rather than turned into spaces, which is the one
 * thing separating this from `normalizeProficiencyLabel`: "smith's tools" and
 * "smiths tools" are the same proficiency and a player will type either.
 */
export function normalizeToolLabel(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^tool:\s*/, "")
    .replace(/['\u2019]/g, "")
    .replace(/[^a-z0-9()\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const toolsByNormalizedName = new Map<string, GeneratedToolEntry>();
for (const [name, entry] of Object.entries(generatedToolsByName)) {
  toolsByNormalizedName.set(normalizeToolLabel(name), entry);
}

const aliasToCanonical = new Map<string, string>();
for (const [alias, canonical] of Object.entries(TOOL_NAME_ALIASES)) {
  aliasToCanonical.set(normalizeToolLabel(alias), normalizeToolLabel(canonical));
}

export function normalizeSkillLabel(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeProficiencyLabel(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s:-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveSkillId(value: string) {
  return SKILL_ALIAS_TO_ID[normalizeSkillLabel(value)];
}

export function resolveLanguageId(value: string) {
  const normalized = normalizeProficiencyLabel(value).replace(/^language:\s*/, "");
  return LANGUAGE_ALIAS_TO_ID[normalized];
}

/**
 * The `dnd5e` entry for a tool name, or undefined when it has none.
 *
 * A tool with no entry is dropped rather than written under its name: the
 * actor's tool map has no fixed keys, so `system.tools["Smith's Tools"]` is
 * created happily and then shown nowhere.
 */
export function resolveToolEntry(value: string): ToolProficiencyEntry | undefined {
  const normalized = normalizeToolLabel(value);
  const canonical = aliasToCanonical.get(normalized) ?? normalized;
  return toolsByNormalizedName.get(canonical);
}

/** Every tool proficiency there is, for a picker to list. */
export function allToolEntries(): ToolProficiencyEntry[] {
  return Object.values(generatedToolsByName);
}
