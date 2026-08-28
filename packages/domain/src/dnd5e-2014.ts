import { resolveClassId } from "@bertinis-vault/data-engine";
import type { AbilityId } from "@bertinis-vault/contracts";

export type SpellProgression = "full" | "half" | "pact" | "none";
export type SpellSelectionMode = "known" | "prepared" | "spellbook" | "none";
export type SpellSelectionProfile = {
  mode: SpellSelectionMode;
  cantripLimit: number;
  spellLimit: number;
};

export type SpellSlots = Record<string, number>;
export type SpellChoiceEntry = {
  label: string;
  level: number;
};
export type SpellPickerState = {
  mode: SpellSelectionMode;
  modeLabel: string;
  sectionTitle: string;
  maxSpellLevel: number;
  spellLimit: number;
  availableCantripCount: number;
  availableSpellCount: number;
  filteredSpellOptions: SpellChoiceEntry[];
};

const bardSpellsKnownByLevel: Record<number, number> = {
  1: 4, 2: 5, 3: 6, 4: 7, 5: 8, 6: 9, 7: 10, 8: 11, 9: 12, 10: 14,
  11: 15, 12: 15, 13: 16, 14: 18, 15: 19, 16: 19, 17: 20, 18: 22, 19: 22, 20: 22,
};

const sorcererSpellsKnownByLevel: Record<number, number> = {
  1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8, 8: 9, 9: 10, 10: 11,
  11: 12, 12: 12, 13: 13, 14: 13, 15: 14, 16: 14, 17: 15, 18: 15, 19: 15, 20: 15,
};

const warlockSpellsKnownByLevel: Record<number, number> = {
  1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8, 8: 9, 9: 10, 10: 10,
  11: 11, 12: 11, 13: 12, 14: 12, 15: 13, 16: 13, 17: 14, 18: 14, 19: 15, 20: 15,
};

const rangerSpellsKnownByLevel: Record<number, number> = {
  1: 0, 2: 2, 3: 3, 4: 3, 5: 4, 6: 4, 7: 5, 8: 5, 9: 6, 10: 6,
  11: 7, 12: 7, 13: 8, 14: 8, 15: 9, 16: 9, 17: 10, 18: 10, 19: 11, 20: 11,
};

export const spellAbilityByClassId: Partial<Record<string, AbilityId>> = {
  artificer: "int",
  bard: "cha",
  cleric: "wis",
  druid: "wis",
  paladin: "cha",
  ranger: "wis",
  sorcerer: "cha",
  warlock: "cha",
  wizard: "int",
};

export const hitDieByClassId: Partial<Record<string, number>> = {
  artificer: 8,
  barbarian: 12,
  bard: 8,
  cleric: 8,
  druid: 8,
  fighter: 10,
  monk: 8,
  paladin: 10,
  ranger: 10,
  rogue: 8,
  sorcerer: 6,
  warlock: 8,
  wizard: 6,
};

export const spellProgressionByClassId: Partial<Record<string, SpellProgression>> = {
  artificer: "half",
  bard: "full",
  cleric: "full",
  druid: "full",
  paladin: "half",
  ranger: "half",
  sorcerer: "full",
  warlock: "pact",
  wizard: "full",
  barbarian: "none",
  fighter: "none",
  monk: "none",
  rogue: "none",
};

export const spellSlotsFullCasterTable: Record<number, number[]> = {
  1: [2, 0, 0, 0, 0, 0, 0, 0, 0],
  2: [3, 0, 0, 0, 0, 0, 0, 0, 0],
  3: [4, 2, 0, 0, 0, 0, 0, 0, 0],
  4: [4, 3, 0, 0, 0, 0, 0, 0, 0],
  5: [4, 3, 2, 0, 0, 0, 0, 0, 0],
  6: [4, 3, 3, 0, 0, 0, 0, 0, 0],
  7: [4, 3, 3, 1, 0, 0, 0, 0, 0],
  8: [4, 3, 3, 2, 0, 0, 0, 0, 0],
  9: [4, 3, 3, 3, 1, 0, 0, 0, 0],
  10: [4, 3, 3, 3, 2, 0, 0, 0, 0],
  11: [4, 3, 3, 3, 2, 1, 0, 0, 0],
  12: [4, 3, 3, 3, 2, 1, 0, 0, 0],
  13: [4, 3, 3, 3, 2, 1, 1, 0, 0],
  14: [4, 3, 3, 3, 2, 1, 1, 0, 0],
  15: [4, 3, 3, 3, 2, 1, 1, 1, 0],
  16: [4, 3, 3, 3, 2, 1, 1, 1, 0],
  17: [4, 3, 3, 3, 2, 1, 1, 1, 1],
  18: [4, 3, 3, 3, 3, 1, 1, 1, 1],
  19: [4, 3, 3, 3, 3, 2, 1, 1, 1],
  20: [4, 3, 3, 3, 3, 2, 2, 1, 1],
};

