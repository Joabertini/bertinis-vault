/**
 * Everything the printed sheets ask for, gathered once.
 *
 * There are two sheets — the 2014 one and the 2024 one — and they ask for
 * mostly the same facts in a different arrangement. Gathering here means the
 * two layouts are layouts: neither derives anything, so they cannot come to
 * different numbers for the same character, which is the failure a second
 * sheet invites.
 *
 * Nothing is computed that the build already carries. The derived block is the
 * same object the Foundry export sends.
 */

import type { CharacterBuild } from "@bertinis-vault/contracts";
import type { RulesVersion } from "@bertinis-vault/vetools-ref";

import { ABILITY_IDS, abilityLabels, type AbilityId } from "./abilities";
import { characterLevelFor, classesFor, classingLabelFor } from "./builder";
import type { BuilderState } from "./builder";
import { entryById, hitDieFor } from "./catalog";
import { savingThrowChecksFor, skillChecksFor, type Check } from "./checks";
import { featIdsFor } from "./feats";
import { gearProficienciesFor, type GearProficiencies } from "./gear-proficiencies";
import { featGearGrantsFor } from "./index-options";
import { attackLinesFor, type AttackLine } from "./sheet-attacks";
import { speciesProficienciesFor, speciesTraitsFor } from "./species";
import {
  initiativeFor,
  passivePerceptionFor,
  sensesFor,
  sizeLabelFor,
  speedFor,
} from "./table-numbers";

/** The skills each ability owns, in the order the 2024 sheet prints them. */
export const SKILLS_BY_ABILITY: Record<AbilityId, string[]> = {
  str: ["athletics"],
  dex: ["acrobatics", "sleight of hand", "stealth"],
  con: [],
  int: ["arcana", "history", "investigation", "nature", "religion"],
  wis: ["animal handling", "insight", "medicine", "perception", "survival"],
  cha: ["deception", "intimidation", "performance", "persuasion"],
};

export type CoinPurse = { cp: number; sp: number; ep: number; gp: number; pp: number };

/**
 * The purse, from the copper the build carries.
 *
 * The sheets print five boxes and the build stores one number, so the split is
 * made here rather than in five places. Silver, electrum and platinum stay at
 * zero: the builder has never had a way to hold them, and inventing a
 * conversion would put coins on the sheet nobody was given.
 */
export function purseFrom(copper: number): CoinPurse {
  const gp = Math.floor(Math.max(copper, 0) / 100);
  return { cp: Math.max(copper, 0) - gp * 100, sp: 0, ep: 0, gp, pp: 0 };
}

export type SheetAbility = {
  id: AbilityId;
  label: string;
  score: number;
  modifier: number;
  save: Check;
  skills: Check[];
};

export type SheetData = {
  rulesVersion: RulesVersion;
  /** Header, as the sheets label it. */
  characterName: string;
  playerName: string;
  classLine: string;
  subclassLabel: string;
  speciesLabel: string;
  backgroundLabel: string;
  alignment: string;
  level: number;
  sizeLabel: string;

  abilities: SheetAbility[];
  proficiencyBonus: number;
  passivePerception: number;
  initiative: number;
  speed: number | null;
  armorClass: number;
  hitPoints: number;
  hitDie: number | null;
  darkvision: number | null;

  attacks: AttackLine[];
  equipment: Array<{ label: string; quantity: number }>;
  purse: CoinPurse;
  attunedCount: number;

  /** Boxes the 2024 sheet prints as a checklist. */
  armorTraining: { light: boolean; medium: boolean; heavy: boolean; shields: boolean };
  weaponProficiencies: string[];
  toolProficiencies: string[];
  languages: string[];

  classFeatures: string[];
  speciesTraits: string[];
  feats: string[];
  backgroundFeatures: string[];

  spellcasting: CharacterBuild["derived"]["spellcasting"];
  spellsByLevel: Array<{ level: number; spells: Array<{ label: string; prepared: boolean }> }>;

  personality: { trait: string; ideal: string; bond: string; flaw: string };
  appearance: Array<{ label: string; value: string }>;
  backstory: string;
};

/** The armour categories `dnd5e` checks, as the sheets name them. */
function armorTrainingOf(proficiencies: GearProficiencies | null) {
  const ids = proficiencies?.foundryArmorIds ?? [];
  return {
    light: ids.includes("lgt"),
    medium: ids.includes("med"),
    heavy: ids.includes("hvy"),
    shields: ids.includes("shl"),
  };
}

