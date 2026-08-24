import type { CharacterBuild, CharacterBuildInput } from "@bertinis-vault/contracts";
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
  featsFromChoices,
  savingThrowsForClass,
  suggestedAbilityBonuses,
  type AbilityBonusMap,
  type LevelChoice,
} from "@bertinis-vault/domain";
import {
  armorFormulaOf,
  featChoiceForBackground,
  itemInfoFor,
  slugOf,
} from "./index-options";

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

  const gearEntry = getGearCatalogEntry(entry);
  if (
    gearEntry &&
    /(tool|tools|kit|kit's|supplies|instrument|gaming set|vehicle)/i.test(gearEntry.label)
  ) {
    return { kind: "tool" as const, id: gearEntry.id };
  }

  if (/(tool|tools|kit|supplies|instrument|gaming set|vehicle)/i.test(entry)) {
    return { kind: "tool" as const, id: gearEntry?.id ?? resolveGearId(entry) };
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

function normalizeEquipmentEntry(entry: string) {
  const weaponEntry = getWeaponCatalogEntry(entry);
  if (weaponEntry) {
    return {
      itemId: weaponEntry.id,
      label: weaponEntry.label,
      quantity: 1,
      category: "weapon" as const,
    };
  }

  const armorEntry = getArmorCatalogEntry(entry);
  if (armorEntry) {
    return {
      itemId: armorEntry.id,
      label: armorEntry.label,
      quantity: 1,
      category: armorEntry.grantsShieldBonus ? ("shield" as const) : ("armor" as const),
    };
  }

  const gearEntry = getGearCatalogEntry(entry);
  if (gearEntry) {
    return {
      itemId: gearEntry.id,
      label: gearEntry.label,
      quantity: 1,
      category: "gear" as const,
    };
  }

  return {
    itemId: resolveGearId(entry),
    label: entry,
    quantity: 1,
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
  extraEquipmentText: "spellbook\ncomponent-pouch",
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

export function buildCanonicalSnapshot(state: BuilderState): CharacterBuild {
  const cantrips = parseLineList(state.cantripsText).map((entry) => `Nv0: ${entry}`);
  const leveledSpells = parseLineList(state.spellsText);
  const features = parseLineList(state.featuresText);
  const extraEquipment = uniqueEntries(parseLineList(state.extraEquipmentText));
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
      classes: [
        {
          classId: state.classId,
          ...(state.subclassId ? { subclassId: state.subclassId } : {}),
          level: state.level,
        },
      ],
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
        bonusesFromChoices(state.levelChoices),
      ),
    },
    choices: {
      feats: chosenFeatIds,
      proficiencies: [...proficiencies, ...languages],
      spells: [...cantrips, ...leveledSpells],
      // armorId is blank for an unarmoured build (a wizard who never picked
      // one, say) — filtered here rather than treated as an item to resolve.
      equipment: [state.weaponId, state.armorId, ...extraEquipment].filter(Boolean),
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
            ...savingThrowsForClass(state.classId).map((ability) => ({
              kind: "savingThrow" as const,
              id: ability,
              label: abilityLabels[ability] ?? ability,
            })),
          ],
        spells: spellEntries,
        equipment: [
            normalizedWeapon,
            ...(state.armorId ? [normalizedArmor] : []),
            ...extraEquipment.map((entry) => normalizeEquipmentEntry(entry)),
        ],
          features: features.map((entry) => normalizeFeatureEntry(entry, state)),
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
