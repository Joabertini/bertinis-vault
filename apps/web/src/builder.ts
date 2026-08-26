import type {
  AbilityId,
  CasterProgression,
  CharacterBuild,
  CharacterBuildInput,
} from "@bertinis-vault/contracts";
import {
  getArmorCatalogEntry,
  getBackgroundCatalogEntry,
  getFeatCatalogEntry,
  getGearCatalogEntry,
  getSpellCatalogEntry,
  getSubclassCatalogEntry,
  getWeaponCatalogEntry,
  resolveArmorId,
  resolveFeatId,
  resolveGearId,
  resolveSpellId,
  resolveWeaponId,
  slugifyId,
} from "@bertinis-vault/data-engine";
import {
  applyAbilityBonuses,
  bonusesFromChoices,
  deriveCharacterBuild,
  bonusesFromFeats,
  featsFromChoices,
  unansweredFeatAbilities,
  multiclassRequirementProblems,
  resolveSkillId,
  resolveToolEntry,
  expertiseFrom,
  unansweredExpertise,
  originAbilityBonuses,
  unansweredOriginAbilities,
  type OriginAbilityAnswer,
  type OriginAbilityOption,
  averageStartingGold,
  resolveStartingEquipment,
  type ResolvedStartingEquipment,
  type StartingEquipmentList,
  type ExpertiseAnswer,
  type ExpertiseEntry,
  type TakenFeat,
  savingThrowsForClass,
  suggestedAbilityBonuses,
  type AbilityBonusMap,
  type LevelChoice,
} from "@bertinis-vault/domain";
import {
  armorFormulaOf,
  armorClassOptionsFor,
  startingEquipmentListsFor,
  originAbilityChoiceFor,
  classInfoFor,
  expertiseGrantsFor,
  featAbilityGrantsFor,
  featChoiceForBackground,
  itemInfoFor,
  slugOf,
  subclassInfoFor,
} from "./index-options";

import type { RulesVersion } from "@bertinis-vault/vetools-ref";

export type BuilderRulesVersion = "5e-2014" | "5e-2024";

/** How the player generated their raw scores. */
export type StatMethod = "manual" | "array" | "pointbuy" | "roll";

/** The schema's name for each generation method. */
const generationMethodByStatMethod = {
  manual: "manual",
  array: "standard-array",
  pointbuy: "point-buy",
  roll: "roll",
} as const;

/** Spanish labels for the six abilities, for anything the sheet displays. */
export const abilityLabels: Record<string, string> = {
  str: "Fuerza",
  dex: "Destreza",
  con: "Constitucion",
  int: "Inteligencia",
  wis: "Sabiduria",
  cha: "Carisma",
};

export type BuilderState = {
  createdAt: string;
  /**
   * Which edition the character is built for.
   *
   * It decides which books are legal, and so which document each pick becomes
   * on import. The derived numbers still come from the 2014 tables.
   */
  rulesVersion: BuilderRulesVersion;
  characterName: string;
  playerName: string;
  alignment: string;
  raceId: string;
  subraceId: string;
  classId: string;
  subclassId: string;
  backgroundId: string;
  /**
   * The feat chosen from the ones the background offers.
   *
   * Only meaningful when the background offers a choice: Ruined gives Alert,
   * Skilled or Tough, and until this existed it gave none of them. A
   * background that names one feat needs no answer here.
   */
  backgroundFeatId: string;
  featId: string;
  weaponId: string;
  armorId: string;
  extraEquipmentText: string;
  /**
   * Which option each starting-equipment row was answered with.
   *
   * Keyed "class:0" / "background:0" — the list and the row — because both
   * lists number their rows from zero and both ask questions.
   */
  equipmentChoices: Record<string, string>;
  /** 2014's "or 4d4 × 10 gp instead", which replaces every list at once. */
  takeStartingGold: boolean;
  /**
   * Which abilities the background's 2024 increase raises.
   *
   * Null in 2014, where the increase belongs to the species and this question
   * is not asked. `abilityBonuses` stays the manual field it was: it carries
   * the species bonus, which most species leave to the player.
   */
  originAbilityChoice: OriginAbilityAnswer | null;
  proficienciesText: string;
  languagesText: string;
  cantripsText: string;
  spellsText: string;
  featuresText: string;
  level: number;
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
  trait: string;
  ideal: string;
  bond: string;
  flaw: string;
  notes: string;
  /** How the raw scores were generated. Recorded, not just used by the UI. */
  statMethod: StatMethod;
  /**
   * The species or background bonus.
   *
   * Editable rather than derived: Monsters of the Multiverse made the bonus
   * floating for most species, and 2024 moved it to the background, so for
   * most of the index there is no fixed answer to look up.
   */
  abilityBonuses: AbilityBonusMap;
  /**
   * What the character chose at each level that asked, keyed by that level.
   *
   * Keyed by level rather than held as a list because the question belongs to
   * the level: a fighter who drops from 14 to 12 should lose the answers they
   * gave at 14, and find them again if they go back up.
   */
  levelChoices: Record<number, LevelChoice>;
  /**
   * Level-up picks, by the id the index resolves: fighting styles, eldritch
   * invocations, the pact boon, metamagic, maneuvers.
   *
   * A flat list rather than one keyed by pool. Which pool a pick answers is a
   * property of the option itself — its `featureType` — so keying by pool here
   * would be a second place for the same fact to be wrong.
   */
  optionalFeatureIds: string[];
  /**
   * The ability a half-feat raises, keyed by the feat it belongs to.
   *
   * One home for all three ways a feat arrives — chosen at a level, granted by
   * a background, granted by the variant human — because only the first has a
   * level slot to keep it in, and a point kept in two places is a point counted
   * twice.
   */
  featAbilityChoices: Record<string, AbilityBonusMap>;
  /**
   * Which proficiencies each expertise grant doubles, keyed by the feature.
   *
   * Keyed by feature rather than by level because a class can grant expertise
   * twice at different levels and a subclass can grant its own at a third, and
   * the answers must stay apart when the character levels past one of them.
   */
  expertiseChoices: Record<string, ExpertiseAnswer>;
  /**
   * Classes beyond the first.
   *
   * The first class keeps its own fields rather than becoming entry zero of an
   * array, because it is not merely the first: it is the class taken at level
   * 1, and the rules single it out. It alone grants saving throw
   * proficiencies and starting equipment, and its hit die is the one that
   * arrives at maximum. `classesFor` is what everything downstream reads, so
   * the split lives here and nowhere else.
   */
  extraClasses: BuilderClass[];
  /**
   * Which book each pick came from, keyed by `"<prop>:<id>"`.
   *
   * Only the picks whose name is not unique within the ruleset need it, but
   * recording it for every pick made through the index costs nothing and keeps
   * the draft resolvable if a later book adds a colliding name.
   */
  sourceBooks: Record<string, string>;
};

