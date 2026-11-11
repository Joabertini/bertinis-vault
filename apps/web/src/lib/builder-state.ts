/**
 * The draft, and how a stored one is read back.
 *
 * Split out of `builder.ts` so that opening the app does not cost the index.
 * The Gate needs the shape of a draft to know whether one is in progress; it
 * has no business waiting for 1.3MB of D&D to parse before it can paint a
 * title. Everything here is pure: shape checks and literals, no lookups.
 *
 * `builder.ts` re-exports all of it, so nothing that already imported from
 * there has to change.
 */

import { isCoverImage } from "@/lib/cover-image";
import type { AbilityBonusMap, ExpertiseAnswer, LevelChoice } from "@bertinis-vault/domain";

import { ABILITY_IDS, type AbilityId } from "./abilities";

/** Which edition's rules a draft is written against. */
export type BuilderRulesVersion = "5e-2014" | "5e-2024";

/** One class beyond the first. */
export type ExtraClass = {
  classId: string;
  subclassId: string;
  level: number;
};

/** A blank second class, for the moment a player asks for one. */
export function emptyExtraClass(): ExtraClass {
  return { classId: "", subclassId: "", level: 1 };
}

/**
 * The extras a draft carries, read defensively.
 *
 * Drafts saved before multiclassing existed have no field at all, and a draft
 * is a `localStorage` value the player could have edited. Anything that is not
 * a usable class is dropped rather than repaired: a half-written entry that
 * survives into the payload fails schema validation at the Ritual, far from
 * where the player could do anything about it.
 */
export function coerceExtraClasses(value: unknown): ExtraClass[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry): ExtraClass[] => {
    if (typeof entry !== "object" || entry === null) return [];
    const candidate = entry as Record<string, unknown>;
    const classId = typeof candidate.classId === "string" ? candidate.classId : "";
    if (!classId) return [];

    const level = typeof candidate.level === "number" ? Math.trunc(candidate.level) : 1;
    return [
      {
        classId,
        subclassId: typeof candidate.subclassId === "string" ? candidate.subclassId : "",
        level: Math.min(20, Math.max(1, level)),
      },
    ];
  });
}



/** How the player generated their raw scores. */
export type StatMethod = "manual" | "array" | "pointbuy" | "roll";

