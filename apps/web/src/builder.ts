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
import { deriveCharacterBuild } from "@bertinis-vault/domain";

export type BuilderState = {
  createdAt: string;
  characterName: string;
  playerName: string;
  alignment: string;
  raceId: string;
  subraceId: string;
  classId: string;
  subclassId: string;
  backgroundId: string;
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
  characterName: "Seraphina Vale",
  playerName: "Martin",
  alignment: "Neutral Bueno",
  raceId: "human",
  subraceId: "",
  classId: "wizard",
  subclassId: "school-of-evocation",
  backgroundId: "sage",
  featId: "magic-initiate",
  weaponId: "quarterstaff",
  armorId: "mage-armor",
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
};

export function coerceBuilderState(value: unknown): BuilderState {
  if (!value || typeof value !== "object") {
    return initialState;
  }

  const candidate = value as Partial<BuilderState>;

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
  };
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

export function buildCanonicalSnapshot(state: BuilderState): CharacterBuild {
  const cantrips = parseLineList(state.cantripsText).map((entry) => `Nv0: ${entry}`);
  const leveledSpells = parseLineList(state.spellsText);
  const features = parseLineList(state.featuresText);
  const extraEquipment = uniqueEntries(parseLineList(state.extraEquipmentText));
  const proficiencies = uniqueEntries(parseLineList(state.proficienciesText));
  const languageEntries = uniqueEntries(parseLineList(state.languagesText));
  const languages = languageEntries.map((entry) => `Language: ${entry}`);
  const normalizedWeapon = normalizeEquipmentEntry(state.weaponId);
  const normalizedArmor = normalizeEquipmentEntry(state.armorId);
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
  const backgroundEntry = state.backgroundId ? getBackgroundCatalogEntry(state.backgroundId) : undefined;
  const backgroundGrantedFeatIds = uniqueEntries(backgroundEntry?.grantedFeatIds ?? []);
  const chosenFeatIds =
    state.featId && !backgroundGrantedFeatIds.includes(state.featId) ? [state.featId] : [];

  const buildInput: CharacterBuildInput = {
    meta: {
      rulesVersion: "5e-2014",
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
      generationMethod: "manual",
      base: {
        str: state.str,
        dex: state.dex,
        con: state.con,
        int: state.int,
        wis: state.wis,
        cha: state.cha,
      },
      final: {
        str: state.str,
        dex: state.dex,
        con: state.con,
        int: state.int,
        wis: state.wis,
        cha: state.cha,
      },
    },
    choices: {
      feats: chosenFeatIds,
      proficiencies: [...proficiencies, ...languages],
      spells: [...cantrips, ...leveledSpells],
      equipment: [state.weaponId, state.armorId, ...extraEquipment],
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
          ],
        spells: spellEntries,
        equipment: [
            normalizedWeapon,
            normalizedArmor,
            ...extraEquipment.map((entry) => normalizeEquipmentEntry(entry)),
        ],
          features: features.map((entry) => normalizeFeatureEntry(entry, state)),
      },
    },
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