function parseLineList(value: string) {
  return value
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function uniqueEntries(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

const skillNames = new Set([
  "acrobatics",
  "animal handling",
  "arcana",
  "athletics",
  "deception",
  "history",
  "insight",
  "intimidation",
  "investigation",
  "medicine",
  "nature",
  "perception",
  "performance",
  "persuasion",
  "religion",
  "sleight of hand",
  "stealth",
  "survival",
]);

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s'()-]/g, "")
    .replace(/\s+/g, " ");
}

function classifyProficiencyKind(entry: string) {
  const normalized = normalizeText(entry);

  if (skillNames.has(normalized)) {
    return { kind: "skill" as const, id: undefined };
  }

  // Asked before the name is inspected, because the table knows tools whose
  // names say nothing: Bagpipes, Lute, Drum and Dice Set are all tools and
  // none of them contains the word "tool". They used to fall through to
  // "other" and be dropped without a word.
  const toolEntry = resolveToolEntry(entry);
  if (toolEntry) {
    return { kind: "tool" as const, id: toolEntry.id };
  }

  // A name that reads like a tool but is not one dnd5e has a key for. Kept as
  // a tool so preflight reports it as unresolved rather than filing it under
  // "other" and saying nothing, and carried with no id because the only ids
  // worth carrying are the system's.
  const gearEntry = getGearCatalogEntry(entry);
  if (
    /(tool|tools|kit|kit's|supplies|instrument|gaming set|vehicle)/i.test(gearEntry?.label ?? entry)
  ) {
    return { kind: "tool" as const, id: undefined };
  }

  const weaponEntry = getWeaponCatalogEntry(entry);
  if (weaponEntry) {
    return { kind: "weapon" as const, id: weaponEntry.id };
  }

  const armorEntry = getArmorCatalogEntry(entry);
  if (armorEntry) {
    return { kind: "armor" as const, id: armorEntry.id };
  }

  return { kind: "other" as const, id: undefined };
}

/**
 * The armour, with the formula that computes its armour class.
 *
 * The index knows every armour in the game and what it is worth; the old
 * catalog knew five. Falling back to the catalog keeps drafts written before
 * the index carried armour class working.
 */
function normalizeArmorEntry(state: BuilderState) {
  const rulesVersion = state.rulesVersion === "5e-2024" ? "2024" : "2014";
  const row = itemInfoFor(state.armorId, rulesVersion, state.sourceBooks[`item:${state.armorId}`]);
  const base = normalizeEquipmentEntry(state.armorId);
  if (!row) return base;

  const { formula, shield } = armorFormulaOf(row);

  return {
    ...base,
    itemId: slugOf(row.name),
    label: row.name,
    category: shield ? ("shield" as const) : ("armor" as const),
    ...(formula ? { armorFormula: formula } : {}),
    ...(shield ? { grantsShieldBonus: true } : {}),
  };
}

function normalizeEquipmentEntry(entry: string, quantity = 1) {
  const weaponEntry = getWeaponCatalogEntry(entry);
  if (weaponEntry) {
    return {
      itemId: weaponEntry.id,
      label: weaponEntry.label,
      quantity,
      category: "weapon" as const,
    };
  }

  const armorEntry = getArmorCatalogEntry(entry);
  if (armorEntry) {
    return {
      itemId: armorEntry.id,
      label: armorEntry.label,
      quantity,
      category: armorEntry.grantsShieldBonus ? ("shield" as const) : ("armor" as const),
    };
  }

  const gearEntry = getGearCatalogEntry(entry);
  if (gearEntry) {
    return {
      itemId: gearEntry.id,
      label: gearEntry.label,
      quantity,
      category: "gear" as const,
    };
  }

  return {
    itemId: resolveGearId(entry),
    label: entry,
    quantity,
    category: "other" as const,
  };
}

function normalizeFeatureEntry(entry: string, state: BuilderState) {
  const featEntry = getFeatCatalogEntry(entry);
  if (featEntry) {
    return {
      featureId: featEntry.id,
      label: featEntry.label,
      source: "feat" as const,
    };
  }

  const subclassEntry = state.subclassId ? getSubclassCatalogEntry(state.subclassId) : undefined;
  const backgroundEntry = state.backgroundId ? getBackgroundCatalogEntry(state.backgroundId) : undefined;
  const normalizedLabel = normalizeText(entry);

  if (
    subclassEntry &&
    normalizedLabel.includes(normalizeText(subclassEntry.label.replace(/^The\s+/i, "")))
  ) {
    return {
      featureId: `${subclassEntry.id}:${slugifyId(entry)}`,
      label: entry,
      source: "subclass" as const,
    };
  }

  if (backgroundEntry && normalizedLabel.includes(normalizeText(backgroundEntry.label))) {
    return {
      featureId: `${backgroundEntry.id}:${slugifyId(entry)}`,
      label: entry,
      source: "background" as const,
    };
  }

  return {
    featureId: slugifyId(entry),
    label: entry,
    source: "class" as const,
  };
}

export const builderDraftStorageKey = "bertinis-vault:web-builder:draft";

/**
 * What the sheet calls a character the player has not named yet.
 *
 * The canonical schema requires a name, which is right for a character being
 * exported. A draft is not that: the builder derives a snapshot on every
 * keystroke, including the one that empties the field, and the schema used to
 * throw straight through the render.
 */
export const unnamedCharacterLabel = "Personaje sin nombre";

/** Whether the draft still owes us a name before it can be published. */
export function isCharacterNameMissing(state: BuilderState) {
  return state.characterName.trim().length === 0;
}

/**
 * An optional label, or nothing at all.
 *
 * The schema reads these as `.min(1).optional()`, so an empty string is a
 * violation while an absent key is fine. A cleared field means absent.
 */
function optionalLabel(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export const initialState: BuilderState = {
  createdAt: new Date().toISOString(),
  rulesVersion: "5e-2014",
  statMethod: "manual",
  abilityBonuses: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
  levelChoices: {},
  optionalFeatureIds: [],
  featAbilityChoices: {},
  expertiseChoices: {},
  extraClasses: [],
  characterName: "Seraphina Vale",
  playerName: "Martin",
  alignment: "Neutral Bueno",
  raceId: "human",
  subraceId: "",
  classId: "wizard",
  subclassId: "school-of-evocation",
  backgroundId: "sage",
  backgroundFeatId: "",
  featId: "magic-initiate",
  weaponId: "quarterstaff",
  // Unarmoured, not the spell — "mage-armor" slugified to nothing pickable
  // and nothing that reads it treated it as "none" either.
  armorId: "",
  // Not the spellbook: the wizard's own equipment list grants one, and this
  // field is for what a player adds on top.
  extraEquipmentText: "component-pouch",
  equipmentChoices: {},
  takeStartingGold: false,
  originAbilityChoice: null,
  proficienciesText: "Arcana\nInvestigation\nThieves' Tools",
  languagesText: "Common\nElvish\nDraconic",
  cantripsText: "Mage Hand\nPrestidigitation",
  spellsText: "Nv1: Shield\nNv1: Magic Missile\nNv2: Misty Step",
  featuresText: "Arcane Recovery\nSculpt Spells",
  level: 3,
  str: 8,
  dex: 14,
  con: 13,
  int: 17,
  wis: 12,
  cha: 10,
  trait: "Siempre toma notas, incluso en medio del peligro.",
  ideal: "El conocimiento es la mejor defensa contra el caos.",
  bond: "Su mentor desaparecido dejo pistas sobre una biblioteca sellada.",
  flaw: "Le cuesta abandonar una pista, incluso cuando pone al grupo en riesgo.",
  notes: "Lleva un grimorio con observaciones sobre portales, constelaciones y runas rotas.",
  sourceBooks: {},
};

export function coerceBuilderState(value: unknown): BuilderState {
  if (!value || typeof value !== "object") {
    return initialState;
  }

  const candidate = value as Partial<BuilderState>;
  // Fields older drafts carried and this one no longer declares.
  const legacy = value as { asiPoints?: unknown };

  return {
    createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : initialState.createdAt,
    characterName: typeof candidate.characterName === "string" ? candidate.characterName : initialState.characterName,
    playerName: typeof candidate.playerName === "string" ? candidate.playerName : initialState.playerName,
    alignment: typeof candidate.alignment === "string" ? candidate.alignment : initialState.alignment,
    raceId: typeof candidate.raceId === "string" ? candidate.raceId : initialState.raceId,
    subraceId: typeof candidate.subraceId === "string" ? candidate.subraceId : initialState.subraceId,
    classId: typeof candidate.classId === "string" ? candidate.classId : initialState.classId,
    subclassId: typeof candidate.subclassId === "string" ? candidate.subclassId : initialState.subclassId,
    backgroundId:
      typeof candidate.backgroundId === "string" ? candidate.backgroundId : initialState.backgroundId,
    backgroundFeatId:
      typeof candidate.backgroundFeatId === "string"
        ? candidate.backgroundFeatId
        : initialState.backgroundFeatId,
    featId: typeof candidate.featId === "string" ? candidate.featId : initialState.featId,
    weaponId: typeof candidate.weaponId === "string" ? candidate.weaponId : initialState.weaponId,
    armorId: typeof candidate.armorId === "string" ? candidate.armorId : initialState.armorId,
    extraEquipmentText:
      typeof candidate.extraEquipmentText === "string"
        ? candidate.extraEquipmentText
        : initialState.extraEquipmentText,
    proficienciesText:
      typeof candidate.proficienciesText === "string"
        ? candidate.proficienciesText
        : initialState.proficienciesText,
    languagesText:
      typeof candidate.languagesText === "string"
        ? candidate.languagesText
        : initialState.languagesText,
    cantripsText:
      typeof candidate.cantripsText === "string" ? candidate.cantripsText : initialState.cantripsText,
    spellsText: typeof candidate.spellsText === "string" ? candidate.spellsText : initialState.spellsText,
    featuresText:
      typeof candidate.featuresText === "string" ? candidate.featuresText : initialState.featuresText,
    level: typeof candidate.level === "number" ? candidate.level : initialState.level,
    str: typeof candidate.str === "number" ? candidate.str : initialState.str,
    dex: typeof candidate.dex === "number" ? candidate.dex : initialState.dex,
    con: typeof candidate.con === "number" ? candidate.con : initialState.con,
    int: typeof candidate.int === "number" ? candidate.int : initialState.int,
    wis: typeof candidate.wis === "number" ? candidate.wis : initialState.wis,
    cha: typeof candidate.cha === "number" ? candidate.cha : initialState.cha,
    trait: typeof candidate.trait === "string" ? candidate.trait : initialState.trait,
    ideal: typeof candidate.ideal === "string" ? candidate.ideal : initialState.ideal,
    bond: typeof candidate.bond === "string" ? candidate.bond : initialState.bond,
    flaw: typeof candidate.flaw === "string" ? candidate.flaw : initialState.flaw,
    notes: typeof candidate.notes === "string" ? candidate.notes : initialState.notes,
    rulesVersion: candidate.rulesVersion === "5e-2024" ? "5e-2024" : "5e-2014",
    statMethod: coerceStatMethod(candidate.statMethod),
    abilityBonuses: coerceAbilityBonuses(candidate.abilityBonuses),
    levelChoices: coerceLevelChoices(candidate.levelChoices, legacy.asiPoints),
    // A draft saved before level-up picks existed simply has none.
    optionalFeatureIds: Array.isArray(candidate.optionalFeatureIds)
      ? candidate.optionalFeatureIds.filter((id): id is string => typeof id === "string" && id !== "")
      : [],
    featAbilityChoices: coerceFeatAbilityChoices(candidate.featAbilityChoices, candidate.levelChoices),
    expertiseChoices: coerceExpertiseChoices(candidate.expertiseChoices),
    // A draft saved before multiclassing existed simply has one class.
    extraClasses: coerceExtraClasses(candidate.extraClasses),
    // A draft saved before equipment was a choice simply has no answers.
    equipmentChoices: coerceEquipmentChoices(candidate.equipmentChoices),
    takeStartingGold: candidate.takeStartingGold === true,
    // A draft saved before 2024's origin increase existed simply has none.
    originAbilityChoice: coerceOriginAbilityChoice(candidate.originAbilityChoice),
    sourceBooks: coerceSourceBooks(candidate.sourceBooks),
  };
}

function coerceStatMethod(value: unknown): StatMethod {
  return value === "array" || value === "pointbuy" || value === "roll" ? value : "manual";
}

/** Drafts saved before the builder tracked bonuses simply have none. */
function coerceAbilityBonuses(value: unknown): AbilityBonusMap {
  if (!value || typeof value !== "object") return {};

  const result: AbilityBonusMap = {};
  for (const ability of ["str", "dex", "con", "int", "wis", "cha"] as const) {
    const amount = (value as Record<string, unknown>)[ability];
    if (typeof amount === "number" && Number.isFinite(amount)) result[ability] = Math.trunc(amount);
  }

  return result;
}

/**
 * Read the per-level choices back out of a draft.
 *
 * Drafts written before levels were choices carried a single pool of spent
 * improvement points with no record of which level they came from. Those are
 * folded into the first improvement, which is where a player spending a pool
 * of two would have put them anyway, and is the only reading that does not
 * silently throw their scores away.
 */
/**
 * The half-feat raises a draft carries, with older drafts brought forward.
 *
 * Feat raises used to live on the level choice that took the feat. They now
 * live under the feat itself, because a background's feat and the variant
 * human's have no level slot at all. A draft written under the old shape is
 * migrated here rather than losing its picks, and `bonusesFromChoices` ignores
 * feat bonuses outright, so a draft that is read twice cannot count a point
 * twice.
 */
function coerceFeatAbilityChoices(
  value: unknown,
  legacyLevelChoices: unknown,
): Record<string, AbilityBonusMap> {
  const result: Record<string, AbilityBonusMap> = {};

  if (value && typeof value === "object") {
    for (const [featId, bonuses] of Object.entries(value as Record<string, unknown>)) {
      const coerced = coerceAbilityBonuses(bonuses);
      if (featId && Object.keys(coerced).length > 0) result[featId] = coerced;
    }
  }

  if (legacyLevelChoices && typeof legacyLevelChoices === "object") {
    for (const raw of Object.values(legacyLevelChoices as Record<string, unknown>)) {
      if (!raw || typeof raw !== "object") continue;
      const choice = raw as { kind?: unknown; featId?: unknown; bonuses?: unknown };
      if (choice.kind !== "feat" || typeof choice.featId !== "string" || !choice.featId) continue;
      if (result[choice.featId]) continue;

      const coerced = coerceAbilityBonuses(choice.bonuses);
      if (Object.keys(coerced).length > 0) result[choice.featId] = coerced;
    }
  }

  return result;
}

function coerceLevelChoices(value: unknown, legacyPool: unknown): Record<number, LevelChoice> {
  if (!value || typeof value !== "object") {
    const pool = coerceAbilityBonuses(legacyPool);
    return Object.keys(pool).length > 0 ? { 4: { kind: "improvement", bonuses: pool } } : {};
  }

  const result: Record<number, LevelChoice> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const level = Number.parseInt(key, 10);
    if (!Number.isInteger(level) || !raw || typeof raw !== "object") continue;

    const candidate = raw as { kind?: unknown; featId?: unknown; bonuses?: unknown };
    if (candidate.kind === "feat") {
      const bonuses = coerceAbilityBonuses(candidate.bonuses);
      result[level] = {
        kind: "feat",
        featId: typeof candidate.featId === "string" ? candidate.featId : "",
        ...(Object.keys(bonuses).length > 0 ? { bonuses } : {}),
      };
    } else {
      result[level] = { kind: "improvement", bonuses: coerceAbilityBonuses(candidate.bonuses) };
    }
  }

  return result;
}

/** Drafts saved before the builder recorded books have none. That is fine. */
function coerceSourceBooks(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};

  const result: Record<string, string> = {};
  for (const [key, book] of Object.entries(value as Record<string, unknown>)) {
    if (typeof book === "string" && book.length > 0) result[key] = book;
  }

  return result;
}

export function abilityModifier(score: number) {
  return Math.floor((score - 10) / 2);
}

export function proficiencyBonus(level: number) {
  if (level >= 17) return 6;
  if (level >= 13) return 5;
  if (level >= 9) return 4;
  if (level >= 5) return 3;
  return 2;
}

/**
 * The feats the chosen background grants.
 *
 * The index is asked first: it knows all 161 backgrounds where the catalog
 * knew 27, and it is the only place the 2024 origin feats exist. A background
 * that names exactly one feat grants it without asking; one that offers
 * several — or allows an unnamed one — waits for the player's answer, and
 * grants nothing until it arrives rather than guessing.
 */
/**
 * Every feat the character has, with what it raises and what was chosen.
 *
 * The three sources are folded into one list because the rules do not care
 * where a feat came from: Resilient owes its +1 whether a level bought it, a
 * background granted it, or the variant human did.
 */
export function takenFeatsFor(state: BuilderState): TakenFeat[] {
  const featIds = uniqueEntries(
    [
      ...backgroundFeatIdsFor(state),
      state.featId,
      ...featsFromChoices(state.levelChoices),
    ].filter(Boolean),
  );

  return featIds.map((featId) => ({
    featId,
    grants: featAbilityGrantsFor(featId, state.rulesVersion === "5e-2024" ? "2024" : "2014"),
    bonuses: state.featAbilityChoices[featId] ?? {},
  }));
}

/**
 * The feats whose ability increase is still unanswered, or does not fit.
 *
 * This is what stops a half-feat being lost in silence, which is the whole
 * reason any of this exists: the sheet used to show a Charisma one point lower
 * than the player had earned, and nothing said why.
 */
export function pendingFeatAbilitiesFor(state: BuilderState) {
  return unansweredFeatAbilities(takenFeatsFor(state));
}

export function backgroundFeatIdsFor(state: BuilderState): string[] {
  if (!state.backgroundId) return [];

  const rulesVersion = state.rulesVersion === "5e-2024" ? "2024" : "2014";
  const choice = featChoiceForBackground(
    state.backgroundId,
    rulesVersion,
    state.sourceBooks[`background:${state.backgroundId}`],
  );

  if (choice) {
    if (choice.options.length === 1 && !choice.isOpen) {
      return [slugOf((choice.options[0] as { name: string }).name)];
    }

    return state.backgroundFeatId ? [state.backgroundFeatId] : [];
  }

  // Backgrounds the index does not cover fall back to the hand-written
  // catalog, which is still the source for everything but the feat.
  const entry = getBackgroundCatalogEntry(state.backgroundId);
  return uniqueEntries(entry?.grantedFeatIds ?? []);
}

/**
 * Classes the character has levels in but does not qualify for.
 *
 * The requirement binds only on a multiclass character, and then on every
 * class including the first: you must qualify for the one you are leaving as
 * well as the one you are entering. So a Strength 8 wizard is legal and a
 * Strength 8 wizard 4 / fighter 1 is not.
 *
 * Reported rather than refused. A table that ignores this rule exists, and a
 * warning the player can read beats a build they cannot make.
 */
export function unmetMulticlassRequirementsFor(state: BuilderState) {
  const snapshot = buildCanonicalSnapshot(state);

  return multiclassRequirementProblems({
    entries: snapshot.classing.classes.map((entry) => ({
      classId: entry.classId,
      level: entry.level,
      multiclassRequirements: entry.multiclassRequirements,
    })),
    scores: snapshot.abilities.final,
  });
}

/** One class a character has levels in, as the builder holds it. */
export type BuilderClass = { classId: string; subclassId: string; level: number };

/**
 * Every class the character has, first one included.
 *
 * The single place the primary-plus-extras split is turned back into a list,
 * so nothing downstream has to know the state is shaped that way. An entry
 * with no class or no levels is dropped rather than carried: a half-filled row
 * in the interface is not a class the character has.
 */
export function classesFor(state: BuilderState): BuilderClass[] {
  return [
    { classId: state.classId, subclassId: state.subclassId, level: state.level },
    ...state.extraClasses,
  ].filter((entry) => entry.classId !== "" && entry.level > 0);
}

/** The character's level, which is every class's levels added together. */
export function characterLevelFor(state: BuilderState): number {
  return classesFor(state).reduce((total, entry) => total + entry.level, 0);
}

/** Class entries off a draft, dropping anything that is not one. */
function coerceExtraClasses(value: unknown): BuilderClass[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const candidate = raw as Partial<BuilderClass>;
    if (typeof candidate.classId !== "string" || candidate.classId === "") return [];

    const level = Number(candidate.level);
    return [
      {
        classId: candidate.classId,
        subclassId: typeof candidate.subclassId === "string" ? candidate.subclassId : "",
        level: Number.isInteger(level) ? Math.min(Math.max(level, 1), 20) : 1,
      },
    ];
  });
}