/** The schema's name for each generation method. */
export const generationMethodByStatMethod = {
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
  /**
   * Whether the table uses supplements (Tasha's, Xanathar's, Fizban's,
   * Eberron, Strixhaven...) or only the core books. For a 2024 character the
   * supplements include the older books too.
   */
  supplements: boolean;
  characterName: string;
  /**
   * The cover of this character's book, as a data URL, or "" for none.
   *
   * Kept small by `fitCoverImage` (the account store caps one character at
   * 128 KB). It is the shelf's cover and it also travels in the code as
   * `identity.portrait`, which the Foundry module makes the actor's portrait.
   */
  coverImage: string;
  playerName: string;
  alignment: string;
  raceId: string;
  subraceId: string;
  /**
   * Which size the player chose, for the species that offer two.
   *
   * Kept as the index's own letter — `"S"` or `"M"` — rather than the `dnd5e`
   * key, so checking that the answer is still legal is a lookup in the same
   * list the question was drawn from. Empty for the species that offer one,
   * which answer for themselves, and empty until the player answers.
   */
  sizeChoice: string;
  classId: string;
  subclassId: string;
  /**
   * The classes beyond the first.
   *
   * Empty for every character that has one class, which is nearly all of them.
   * `classId` above stays the first class, because the book gives the first
   * class the saving throws and the starting equipment and gives a second one
   * neither — see `classing.ts`.
   */
  extraClasses: ExtraClass[];
  /**
   * Whether the player rolled their hit points, and what they rolled.
   *
   * Both editions print two ways on every class page and a table picks one.
   * A builder that can only average puts a number on the sheet that nobody at
   * a rolling table ever rolled, and gives them nowhere to correct it.
   *
   * `hpRolls` is keyed by character level as a string — `"2"` is the roll for
   * level 2 — rather than by position in a list, so that inserting a class or
   * changing the level does not shift every number onto a different level.
   * Level 1 is not here: it is the die at maximum, which is not a roll.
   */
  hpMethod: "average" | "rolled";
  hpRolls: Record<string, number>;
  /**
   * The weapons this character has mastery with, as dnd5e base-item ids.
   *
   * 2024 only, and only five classes grant it. Kept as ids rather than names
   * because that is what Foundry reads — see `weapon-mastery.ts`.
   */
  weaponMasteryIds: string[];
  /**
   * What the player answered for each expertise grant, keyed by the grant.
   *
   * Keyed rather than listed because a rogue has two grants both named
   * "Expertise", at levels 1 and 6: a list would collapse them and spend the
   * second question's picks on the first.
   */
  expertiseChoices: Record<string, ExpertiseAnswer>;
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
   * The items the character is attuned to, by the id the bag stores.
   *
   * Three at a time in both editions, and which three is the player's answer:
   * a character who owns four attunement items owns four and uses three. Kept
   * as a list rather than derived from the bag, because "the first three
   * magical things you picked up" is not a rule.
   */
  attunedItemIds: string[];
  proficienciesText: string;
  languagesText: string;
  cantripsText: string;
  spellsText: string;
  /**
   * The wizard's book, as `"Nv1: Shield"` lines.
   *
   * Kept apart from `spellsText` because they answer different questions: the
   * book is what the wizard has written down, `spellsText` is what they
   * prepared out of it today. Empty for every other class, which has one list
   * and no book to keep it in.
   */
  spellbookText: string;
  /**
   * Which named alternative was chosen, per thing that offers one.
   *
   * Keyed by what asks — `"race"`, `"subclass:wizard"` — rather than by the
   * answer, so changing species does not carry an elf's lineage onto a
   * tiefling. In 2024 this is the lineage itself and not a spell detail: XPHB
   * ships no subraces, so an elf's Drow, High Elf and Wood Elf live nowhere
   * else in the data.
   */
  spellVariantChoices: Record<string, string>;
  /**
   * Which ability a grant's spells are cast with, per thing that offers a
   * choice of one.
   *
   * The 2024 species offer Intelligence, Wisdom or Charisma. It is not a
   * flavour question: dnd5e keeps the ability on the spell itself, and for a
   * fighter or a rogue it is the only thing that gives a species cantrip a
   * save DC — they have no spellcasting ability of their own to fall back on.
   */
  spellAbilityChoices: Record<string, string>;
  /**
   * The spells picked to answer a grant stated as a filter.
   *
   * "Two cantrips of your choice from that class's spell list". The filter
   * cannot be resolved for the player — choosing would put a spell on the
   * sheet they never picked — so it is a question, and these are the answers.
   */
  grantedSpellChoices: Record<string, string[]>;
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
  /**
   * What the character looks like, in dnd5e's own field names.
   *
   * Nine boxes the sheet already draws and nine keys `system.details` already
   * has, so what the player writes lands where the sheet reads it rather than
   * as prose inside the biography blob.
   *
   * Strings, all of them, including the age and the weight: that is how dnd5e
   * stores them, and a table that writes "Adulto" or "unos 90 kg" is writing
   * an answer the game accepts.
   */
  age: string;
  height: string;
  weight: string;
  eyes: string;
  hair: string;
  skin: string;
  gender: string;
  faith: string;
  appearance: string;
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
   * Whether this character uses Tasha's Customizing Your Origin.
   *
   * An **optional** rule, which is why it is a switch and not a behaviour. A
   * table that does not use it wants the dwarf's +2 Constitution exactly where
   * the book prints it; one that does wants to move it. The builder used to
   * apply the rule always and without its restriction, so it offered both a
   * distribution some tables forbid and shapes the rule itself forbids.
   *
   * 2014 only. 2024 moved the increase to the background and made it movable
   * by default, so there is nothing to opt into.
   */
  customOrigin: boolean;
  /**
   * What the character chose at each level that asked, keyed by that level.
   *
   * Keyed by level rather than held as a list because the question belongs to
   * the level: a fighter who drops from 14 to 12 should lose the answers they
   * gave at 14, and find them again if they go back up.
   */
  levelChoices: Record<string, LevelChoice>;
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
   * Which book each pick came from, keyed by `"<prop>:<id>"`.
   *
   * Only the picks whose name is not unique within the ruleset need it, but
   * recording it for every pick made through the index costs nothing and keeps
   * the draft resolvable if a later book adds a colliding name.
   */
  /**
   * Which lettered option was taken for each starting-equipment row, keyed by
   * the row's own key. Empty for a character built before the kit was
   * answerable, which reads as "nothing chosen yet" and is correct.
   */
  kitChoices: Record<string, string>;
  /**
   * The class and background the kit was last applied for, e.g.
   * `"wizard|acolyte|5e-2014"`.
   *
   * Granted rows land once per combination rather than on every render. Without
   * this an item the player deliberately removed would reappear on the next
   * keystroke, and a builder that argues with the player about their own bag is
   * one they stop trusting.
   */
  kitAppliedFor: string;
  sourceBooks: Record<string, string>;
};