export function sheetDataFor(
  state: BuilderState,
  build: CharacterBuild,
  rulesVersion: RulesVersion,
): SheetData {
  const normalized = build.choices.normalized;
  const proficiencyEntries = normalized?.proficiencies ?? [];

  const classEntries = state.classId ? classesFor(state) : [];
  const speciesGrant = state.raceId
    ? speciesProficienciesFor(state.raceId, state.subraceId, rulesVersion, state.sourceBooks)
    : null;
  const gearProficiencies = classEntries.length
    ? gearProficienciesFor(
        classEntries,
        rulesVersion,
        speciesGrant ? { id: state.raceId, ...speciesGrant } : null,
        featGearGrantsFor(featIdsFor(state), rulesVersion),
      )
    : null;

  const saves = savingThrowChecksFor(build);
  const skills = skillChecksFor(build);
  const saveByAbility = new Map(saves.map((check) => [check.ability, check]));

  const abilities: SheetAbility[] = ABILITY_IDS.map((id) => {
    const score = build.abilities.final[id];
    return {
      id,
      label: abilityLabels[id],
      score,
      modifier: Math.floor((score - 10) / 2),
      save: saveByAbility.get(id) ?? {
        name: id,
        ability: id,
        modifier: Math.floor((score - 10) / 2),
        proficient: false,
        expert: false,
      },
      skills: skills.filter((check) => check.ability === id),
    };
  });

  const features = normalized?.features ?? [];
  const equipment = normalized?.equipment ?? [];

  const spellsByLevel: SheetData["spellsByLevel"] = [];
  for (const spell of normalized?.spells ?? []) {
    let bucket = spellsByLevel.find((entry) => entry.level === spell.level);
    if (!bucket) {
      bucket = { level: spell.level, spells: [] };
      spellsByLevel.push(bucket);
    }
    // The sheet's circle means "prepared today". A wizard's book carries spells
    // that are on the character and not prepared, and those are the only ones
    // the build marks — see `normalizedSpellEntrySchema`.
    bucket.spells.push({ label: spell.label, prepared: spell.preparation !== "unprepared" });
  }
  spellsByLevel.sort((a, b) => a.level - b.level);
  for (const bucket of spellsByLevel) bucket.spells.sort((a, b) => a.label.localeCompare(b.label));

  const appearance = (
    [
      ["Edad", state.age],
      ["Altura", state.height],
      ["Peso", state.weight],
      ["Ojos", state.eyes],
      ["Pelo", state.hair],
      ["Piel", state.skin],
      ["Genero", state.gender],
      ["Fe", state.faith],
    ] as const
  )
    .filter(([, value]) => value.trim())
    .map(([label, value]) => ({ label, value }));

  return {
    rulesVersion,
    characterName: state.characterName,
    playerName: state.playerName,
    classLine: classingLabelFor(
      state,
      (classId) => entryById("class", rulesVersion, classId)?.label ?? classId,
    ),
    subclassLabel:
      entryById("subclass", rulesVersion, state.subclassId, state.sourceBooks[`subclass:${state.subclassId}`])
        ?.label ?? "",
    speciesLabel:
      entryById("race", rulesVersion, state.raceId, state.sourceBooks[`race:${state.raceId}`])?.label ?? "",
    backgroundLabel:
      entryById(
        "background",
        rulesVersion,
        state.backgroundId,
        state.sourceBooks[`background:${state.backgroundId}`],
      )?.label ?? "",
    alignment: state.alignment,
    level: characterLevelFor(state),
    sizeLabel: sizeLabelFor(state, rulesVersion) ?? "",

    abilities,
    proficiencyBonus: build.derived.proficiencyBonus,
    passivePerception: passivePerceptionFor(build),
    initiative: initiativeFor(build),
    speed: speedFor(state, rulesVersion),
    armorClass: build.derived.ac,
    hitPoints: build.derived.hp,
    hitDie: state.classId ? hitDieFor(state.classId, rulesVersion) : null,
    darkvision: sensesFor(state, rulesVersion)?.darkvision ?? null,

    attacks: attackLinesFor(build, rulesVersion, gearProficiencies, state.weaponMasteryIds),
    equipment: equipment
      .filter((entry) => entry.category !== "weapon")
      .map((entry) => ({ label: entry.label, quantity: entry.quantity })),
    purse: purseFrom(build.choices.startingCopper ?? 0),
    attunedCount: equipment.filter((entry) => entry.attuned).length,

    armorTraining: armorTrainingOf(gearProficiencies),
    weaponProficiencies: (gearProficiencies?.weapons ?? []).map((line) => line.label),
    toolProficiencies: proficiencyEntries
      .filter((entry) => entry.kind === "tool")
      .map((entry) => entry.label),
    languages: proficiencyEntries
      .filter((entry) => entry.kind === "language")
      .map((entry) => entry.label),

    classFeatures: features
      .filter((entry) => entry.source === "class" || entry.source === "subclass")
      .map((entry) => entry.label),
    speciesTraits: state.raceId
      ? speciesTraitsFor(state.raceId, state.subraceId, rulesVersion, state.sourceBooks)
      : [],
    feats: features.filter((entry) => entry.source === "feat").map((entry) => entry.label),
    backgroundFeatures: features
      .filter((entry) => entry.source === "background")
      .map((entry) => entry.label),

    spellcasting: build.derived.spellcasting,
    spellsByLevel,

    personality: {
      trait: state.trait,
      ideal: state.ideal,
      bond: state.bond,
      flaw: state.flaw,
    },
    appearance,
    backstory: [state.appearance, state.notes].filter((entry) => entry.trim()).join("\n\n"),
  };
}

/** `"+5"` — a modifier is read with its sign or it is read as a total. */
export function signed(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}