/**
 * The starting-equipment answers a build has, as the rules layer wants them.
 *
 * Stored as a flat map rather than per list, because a row id already names
 * its list: "class:0" and "background:0" are different questions.
 */
export function equipmentAnswersFor(state: BuilderState): Record<string, string> {
  return state.equipmentChoices;
}

/** The lists this build has to answer, class first then background. */
export function equipmentListsFor(state: BuilderState): StartingEquipmentList[] {
  return startingEquipmentListsFor({
    classId: state.classId,
    backgroundId: state.backgroundId,
    rulesVersion: state.rulesVersion === "5e-2024" ? "2024" : "2014",
    ...(state.sourceBooks.background ? { backgroundSourceBook: state.sourceBooks.background } : {}),
  });
}

/**
 * What the character starts with, once the questions are answered.
 *
 * Taking the gold is a 2014 rule and replaces every list at once. The average
 * of the formula is used rather than a roll: a build has to be reproducible,
 * and re-rolling starting gold every time the page renders is not that.
 */
export function startingEquipmentFor(state: BuilderState): ResolvedStartingEquipment {
  const lists = equipmentListsFor(state);
  const formula = lists.find((list) => list.goldAlternative)?.goldAlternative ?? null;
  const gold = formula ? averageStartingGold(formula) : null;

  return resolveStartingEquipment({
    lists,
    answers: state.equipmentChoices,
    takeGold: state.takeStartingGold,
    goldCopper: gold === null ? 0 : Math.round(gold * 100),
  });
}