export const initialState: BuilderState = {
  createdAt: new Date().toISOString(),
  rulesVersion: "5e-2014",
  supplements: true,
  statMethod: "manual",
  abilityBonuses: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
  customOrigin: false,
  levelChoices: {},
  optionalFeatureIds: [],
  featAbilityChoices: {},
  characterName: "Seraphina Vale",
  coverImage: "",
  playerName: "Martin",
  alignment: "Neutral Bueno",
  raceId: "human",
  subraceId: "",
  sizeChoice: "",
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
  attunedItemIds: [],
  proficienciesText: "Arcana\nInvestigation\nThieves' Tools",
  languagesText: "Common\nElvish\nDraconic",
  cantripsText: "Mage Hand\nPrestidigitation",
  spellsText: "Nv1: Shield\nNv1: Magic Missile\nNv2: Misty Step",
  spellbookText: "",
  spellVariantChoices: {},
  spellAbilityChoices: {},
  grantedSpellChoices: {},
  featuresText: "Arcane Recovery\nSculpt Spells",
  level: 3,
  extraClasses: [],
  hpMethod: "average",
  hpRolls: {},
  weaponMasteryIds: [],
  expertiseChoices: {},
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
  age: "",
  height: "",
  weight: "",
  eyes: "",
  hair: "",
  skin: "",
  gender: "",
  faith: "",
  appearance: "",
  kitChoices: {},
  kitAppliedFor: "",
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
    // Absent on every character saved before covers existed, which reads as
    // "no cover". Anything that is not a small image data URL is dropped so a
    // hand-edited or corrupted save cannot push a character past the limit.
    coverImage: isCoverImage(candidate.coverImage) ? candidate.coverImage : "",
    playerName: typeof candidate.playerName === "string" ? candidate.playerName : initialState.playerName,
    alignment: typeof candidate.alignment === "string" ? candidate.alignment : initialState.alignment,
    raceId: typeof candidate.raceId === "string" ? candidate.raceId : initialState.raceId,
    subraceId: typeof candidate.subraceId === "string" ? candidate.subraceId : initialState.subraceId,
    // Absent on every character saved before the question existed, and empty
    // is the right reading of that: they were never asked. `sizeFor` re-checks
    // the answer against what the species offers, so a stale one cannot stick.
    sizeChoice: typeof candidate.sizeChoice === "string" ? candidate.sizeChoice : "",
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
    // Same shape as sourceBooks: a key to a non-empty string.
    kitChoices: coerceSourceBooks(candidate.kitChoices),
    kitAppliedFor: typeof candidate.kitAppliedFor === "string" ? candidate.kitAppliedFor : "",
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
    spellbookText:
      typeof candidate.spellbookText === "string"
        ? candidate.spellbookText
        : initialState.spellbookText,
    spellVariantChoices: coerceVariantChoices(candidate.spellVariantChoices),
    spellAbilityChoices: coerceVariantChoices(candidate.spellAbilityChoices),
    grantedSpellChoices: coerceSpellChoices(candidate.grantedSpellChoices),
    featuresText:
      typeof candidate.featuresText === "string" ? candidate.featuresText : initialState.featuresText,
    level: typeof candidate.level === "number" ? candidate.level : initialState.level,
    extraClasses: coerceExtraClasses(candidate.extraClasses),
    expertiseChoices: coerceExpertiseChoices(candidate.expertiseChoices),
    // A blank is not a pick. It survives a `typeof` check and then matches no
    // weapon, so it reads on the page as a mastery the player cannot remove.
    weaponMasteryIds: Array.isArray(candidate.weaponMasteryIds)
      ? candidate.weaponMasteryIds.filter(
          (entry): entry is string => typeof entry === "string" && entry.length > 0,
        )
      : [],
    // Same reason: a blank id matches no item and reads on the page as an
    // attunement the player cannot undo.
    attunedItemIds: Array.isArray(candidate.attunedItemIds)
      ? candidate.attunedItemIds.filter(
          (entry): entry is string => typeof entry === "string" && entry.length > 0,
        )
      : [],
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
    // A draft saved before these existed simply has none of them.
    ...coerceAppearance(candidate),
    rulesVersion: candidate.rulesVersion === "5e-2024" ? "5e-2024" : "5e-2014",
    // A draft saved before the question existed had every book of its edition.
    supplements: typeof candidate.supplements === "boolean" ? candidate.supplements : true,
    statMethod: coerceStatMethod(candidate.statMethod),
    abilityBonuses: coerceAbilityBonuses(candidate.abilityBonuses),
    // A draft saved before the switch existed kept the printed spread or a
    // moved one; either way it opened with the rule on, so it stays on.
    customOrigin: typeof candidate.customOrigin === "boolean" ? candidate.customOrigin : true,
    levelChoices: coerceLevelChoices(candidate.levelChoices, legacy.asiPoints),
    // A draft saved before level-up picks existed simply has none.
    optionalFeatureIds: Array.isArray(candidate.optionalFeatureIds)
      ? candidate.optionalFeatureIds.filter((id): id is string => typeof id === "string" && id !== "")
      : [],
    featAbilityChoices: coerceFeatAbilityChoices(candidate.featAbilityChoices, candidate.levelChoices),
    sourceBooks: coerceSourceBooks(candidate.sourceBooks),
    // A draft saved before the switch existed took the average, and still does.
    hpMethod: candidate.hpMethod === "rolled" ? "rolled" : "average",
    hpRolls: coerceHpRolls(candidate.hpRolls),
  };
}

