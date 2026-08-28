import type { CharacterBuild, CharacterBuildInput, ClassEntry } from "@bertinis-vault/contracts";
import { multiclassRequirementProblems, type ExpertiseAnswer } from "@bertinis-vault/domain";
import type { BuilderRulesVersion, BuilderState, ExtraClass, StatMethod } from "./builder-state";
import {
  abilityLabels,
  coerceBuilderState,
  generationMethodByStatMethod,
  initialState,
} from "./builder-state";

/*
 * The draft's shape and how a stored one is read back now live in
 * `builder-state.ts`, which imports no index. Re-exported here so every module
 * that already reached for them keeps working — and so the Gate can import the
 * state without dragging 1.3MB of D&D into the first paint.
 */
export type { BuilderRulesVersion, BuilderState, ExtraClass, StatMethod };
export { abilityLabels, coerceBuilderState, initialState };

import { characterLevel, classEntriesFor, classingLabel, coerceExtraClasses } from "./classing";
import { collapseGearLines } from "./gear-lines";
import { gearProficienciesFor } from "./gear-proficiencies";
import { speciesProficienciesFor } from "./species";
import { expertisePlanFor } from "./expertise";
import { foundrySizeFor } from "./table-numbers";
import { kitCopper, startingKitFor, takenOptions } from "./starting-kit";
import { masteryPlanFor } from "./weapon-mastery";
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
  type TakenFeat,
  savingThrowsForClass,
  suggestedAbilityBonuses,
  type AbilityBonusMap,
  type LevelChoice,
} from "@bertinis-vault/domain";
import {
  armorFormulaOf,
  featAbilityGrantsFor,
  featChoiceForBackground,
  itemInfoFor,
  slugOf,
} from "./index-options";