/** Equipment answers off a draft, dropping anything that is not one. */
function coerceEquipmentChoices(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};

  const answers: Record<string, string> = {};
  for (const [key, option] of Object.entries(value as Record<string, unknown>)) {
    if (typeof option === "string" && option !== "") answers[key] = option;
  }
  return answers;
}

/** The 2024 ability increase this build's background offers, if it does. */
export function originAbilityChoiceForBuild(state: BuilderState): OriginAbilityOption[] | null {
  return originAbilityChoiceFor(
    state.backgroundId,
    state.rulesVersion === "5e-2024" ? "2024" : "2014",
    state.sourceBooks.background,
  );
}

/** What the background's increase is worth, once answered. */
export function originAbilityBonusesFor(state: BuilderState): Partial<Record<AbilityId, number>> {
  return originAbilityBonuses(originAbilityChoiceForBuild(state), state.originAbilityChoice);
}

/** How many halves of the increase are still unanswered. */
export function pendingOriginAbilitiesFor(state: BuilderState): number {
  return unansweredOriginAbilities(originAbilityChoiceForBuild(state), state.originAbilityChoice);
}

/** An origin answer off a draft, dropping anything that is not one. */
function coerceOriginAbilityChoice(value: unknown): OriginAbilityAnswer | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Partial<OriginAbilityAnswer>;
  const optionIndex = Number(candidate.optionIndex);
  if (!Number.isInteger(optionIndex) || optionIndex < 0) return null;

  return {
    optionIndex,
    abilities: Array.isArray(candidate.abilities)
      ? candidate.abilities.filter((entry): entry is string => typeof entry === "string")
      : [],
  };
}