/**
 * What the player rolled, read defensively.
 *
 * A draft is a `localStorage` value the player could have edited by hand, and
 * a level with a nonsense number in it must not reach the rules layer as a
 * roll. Anything that is not a whole number between 1 and 12 — no die goes
 * higher — is dropped, and a dropped level takes the average, which is what a
 * level nobody has rolled yet does anyway.
 */
function coerceHpRolls(value: unknown): Record<string, number> {
  if (typeof value !== "object" || value === null) return {};

  const rolls: Record<string, number> = {};
  for (const [level, roll] of Object.entries(value as Record<string, unknown>)) {
    if (!/^\d+$/.test(level)) continue;
    if (typeof roll !== "number" || !Number.isInteger(roll) || roll < 1 || roll > 12) continue;
    rolls[level] = roll;
  }

  return rolls;
}

/** The nine description boxes, each read as a string or left empty. */
const APPEARANCE_KEYS = [
  "age",
  "height",
  "weight",
  "eyes",
  "hair",
  "skin",
  "gender",
  "faith",
  "appearance",
] as const;

function coerceAppearance(candidate: Record<string, unknown>): Pick<BuilderState, (typeof APPEARANCE_KEYS)[number]> {
  const read = (key: (typeof APPEARANCE_KEYS)[number]) =>
    typeof candidate[key] === "string" ? (candidate[key] as string) : "";

  return {
    age: read("age"),
    height: read("height"),
    weight: read("weight"),
    eyes: read("eyes"),
    hair: read("hair"),
    skin: read("skin"),
    gender: read("gender"),
    faith: read("faith"),
    appearance: read("appearance"),
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

function coerceLevelChoices(value: unknown, legacyPool: unknown): Record<string, LevelChoice> {
  if (!value || typeof value !== "object") {
    const pool = coerceAbilityBonuses(legacyPool);
    return Object.keys(pool).length > 0 ? { 4: { kind: "improvement", bonuses: pool } } : {};
  }

  const result: Record<string, LevelChoice> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    // A bare level is the first class's; `wizard:4` is another class's.
    const shape = /^(?:([a-z0-9-]+):)?(\d+)$/.exec(key);
    if (!shape || !raw || typeof raw !== "object") continue;
    const level = shape[1] ? `${shape[1]}:${Number(shape[2])}` : String(Number(shape[2]));

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

function coerceExpertiseChoices(value: unknown): Record<string, ExpertiseAnswer> {
  if (typeof value !== "object" || value === null) return {};

  const answers: Record<string, ExpertiseAnswer> = {};

  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry !== "object" || entry === null) continue;
    const candidate = entry as Record<string, unknown>;
    if (typeof candidate.setIndex !== "number") continue;

    const list = (of: unknown) =>
      Array.isArray(of) ? of.filter((item): item is string => typeof item === "string") : [];

    answers[key] = {
      setIndex: Math.max(0, Math.trunc(candidate.setIndex)),
      skills: list(candidate.skills),
      tools: list(candidate.tools),
    };
  }

  return answers;
}

/**
 * Variant answers from a stored draft, read defensively.
 *
 * A draft is a `localStorage` value the player could have edited by hand, and
 * an answer that is not a string would reach the grant reader as a shape it
 * does not check for. Anything that is not a plain answer is dropped: the
 * question simply reads as unanswered, which the Forge asks again.
 */
function coerceVariantChoices(value: unknown): Record<string, string> {
  if (typeof value !== "object" || value === null) return {};

  const answers: Record<string, string> = {};
  for (const [key, answer] of Object.entries(value as Record<string, unknown>)) {
    if (typeof answer === "string" && answer.length > 0) answers[key] = answer;
  }

  return answers;
}

/**
 * Filter answers from a stored draft, read defensively.
 *
 * Same reason as the rest: a draft is a `localStorage` value the player could
 * have edited. An answer that is not a list of names reads as unanswered,
 * which the Forge asks again.
 */
function coerceSpellChoices(value: unknown): Record<string, string[]> {
  if (typeof value !== "object" || value === null) return {};

  const answers: Record<string, string[]> = {};
  for (const [key, names] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(names)) continue;
    const clean = names.filter((name): name is string => typeof name === "string" && name.length > 0);
    if (clean.length) answers[key] = clean;
  }

  return answers;
}