export function parseLineList(value: string) {
  return value
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function uniqueEntries(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

/**
 * An id for text the catalogs could not place.
 *
 * `slugifyId`, `resolveGearId` and `resolveSpellId` all end in the same
 * `[^a-z0-9]` squeeze, so anything written outside the Latin alphabet — a
 * feature named in Japanese, Cyrillic, Greek — slugs down to nothing, and the
 * canonical ids are `.min(1)`. That threw a ZodError straight through the
 * render: a blank screen, for typing a word in the wrong script.
 *
 * Dropping the entry would lose what the player wrote, so an id is synthesized
 * instead. It is derived from the text (FNV-1a), which makes it stable across
 * re-exports, and the label still carries the original characters.
 */
function fallbackId(entry: string): string {
  let hash = 0x811c9dc5;
  for (const char of entry) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return `custom-${hash.toString(16).padStart(8, "0")}`;
}

/** The resolved id, or a synthesized one when resolution came back empty. */
function idOrFallback(candidate: string | undefined, entry: string): string {
  return candidate?.trim() ? candidate : fallbackId(entry);
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

export function classifyProficiencyKind(entry: string) {
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
    itemId: idOrFallback(resolveGearId(entry), entry),
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
      featureId: `${subclassEntry.id}:${idOrFallback(slugifyId(entry), entry)}`,
      label: entry,
      source: "subclass" as const,
    };
  }

  if (backgroundEntry && normalizedLabel.includes(normalizeText(backgroundEntry.label))) {
    return {
      featureId: `${backgroundEntry.id}:${idOrFallback(slugifyId(entry), entry)}`,
      label: entry,
      source: "background" as const,
    };
  }

  return {
    featureId: idOrFallback(slugifyId(entry), entry),
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

/** The rules version of a draft, in the vocabulary the index speaks. */
function rulesVersionOf(state: BuilderState): "2014" | "2024" {
  return state.rulesVersion === "5e-2024" ? "2024" : "2014";
}

/**
 * Every class the character has, first one first.
 *
 * A row the player started and did not finish is not a class they have — it is
 * an empty select. Dropped here rather than repaired, so a half-filled row
 * never becomes a level-1 something the player did not choose.
 */
export function classesFor(state: BuilderState): ClassEntry[] {
  return classEntriesFor(
    { classId: state.classId, subclassId: state.subclassId, level: state.level },
    state.extraClasses.filter((extra) => extra.classId && extra.level >= 1),
    rulesVersionOf(state),
  );
}

/**
 * The character's level: every class's levels added up.
 *
 * The number the proficiency bonus and the improvement levels read. A fighter
 * 5 / wizard 3 is level 8 for both, not a level 5 fighter who also has spells.
 */
export function characterLevelFor(state: BuilderState): number {
  return characterLevel(
    state.level,
    state.extraClasses.filter((extra) => extra.classId && extra.level >= 1),
  );
}

/**
 * The classes this character has levels in but does not qualify for.
 *
 * Reported, never refused. A table that ignores the requirement is a table
 * that exists, and a warning the player can read beats a build they cannot
 * make. Read against the final scores, species bonuses included, because that
 * is what the book means by an ability score.
 */
export function unmetMulticlassRequirementsFor(state: BuilderState) {
  const scores = applyAbilityBonuses(
    { str: state.str, dex: state.dex, con: state.con, int: state.int, wis: state.wis, cha: state.cha },
    state.abilityBonuses,
    bonusesFromChoices(state.levelChoices),
    bonusesFromFeats(takenFeatsFor(state)),
  );

  return multiclassRequirementProblems({
    entries: classesFor(state).map((entry) => ({
      classId: entry.classId,
      level: entry.level,
      ...(entry.multiclassRequirements ? { multiclassRequirements: entry.multiclassRequirements } : {}),
    })),
    scores,
  });
}

/**
 * How the sheet names this character's classes.
 *
 * `labelOf` is passed in rather than looked up here so each surface keeps its
 * own catalog — the Codex and the Ritual resolve names differently, and the
 * one that matters is the one the player is already reading.
 */
export function classingLabelFor(
  state: BuilderState,
  labelOf: (classId: string) => string,
): string {
  return classingLabel(
    { classId: state.classId, level: state.level },
    state.extraClasses,
    labelOf,
  );
}

/**
 * Expertise answers from a stored draft, read defensively.
 *
 * A draft is a `localStorage` value the player could have edited, and a
 * half-formed answer here would reach `expertiseProblems` as a shape it does
 * not check for. Anything that is not a complete answer is dropped: the
 * question simply reads as unanswered, which is recoverable.
 */

export function buildCanonicalSnapshot(state: BuilderState): CharacterBuild {
  const cantrips = parseLineList(state.cantripsText).map((entry) => `Nv0: ${entry}`);
  const leveledSpells = parseLineList(state.spellsText);
  const features = parseLineList(state.featuresText);
  const extraEquipment = collapseGearLines(parseLineList(state.extraEquipmentText));
  /*
   * The coins the kit is worth, from the rows the character actually took.
   *
   * A player who takes the money instead of the gear picks an option with no
   * items on it: reading only what landed in the bag would find nothing and
   * give them neither the gear nor the money.
   */
  const startingCopper = kitCopper(
    takenOptions(
      startingKitFor(state.classId, state.backgroundId, rulesVersionOf(state)),
      state.kitChoices,
    ),
  );

  const expertiseTaken = expertisePlanFor(state, rulesVersionOf(state)).doubled;

  const masteryPlan = masteryPlanFor(
    classesFor(state).map((entry) => ({ classId: entry.classId, level: entry.level })),
    rulesVersionOf(state),
  );
  /*
   * Only what the character may actually have. Over-limit and unknown picks
   * are *also* reported to the player by `masteryProblemsFor`, which is the
   * half that matters: the payload staying honest is not a licence to let the
   * page stay quiet about a pick that did not travel.
   */
  const masteryIds = state.weaponMasteryIds
    .filter((id) => masteryPlan.options.some((option) => option.id === id))
    .slice(0, masteryPlan.count);
  /*
   * Weapon proficiencies no class document carries.
   *
   * Two kinds, and both are worked out here because this is where the weapon
   * table is. A rule the books print instead of a list — the 2024 rogue's
   * "martial weapons that have the Finesse or Light property" — is expanded,
   * because Foundry has nowhere to store a sentence. And the ones the *species*
   * grants: a dwarf swings a warhammer at their proficiency bonus whatever
   * class they took, and the class document that Plutonium imports has no
   * reason to know that.
   */
  const speciesGrant = state.raceId
    ? speciesProficienciesFor(state.raceId, state.subraceId, rulesVersionOf(state))
    : null;
  const gearProficiencies = state.classId
    ? gearProficienciesFor(
        classesFor(state),
        rulesVersionOf(state),
        speciesGrant ? { id: state.raceId, ...speciesGrant } : null,
      )
    : null;
  const extraWeaponIds = gearProficiencies
    ? [
        ...gearProficiencies.clauseWeaponIds,
        ...gearProficiencies.speciesWeaponIds.filter(
          (id) => !gearProficiencies.clauseWeaponIds.includes(id),
        ),
      ]
    : [];
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
    const spellId = idOrFallback(resolveSpellId(entry.label), entry.label);
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
      ...(foundrySizeFor(state, rulesVersionOf(state))
        ? { size: foundrySizeFor(state, rulesVersionOf(state))! }
        : {}),
      raceId: state.raceId,
      ...(state.subraceId ? { subraceId: state.subraceId } : {}),
    },
    classing: {
      // First class first: everything downstream that asks for "the" class of
      // a character reads `classes[0]`, and for a multiclass character that is
      // the one the rules actually privilege.
      classes: classesFor(state),
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
      // The objects to resolve, once each — how many of each is `normalized`'s
      // job, and asking the catalogs for the same arrow twenty times resolves
      // to the same arrow twenty times.
      equipment: [
        state.weaponId,
        state.armorId,
        ...extraEquipment.map((entry) => entry.id),
      ].filter(Boolean),
      features,
        // Only what the character may actually have: a draft that kept a
      // mastery from a class the player has since left would export a
      // proficiency the sheet never granted.
      ...(masteryIds.length > 0 ? { weaponMasteries: masteryIds } : {}),
      ...(extraWeaponIds.length > 0 ? { weaponProficiencies: extraWeaponIds } : {}),
      ...(startingCopper > 0 ? { startingCopper } : {}),
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
            /*
             * Expertise travels beside the proficiency it doubles, never
             * instead of it: a skill written only as expertise is a skill the
             * character is not recorded as proficient in. The entries above
             * already carry the proficiency; these add the doubling.
             */
            ...expertiseTaken.skills.map((entry) => ({
              kind: "expertise" as const,
              label: entry,
            })),
            ...expertiseTaken.tools.map((entry) => ({
              kind: "toolExpertise" as const,
              label: entry,
            })),
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
        // Both weapon and armour are optional — a wizard may carry neither.
        // An unguarded entry here normalizes to `itemId: ""`, which the
        // schema rejects outright, so skipping the Gear chamber used to throw
        // rather than produce an unarmed character.
        equipment: [
            ...(state.weaponId ? [normalizedWeapon] : []),
            ...(state.armorId ? [normalizedArmor] : []),
            ...extraEquipment.map((entry) => normalizeEquipmentEntry(entry.id, entry.quantity)),
        ],
          features: features.map((entry) => normalizeFeatureEntry(entry, state)),
          /*
           * Unarmored Defense and its relatives, which the contract started
           * asking for on 2026-08-26.
           *
           * Empty is the honest value today: no chamber offers the choice
           * between "10 + DEX + CON" and a worn breastplate, so claiming an
           * alternative armour class here would put a number on the sheet the
           * player never picked. The index does carry `armorClass` rows for
           * the barbarian, the monk and five species, so this is wiring that
           * is missing rather than data that is.
           */
          armorClassOptions: [],
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