/** The key an expertise answer is stored under. */
export function expertiseKeyOf(grant: { name: string; source: string; level: number }): string {
  return `${grant.name}|${grant.source}|${grant.level}`;
}

/**
 * Expertise answers off a draft, dropping anything that is not one.
 *
 * A draft saved before expertise existed simply has none, and a hand-edited
 * one carrying junk loses the junk rather than the build.
 */
function coerceExpertiseChoices(value: unknown): Record<string, ExpertiseAnswer> {
  if (!value || typeof value !== "object") return {};

  const out: Record<string, ExpertiseAnswer> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object") continue;
    const candidate = raw as Partial<ExpertiseAnswer>;
    const setIndex = Number(candidate.setIndex);
    if (!Number.isInteger(setIndex) || setIndex < 0) continue;

    out[key] = {
      setIndex,
      skills: Array.isArray(candidate.skills) ? candidate.skills.filter(isNonEmptyString) : [],
      tools: Array.isArray(candidate.tools) ? candidate.tools.filter(isNonEmptyString) : [],
    };
  }

  return out;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value !== "";
}

/**
 * The expertise questions this build is being asked, with its answers.
 *
 * The variant gate is fed from the features the player wrote down: a 2014
 * ranger only doubles a skill if they took Tasha's Deft Explorer in place of
 * Natural Explorer, and the builder has no other record of that choice.
 */