export const warlockPactSlotCountByLevel: Record<number, number> = {
  1: 1,
  2: 2,
  3: 2,
  4: 2,
  5: 2,
  6: 2,
  7: 2,
  8: 2,
  9: 2,
  10: 2,
  11: 3,
  12: 3,
  13: 3,
  14: 3,
  15: 3,
  16: 3,
  17: 4,
  18: 4,
  19: 4,
  20: 4,
};

export const warlockPactSlotLevelByClassLevel: Record<number, number> = {
  1: 1,
  2: 1,
  3: 2,
  4: 2,
  5: 3,
  6: 3,
  7: 4,
  8: 4,
  9: 5,
  10: 5,
  11: 5,
  12: 5,
  13: 5,
  14: 5,
  15: 5,
  16: 5,
  17: 5,
  18: 5,
  19: 5,
  20: 5,
};

export function normalizeClassId(classId: string): string {
  return resolveClassId(classId);
}

export function getHitDieForClass(classId: string): number {
  return hitDieByClassId[normalizeClassId(classId)] ?? 8;
}

export function getSpellAbilityForClass(classId: string): AbilityId | undefined {
  return spellAbilityByClassId[normalizeClassId(classId)];
}

export function getSpellProgressionForClass(classId: string): SpellProgression {
  return spellProgressionByClassId[normalizeClassId(classId)] ?? "none";
}

export function getSpellSlotsForClassLevel(classId: string, level: number): Record<string, number> {
  const progression = getSpellProgressionForClass(classId);
  const slots: Record<string, number> = {};

  for (let slotLevel = 1; slotLevel <= 9; slotLevel += 1) {
    slots[`spell${slotLevel}`] = 0;
  }

  if (progression === "none") {
    return slots;
  }

  if (progression === "pact") {
    const pactSlots = warlockPactSlotCountByLevel[level] ?? 0;
    const pactLevel = warlockPactSlotLevelByClassLevel[level] ?? 0;
    slots[`spell${pactLevel}`] = pactSlots;
    return slots;
  }

  const effectiveLevel = progression === "half" ? Math.floor(level / 2) : level;
  const table = spellSlotsFullCasterTable[Math.max(effectiveLevel, 1)] ?? spellSlotsFullCasterTable[1] ?? [];

  table.forEach((count, index) => {
    slots[`spell${index + 1}`] = count;
  });

  return slots;
}

export function getMaxSpellLevelFromSlots(slots: SpellSlots): number {
  return Math.max(
    0,
    ...Object.entries(slots)
      .filter(([, count]) => count > 0)
      .map(([slotKey]) => Number.parseInt(slotKey.replace("spell", ""), 10))
      .filter((slotLevel) => Number.isFinite(slotLevel)),
  );
}

export function getSpellSelectionLimitForClassLevel(
  classId: string,
  level: number,
  spellcastingAbilityModifier = 0,
): number {
  const normalizedClassId = normalizeClassId(classId);

  switch (normalizedClassId) {
    case "bard":
      return bardSpellsKnownByLevel[level] ?? 0;
    case "sorcerer":
      return sorcererSpellsKnownByLevel[level] ?? 0;
    case "warlock":
      return warlockSpellsKnownByLevel[level] ?? 0;
    case "ranger":
      return rangerSpellsKnownByLevel[level] ?? 0;
    case "cleric":
    case "druid":
      return Math.max(level + spellcastingAbilityModifier, 1);
    case "wizard":
      return Math.max(6 + (Math.max(level, 1) - 1) * 2, 6);
    case "paladin":
      return level < 2 ? 0 : Math.max(Math.floor(level / 2) + spellcastingAbilityModifier, 1);
    case "artificer":
      return Math.max(Math.floor(level / 2) + spellcastingAbilityModifier, 1);
    default:
      return 0;
  }
}