export function expertiseEntriesFor(state: BuilderState): ExpertiseEntry[] {
  const written = parseLineList(state.featuresText).map((entry) => entry.trim());

  // Per class, at that class's own level: a rogue 3 / bard 3 doubles two
  // proficiencies from the rogue and none from the bard, because the bard's
  // arrives at bard level 3 and this one is a bard 3 only in total.
  const grants = classesFor(state).flatMap((entry) =>
    expertiseGrantsFor({
      classId: entry.classId,
      subclassId: entry.subclassId,
      level: entry.level,
      rulesVersion: state.rulesVersion === "5e-2024" ? "2024" : "2014",
      variantsTaken: written,
    }),
  );

  return grants.map((grant) => ({
    grant,
    answer: state.expertiseChoices[expertiseKeyOf(grant)] ?? null,
  }));
}

/**
 * The expertise grants still unanswered, or answered with something the
 * character cannot double.
 *
 * Expertise doubles a proficiency the character already has, so the pool is
 * whatever they wrote in the proficiencies field — which is why this cannot
 * be checked in the index and has to be checked here.
 */
export function pendingExpertiseFor(state: BuilderState) {
  return unansweredExpertise(expertiseEntriesFor(state), proficiencyPoolsFor(state));
}

/**
 * What the character is proficient in, split into what expertise can double.
 *
 * Classified rather than taken from the class's skill list: a skill the
 * background granted is still a skill, and matching against the class list
 * would file it as a tool and drop it out of the pool.
 */
export function proficiencyPoolsFor(state: BuilderState): {
  proficientSkills: string[];
  proficientTools: string[];
} {
  const proficientSkills: string[] = [];
  const proficientTools: string[] = [];

  for (const entry of uniqueEntries(parseLineList(state.proficienciesText))) {
    const { kind } = classifyProficiencyKind(entry);
    if (kind === "skill") proficientSkills.push(entry);
    else if (kind === "tool") proficientTools.push(entry);
  }

  return { proficientSkills, proficientTools };
}

/**
 * One class entry, carrying what the index knows about the class.
 *
 * A third-caster's progression is the subclass's rather than the class's: a
 * fighter casts nothing and an eldritch knight casts a third, and the entry
 * carries both so the rules layer does not have to know which is which.
 */
function classEntryFor(entry: BuilderClass, builderRules: BuilderRulesVersion) {
  const rulesVersion = builderRules === "5e-2024" ? "2024" : "2014";
  const classRow = classInfoFor(entry.classId, rulesVersion);
  const subclassRow = entry.subclassId
    ? subclassInfoFor(entry.subclassId, entry.classId, rulesVersion)
    : null;

  // The subclass wins where it has one: an eldritch knight casts with
  // Intelligence and the fighter it is built on casts with nothing.
  const rawAbility = subclassRow?.spellcastingAbility ?? classRow?.spellcastingAbility;
  const ability = isAbility(rawAbility) ? rawAbility : null;

  return {
    classId: entry.classId,
    ...(entry.subclassId ? { subclassId: entry.subclassId } : {}),
    level: entry.level,
    ...(isCasterProgression(classRow?.casterProgression)
      ? { casterProgression: classRow.casterProgression }
      : {}),
    ...(isCasterProgression(subclassRow?.casterProgression)
      ? { subclassCasterProgression: subclassRow.casterProgression }
      : {}),
    ...(classRow?.hitDie ? { hitDie: classRow.hitDie } : {}),
    ...(classRow?.multiclassRequirements?.length
      ? { multiclassRequirements: classRow.multiclassRequirements }
      : {}),
    ...(ability ? { spellcastingAbility: ability } : {}),
  };
}

const CASTER_PROGRESSIONS = ["full", "1/2", "1/3", "artificer", "pact"];

function isCasterProgression(value: unknown): value is CasterProgression {
  return typeof value === "string" && CASTER_PROGRESSIONS.includes(value);
}

const ABILITY_IDS = ["str", "dex", "con", "int", "wis", "cha"];

function isAbility(value: unknown): value is AbilityId {
  return typeof value === "string" && ABILITY_IDS.includes(value);
}

/**
 * One line per thing owned, with the count beside it.
 *
 * The hand-picked weapon and armour, the free-text extras, and whatever the
 * starting lists granted all end up in one place, and they overlap: a fighter
 * who picks a longsword and is granted a longsword owns one. Matching is by
 * the slug, because that is what both sides are keyed by.
 */
function mergeStartingItems(
  chosen: string[],
  granted: { name: string; label: string; quantity: number }[],
  rulesVersion: RulesVersion,
): { entry: string; label: string | null; quantity: number }[] {
  const merged: { entry: string; label: string | null; quantity: number }[] = chosen.map(
    (entry) => ({ entry, label: null, quantity: 1 }),
  );

  for (const item of granted) {
    const entry = slugOf(item.label) || slugOf(item.name);
    const existing = merged.find((candidate) => slugOf(candidate.entry) === entry);
    if (existing) {
      existing.quantity += item.quantity;
      continue;
    }
    // The equipment list writes names in lower case ("ink (1-ounce bottle)").
    // The item index writes the same name properly, and it is the one a sheet
    // should show, so it wins where the item exists.
    const indexed = itemInfoFor(entry, rulesVersion);
    merged.push({ entry, label: indexed?.name ?? item.label, quantity: item.quantity });
  }

  return merged;
}

/**
 * The name a granted item shows when the shared catalog does not know it.
 *
 * The catalog covers weapons, armour and common gear; a letter from a dead
 * colleague or a one-ounce bottle of ink is outside it, and the fallback
 * label is the slug, which is not a name. The list's own name is.
 */
function withGrantedLabel<T extends { label: string; category: string }>(
  normalized: T,
  label: string | null,
): T {
  return normalized.category === "other" && label ? { ...normalized, label } : normalized;
}