export function getCantripSelectionLimitForClassLevel(classId: string, level: number): number {
  const normalizedClassId = normalizeClassId(classId);

  switch (normalizedClassId) {
    case "wizard":
    case "cleric":
    case "druid":
      return level >= 10 ? 5 : level >= 4 ? 4 : 3;
    case "bard":
      return level >= 10 ? 4 : level >= 4 ? 3 : 2;
    case "sorcerer":
      return level >= 10 ? 6 : level >= 4 ? 5 : 4;
    case "warlock":
      return level >= 10 ? 4 : level >= 4 ? 3 : 2;
    case "artificer":
      return level >= 14 ? 4 : level >= 10 ? 3 : 2;
    default:
      return 0;
  }
}

export function getSpellSelectionModeForClass(classId: string): SpellSelectionMode {
  const normalizedClassId = normalizeClassId(classId);

  switch (normalizedClassId) {
    case "bard":
    case "sorcerer":
    case "warlock":
    case "ranger":
      return "known";
    case "cleric":
    case "druid":
    case "paladin":
    case "artificer":
      return "prepared";
    case "wizard":
      return "spellbook";
    default:
      return "none";
  }
}

export function getSpellSelectionModeLabel(mode: SpellSelectionMode): string {
  switch (mode) {
    case "prepared":
      return "preparados";
    case "spellbook":
      return "libro";
    case "known":
      return "conocidos";
    default:
      return "spells";
  }
}

export function getSpellSelectionSectionTitle(mode: SpellSelectionMode): string {
  return mode === "spellbook" ? "Libro de spells" : "Spells";
}

export function formatSpellChoiceLabel(entry: SpellChoiceEntry): string {
  return `Nv${entry.level}: ${entry.label}`;
}

export function getAllowedSpellChoiceLabels(entries: SpellChoiceEntry[]): Set<string> {
  return new Set(entries.map((entry) => formatSpellChoiceLabel(entry)));
}

export function sanitizeSpellSelections(input: {
  selectedCantrips: string[];
  selectedSpells: string[];
  cantripLimit: number;
  spellLimit: number;
  allowedSpells: SpellChoiceEntry[];
}): { cantrips: string[]; spells: string[] } {
  const trimmedCantrips = input.selectedCantrips.slice(0, Math.max(input.cantripLimit, 0));
  const allowedSpellLabels = getAllowedSpellChoiceLabels(input.allowedSpells);
  const trimmedSpells = input.selectedSpells.filter((entry) => allowedSpellLabels.has(entry));
  const limitedSpells = trimmedSpells.slice(0, Math.max(input.spellLimit, 0));

  return {
    cantrips: trimmedCantrips,
    spells: limitedSpells,
  };
}

export function buildSpellPickerState(input: {
  slots: SpellSlots;
  profile: SpellSelectionProfile;
  cantripOptionCount: number;
  spellOptions: SpellChoiceEntry[];
  /**
   * The level a warlock's pact slots are worth.
   *
   * Pact magic is kept under its own key — `{ pact: 2 }` is two slots, not a
   * second-level one — so the level is not in the map at all and reading it as
   * one gives `NaN`. That left every warlock at a maximum spell level of zero
   * and a picker with nothing in it: cantrips arrived, and not one levelled
   * spell, at any level of the class.
   */
  pactSlotLevel?: number;
}): SpellPickerState {
  const maxSpellLevel = Math.max(
    getMaxSpellLevelFromSlots(input.slots),
    input.pactSlotLevel ?? 0,
  );
  const filteredSpellOptions = input.spellOptions.filter((entry) => entry.level <= maxSpellLevel);

  return {
    mode: input.profile.mode,
    modeLabel: getSpellSelectionModeLabel(input.profile.mode),
    sectionTitle: getSpellSelectionSectionTitle(input.profile.mode),
    maxSpellLevel,
    spellLimit: Math.min(input.profile.spellLimit, filteredSpellOptions.length),
    availableCantripCount: Math.min(input.profile.cantripLimit, input.cantripOptionCount),
    availableSpellCount: Math.min(input.profile.spellLimit, filteredSpellOptions.length),
    filteredSpellOptions,
  };
}

export function getSpellSelectionProfileForClassLevel(
  classId: string,
  level: number,
  spellcastingAbilityModifier = 0,
): SpellSelectionProfile {
  return {
    mode: getSpellSelectionModeForClass(classId),
    cantripLimit: getCantripSelectionLimitForClassLevel(classId, level),
    spellLimit: getSpellSelectionLimitForClassLevel(classId, level, spellcastingAbilityModifier),
  };
}