export function buildCanonicalSnapshot(state: BuilderState): CharacterBuild {
  const cantrips = parseLineList(state.cantripsText).map((entry) => `Nv0: ${entry}`);
  const leveledSpells = parseLineList(state.spellsText);
  const features = parseLineList(state.featuresText);
  const extraEquipment = uniqueEntries(parseLineList(state.extraEquipmentText));
  // What the class and background lists hand over, once their questions are
  // answered. Merged into the same list the hand-picked weapon and armour
  // travel in, so a character who is granted the sword they also chose owns
  // one of it rather than two entries of one.
  const startingItems = mergeStartingItems(
    [state.weaponId, state.armorId, ...extraEquipment].filter(Boolean),
    startingEquipmentFor(state).items,
    state.rulesVersion === "5e-2024" ? "2024" : "2014",
  );
  const proficiencies = uniqueEntries(parseLineList(state.proficienciesText));
  const languageEntries = uniqueEntries(parseLineList(state.languagesText));
  const languages = languageEntries.map((entry) => `Language: ${entry}`);
  const normalizedWeapon = normalizeEquipmentEntry(state.weaponId);
  const normalizedArmor = normalizeArmorEntry(state);
  const spellEntries = [
    ...parseLineList(state.cantripsText).map((entry) => ({ label: entry, level: 0 })),
    ...leveledSpells.map((entry) => {
      const match = entry.match(/^Nv(\d+):\s*(.+)$/i);
      if (!match) {
        return { label: entry, level: 1 };
      }

      return {
        label: (match[2] ?? entry).trim(),
        level: Number.parseInt(match[1] ?? "1", 10),
      };
    }),
  ].map((entry) => {
    const spellId = resolveSpellId(entry.label);
    const catalogEntry = getSpellCatalogEntry(spellId);

    return {
      spellId,
      label: catalogEntry?.label ?? entry.label,
      level: entry.level,
    };
  });
  const expertise = expertiseFrom(expertiseEntriesFor(state));
  const backgroundGrantedFeatIds = backgroundFeatIdsFor(state);
  // A feat can arrive two ways: chosen at a level in place of an improvement,
  // or granted outside the levels entirely — the variant human's, and in 2024
  // the background's. Both land in the same list, and a feat the background
  // already granted is not counted twice.
  const chosenFeatIds = uniqueEntries(
    [state.featId, ...featsFromChoices(state.levelChoices)].filter(
      (featId) => featId && !backgroundGrantedFeatIds.includes(featId),
    ),
  );

  const baseScores = {
    str: state.str,
    dex: state.dex,
    con: state.con,
    int: state.int,
    wis: state.wis,
    cha: state.cha,
  };

  const buildInput: CharacterBuildInput = {
    meta: {
      rulesVersion: state.rulesVersion,
      sourceProfile: "vault-v1",
      createdAt: state.createdAt,
      updatedAt: new Date().toISOString(),
    },
    identity: {
      characterName: state.characterName.trim() || unnamedCharacterLabel,
      playerName: optionalLabel(state.playerName),
      alignment: optionalLabel(state.alignment),
      biography: {
        trait: optionalLabel(state.trait),
        ideal: optionalLabel(state.ideal),
        bond: optionalLabel(state.bond),
        flaw: optionalLabel(state.flaw),
        notes: optionalLabel(state.notes),
      },
    },
    ancestry: {
      raceId: state.raceId,
      ...(state.subraceId ? { subraceId: state.subraceId } : {}),
    },
    classing: {
      // The numbers the rules layer needs travel on each entry so it does not
      // have to look them up again, and so the editions stay apart: the 2014
      // paladin and the 2024 paladin advance spellcasting differently and a
      // table keyed by class id cannot say both.
      classes: classesFor(state).map((entry) => classEntryFor(entry, state.rulesVersion)),
    },
    background: {
      backgroundId: state.backgroundId,
      grantedFeatIds: backgroundGrantedFeatIds,
    },
    abilities: {
      generationMethod: generationMethodByStatMethod[state.statMethod],
      base: baseScores,
      // Everything downstream reads `final`: hit points, armour class, the
      // spell save DC, the attack bonus. Species bonuses and improvements have
      // to land here or the exported character is wrong.
      final: applyAbilityBonuses(
        baseScores,
        state.abilityBonuses,
        // 2024's increase, which comes off the background rather than the
        // species. Empty in 2014, where the species carries it and
        // `abilityBonuses` above is where it lands.
        originAbilityBonusesFor(state),
        bonusesFromChoices(state.levelChoices),
        // Half-feats. Until this line existed, Resilient, Fey Touched and
        // Telekinetic raised nothing and the sheet did not say so.
        bonusesFromFeats(takenFeatsFor(state)),
      ),
    },
    choices: {
      feats: chosenFeatIds,
      optionalFeatures: state.optionalFeatureIds,
      proficiencies: [...proficiencies, ...languages],
      spells: [...cantrips, ...leveledSpells],
      // armorId is blank for an unarmoured build (a wizard who never picked
      // one, say) — filtered here rather than treated as an item to resolve.
      equipment: startingItems.map((item) => item.entry),
      features,
        normalized: {
          feats: chosenFeatIds,
          proficiencies: [
            ...proficiencies.map((entry) => {
              const classification = classifyProficiencyKind(entry);
              return {
                kind: classification.kind,
                ...(classification.id ? { id: classification.id } : {}),
                label: entry,
              };
            }),
            ...languageEntries.map((entry) => ({
              kind: "language" as const,
              label: entry,
            })),
            // Every class grants two of these at level one. Nothing was ever
            // filling the payload's `savingThrows`, so every character
            // exported before this reached Foundry proficient in none.
            // Expertise travels beside the proficiency it doubles rather
            // than replacing it: a skill written only as expertise would
            // reach Foundry doubled but not proficient.
            ...expertise.skills.map((label) => ({
              kind: "expertise" as const,
              ...(resolveSkillId(label) ? { id: resolveSkillId(label) } : {}),
              label,
            })),
            ...expertise.tools.map((label) => ({
              kind: "toolExpertise" as const,
              label,
            })),
            ...savingThrowsForClass(state.classId).map((ability) => ({
              kind: "savingThrow" as const,
              id: ability,
              label: abilityLabels[ability] ?? ability,
            })),
          ],
        spells: spellEntries,
        equipment: startingItems.map((item) =>
          // The weapon and the armour keep their own normalizers: those two
          // read the build's own fields, which carry more than a name.
          item.entry === state.weaponId
            ? { ...normalizedWeapon, quantity: item.quantity }
            : item.entry === state.armorId && state.armorId
              ? { ...normalizedArmor, quantity: item.quantity }
              : withGrantedLabel(normalizeEquipmentEntry(item.entry, item.quantity), item.label),
        ),
          features: features.map((entry) => normalizeFeatureEntry(entry, state)),
        // Unarmored Defense and natural armour. The rules layer decides which
        // one wins; the build only says which the character has.
        armorClassOptions: classesFor(state).flatMap((entry, index) =>
          armorClassOptionsFor({
            classId: entry.classId,
            subclassId: entry.subclassId,
            // The species' natural armour belongs to the character, not to a
            // class, so it is asked for once rather than once per class.
            raceId: index === 0 ? state.raceId : "",
            rulesVersion: state.rulesVersion === "5e-2024" ? "2024" : "2014",
            sourceBook: state.sourceBooks[`race:${state.raceId}`],
          }),
        ),
      },
    },
    ...(Object.keys(state.sourceBooks).length > 0 ? { sourceBooks: state.sourceBooks } : {}),
  };

  return deriveCharacterBuild(buildInput);
}

export function parseCantripLines(value: string) {
  return uniqueEntries(parseLineList(value));
}

export function parseSpellLines(value: string) {
  return uniqueEntries(parseLineList(value));
}

export function parseEquipmentLines(value: string) {
  return uniqueEntries(parseLineList(value));
}

export function parseFeatureLines(value: string) {
  return uniqueEntries(parseLineList(value));
}

export function parseProficiencyLines(value: string) {
  return uniqueEntries(parseLineList(value));
}

export function appendUniqueLine(currentValue: string, nextValue: string) {
  const entries = uniqueEntries([...parseLineList(currentValue), nextValue.trim()]);
  return entries.join("\n");
}

export function removeLine(currentValue: string, targetValue: string) {
  return parseLineList(currentValue)
    .filter((entry) => entry !== targetValue)
    .join("\n");
}
