/**
 * The browsing index the web builder queries.
 *
 * Rows carry only what a picker needs to list, search and filter. Opening a
 * single entity is a separate, lazy concern: the full text of every category
 * is roughly twenty times this size, and the player only ever reads one entry
 * at a time.
 *
 * Rows are data, not references. Call `refOf` to turn a chosen row into the
 * `{page, source, hash}` triple Plutonium imports.
 */

import {
  buildRef,
  buildSubclassRef,
  isSourceAllowed,
  rulesVersionOf,
  type RulesVersion,
  type VetoolsProp,
  type VetoolsRef,
} from "@bertinis-vault/vetools-ref";

/** Fields every indexed row carries. */
export type IndexRow = {
  name: string;
  source: string;
};

export type SpellRow = IndexRow & {
  level: number;
  school: string;
  time: string | null;
  /** A printable distance, e.g. "120 feet", "self", "touch". */
  range: string | null;
  /** Flattened component flags, e.g. "vsm". */
  components: string;
  concentration: 0 | 1;
  ritual: 0 | 1;
  /**
   * The class lists this spell is on, as `"Wizard|PHB"`.
   *
   * A spell belongs to a class list by the class's say-so, not its own, and
   * the class's source keeps the editions apart: Fire Bolt is on both
   * `Wizard|PHB` and `Wizard|XPHB`, which are different documents.
   */
  classes: string[];
};

export type ItemRow = IndexRow & {
  type: string | null;
  rarity: string | null;
  weight: number | null;
  value: number | null;
  attunement: 0 | 1;
  damage: string | null;
  damageType: string | null;
  versatileDamage: string | null;
  /** Property codes, e.g. "V", "F", "2H". */
  properties: string[];
  /**
   * "simple" or "martial". Null for everything that is not a weapon.
   *
   * `type` says melee or ranged and nothing about the category, so this is the
   * only way to answer "which martial weapons have the Light property" — the
   * shape the 2024 monk's and rogue's proficiencies are printed in.
   */
  weaponCategory: string | null;
  /** 2024 weapon mastery names, e.g. "Topple". Null for everything else. */
  mastery: string[] | null;
  /**
   * Mastery properties this weapon grants for free.
   *
   * One weapon in the game has one: the Psychic Blade's Vex does not count
   * against the number of properties a character may use. Null everywhere else.
   */
  masteryFree: string[] | null;
  /** Base armour class, for armour and shields. */
  ac: number | null;
  /** Minimum Strength the armour asks for, as a string of digits. */
  strength: string | null;
  stealthDisadvantage: 0 | 1;
};

export type AbilityBonuses = Record<string, number>;

/**
 * How far a species moves, in every way it moves.
 *
 * `walk` is the one every character has. The rest are the reason someone picks
 * the species: an Aarakocra flies 50 feet, a Sea Elf swims 30. 5etools writes
 * "as fast as you walk" as `true`; the number is resolved before it lands here.
 */
export type SpeedMap = {
  walk?: number;
  burrow?: number;
  climb?: number;
  fly?: number;
  swim?: number;
};

/**
 * The armour and weapons a species grants, on top of what a class grants.
 *
 * A dwarf is proficient with the battleaxe, the handaxe, the light hammer and
 * the warhammer whatever they take levels in. Split the same three ways as a
 * class's, because two species state theirs as a rule rather than a list.
 */
export type SpeciesProficiencies = {
  /** "light", "medium". */
  armor: string[];
  /** Weapon names as the books print them, e.g. "light hammer". */
  weaponItems: string[];
  /** "Firearms", "Choose 2 martial weapons". */
  weaponClauses: string[];
};

export type RaceRow = IndexRow & {
  size: string | null;
  /** The fixed part of the species bonus. Null when the player chooses it. */
  ability: AbilityBonuses | null;
  speed: number | null;
  speeds: SpeedMap | null;
  /**
   * How far this species sees in the dark, in feet.
   *
   * Null for the ones that see no better than a human. A number here is not a
   * detail: it decides whether the party needs a torch, and a torch decides
   * whether anything can see the party.
   */
  darkvision: number | null;
  /** Rarer than darkvision, and not the same thing: sight without light. */
  blindsight: number | null;
  /**
   * What this species can do, by name — "Stonecunning", "Breath Weapon".
   *
   * Names only: the full text of every trait is roughly twenty times this
   * index, and it is what the reference import already brings across. The
   * headings every species page repeats (Size, Age, Languages, Darkvision) are
   * left out, because the sheet answers each of them somewhere better.
   */
  traits: string[];
  speciesProficiencies: SpeciesProficiencies | null;
  /** Natural armour: a tortle shell, lizardfolk scales, a loxodon hide. */
  armorClass: ArmorClassOption[];
};

/**
 * A subrace states only what it changes.
 *
 * Null means "whatever the race said", never "nothing": the hill dwarf prints
 * no speed because it walks at the dwarf's 25, while the wood elf prints 35
 * because it does not walk at the elf's 30.
 */
export type SubraceRow = IndexRow & {
  raceName: string;
  raceSource: string;
  ability: AbilityBonuses | null;
  speed: number | null;
  speeds: SpeedMap | null;
  darkvision: number | null;
  blindsight: number | null;
  /** A subrace *adds* traits: a hill dwarf is a dwarf that is also tough. */
  traits: string[];
  speciesProficiencies: SpeciesProficiencies | null;
};

/**
 * The ability increase a feat carries.
 *
 * A fixed grant names the ability outright. A choice offers a pool: `count`
 * different abilities from `from`, each raised by `amount`. Both default to
 * one, which covers the ordinary half-feat — "+1 to Intelligence, Wisdom or
 * Charisma".
 */
export type FeatAbilityGrant =
  | { kind: "fixed"; bonuses: AbilityBonuses }
  | { kind: "choice"; from: string[]; amount: number; count: number };

/** One way to qualify for a feat. Every field present must hold at once. */
export type FeatPrerequisite = {
  /** Alternatives in their own right: [{int:13},{wis:13}] is "either". */
  abilities?: Record<string, number>[];
  /** Character level. */
  level?: number;
  /** A level in a named class, which is not the character's level. */
  classLevel?: { className: string; level: number };
  races?: { name: string; subrace?: string }[];
  backgrounds?: string[];
  feats?: string[];
  /** A feature by name — "Fighting Style", "Spellcasting or Pact Magic". */
  features?: string[];
  proficiencies?: { kind: string; value: string }[];
  /** The character must cast. Three fields in the data mean this one thing. */
  spellcasting?: boolean;
  /** Stated in the books and not checkable here. Shown, never tested. */
  other?: string[];
};

export type FeatRow = IndexRow & {
  /**
   * What taking this feat raises. Empty for the 116 that raise nothing.
   *
   * This is half of why a half-feat is worth taking: on an odd score it buys
   * the effect *and* the modifier point a plain improvement would have bought.
   * Nothing recorded it until now, so it was being lost in silence.
   */
  ability: FeatAbilityGrant[];
  /**
   * Whether this feat *is* the ability score improvement.
   *
   * 2024 folded the improvement into the feat list, so "raise two scores" and
   * "take a feat" stopped being alternatives — the former is a feat named
   * "Ability Score Improvement". Its own increase is not a half-feat's bonus
   * and is not in `ability`, because asking for it would ask the same question
   * twice.
   */
  isAbilityScoreImprovement: 0 | 1;
  /**
   * What a character must already have before this feat is legal.
   *
   * A list of *alternatives*: satisfying any one is enough, and every field
   * inside one must hold. 205 of the 276 feats state something and nothing
   * read any of it, so the builder offered Heavily Armored to a wizard.
   *
   * Half of what the books state cannot be checked against a build — a
   * campaign setting, a dragonmark category — and that half arrives in
   * `other` as text, to show rather than to test.
   */
  prerequisites: FeatPrerequisite[];
  /**
   * Proficiencies this feat doubles. Empty for all but seven.
   *
   * Skill Expert is the one worth naming: it grants a skill proficiency and
   * expertise in a skill you are proficient in, and the skill it just granted
   * counts, so the two halves are read in order.
   */
  expertise: ExpertiseSet[];
};

/** One feat a background offers, already scoped to the book it comes from. */
export type FeatOption = {
  name: string;
  source: string;
  /**
   * A sub-choice the background already made, e.g. Magic Initiate's spell
   * list. Part of the label, not of the reference.
   */
  qualifier?: string;
};

/**
 * The feat a background grants, as a single choice.
 *
 * One option is a feat the background simply gives. Several are alternatives —
 * Ruined offers Alert, Skilled or Tough. `isOpen` means the background also
 * allows a feat it does not name, so the whole feat list is fair game.
 */
export type FeatChoice = {
  options: FeatOption[];
  isOpen?: boolean;
};

/**
 * A bounded skill pick: choose `count` from `options`.
 *
 * `isOpen` means the source names no shortlist — "any 3 skills" — in which
 * case `options` is already every skill rather than an empty list a caller
 * would have to special-case. It is kept only so the UI can say "any skill"
 * instead of naming all eighteen.
 */
export type SkillChoice = {
  options: string[];
  count: number;
  isOpen?: boolean;
};

export type BackgroundRow = IndexRow & {
  /** Null for the 2014 backgrounds, none of which grant a feat. */
  featChoice: FeatChoice | null;
  /** Skills the background grants outright, with no choice involved. */
  skillsGranted: string[];
  /**
   * A bounded skill choice stacked on top of `skillsGranted`, if the
   * background offers one (a handful of SCAG backgrounds grant one skill
   * outright and a choice of a second).
   */
  skillChoice: SkillChoice | null;
  /**
   * Tools the background grants outright.
   *
   * Category-scoped grants ("any gaming set", "any musical instrument") are
   * not included: they are already a player choice with no single name to
   * pre-fill, and the free-text proficiency field takes whatever is typed.
   */
  toolsGranted: string[];
  /**
   * What the background hands over, structured rather than as prose.
   *
   * Null for the 2014 backgrounds that state their equipment only in a
   * sentence, and for the handful that state none at all.
   */
  startingEquipment: StartingEquipment | null;
  /**
   * The ability increase this background grants, as alternatives.
   *
   * A 2024 rule: 2014 put the increase on the species, and 2024 moved it to
   * the background — so a 2024 species grants none, and a builder that reads
   * only the species leaves the character three points short. Null for every
   * 2014 background.
   */
  abilityChoice: AbilityChoice[] | null;
};

/**
 * One way to spend a background's ability increase.
 *
 * `amounts` is positional: [2, 1] means two abilities out of `options` get
 * +2 and +1, and [1, 1, 1] means all three get +1. How much is the rule; which
 * abilities is the player's answer.
 */
export type AbilityChoice = {
  options: string[];
  amounts: number[];
};

/**
 * A choice a class makes the player answer as it levels.
 *
 * Fighting styles, eldritch invocations, metamagic, maneuvers, runes, arcane
 * shots, elemental disciplines, artificer infusions and the pact boon are all
 * this shape: a pool named by `featureType`, and a count that grows with level.
 *
 * It comes from the class's own `optionalfeatureProgression`, which is why the
 * editions need no rule to keep apart — the 2024 sorcerer's metamagic
 * progression differs from the 2014 one, and the 2024 paladin has no fighting
 * style because fighting styles became feats, which appears here as the entry
 * simply not existing.
 */
export type OptionalFeatureProgression = {
  /** What the class calls it, e.g. "Eldritch Invocations". */
  name: string;
  /** The pools it draws from, e.g. `["EI"]`. */
  featureType: string[];
  /**
   * How many are known at each level, from 1 to 20, as a running total.
   *
   * 5etools states this as a sparse object for most classes and a dense array
   * for the warlock and the artificer. Both arrive here as the same 20 numbers.
   */
  countByLevel: number[];
};

/**
 * One way of taking an expertise grant.
 *
 * A grant offers a list of these as *alternatives*: the 2014 rogue's is "two
 * skills" or "one skill and thieves' tools", and the wizard's Scholar is six
 * sets of one fixed skill, which is how the data says "pick one of six".
 *
 * `anySkill` and `anyTool` draw from what the character is *already*
 * proficient in — expertise doubles a proficiency, it does not grant one — so
 * the pool cannot be listed here and depends on the build.
 */
export type ExpertiseSet = {
  /** How many already-proficient skills this set lets you double. */
  anySkill: number;
  /** How many already-proficient tools this set lets you double. */
  anyTool: number;
  /** Skills this set doubles outright, by canonical name. */
  skills: string[];
  /** Tools this set doubles outright, by name. */
  tools: string[];
};

/**
 * A way of computing armour class that replaces the default 10 + Dexterity.
 *
 * Unarmored Defense, draconic scales, a tortle's shell. Read from the feature
 * text, because for the barbarian, the monk and the 2024 dancing bard there is
 * nowhere else: 5etools' Foundry companion file records an `ac.calc` override
 * for the sorcerer and six species and nothing for those three, which rely on
 * the game system's own SRD class items.
 */
export type ArmorClassOption = {
  name: string;
  source: string;
  level: number;
  isVariant: boolean;
  /** 10 for Unarmored Defense, 13 for draconic scales, 17 for a shell. */
  base: number;
  /** What is added on top, in the order the feature names them. */
  abilities: string[];
  /** A monk loses this while holding a shield; a barbarian does not. */
  allowsShield: boolean;
  requiresNoArmor: boolean;
  /** What `dnd5e` calls the calculation, when it has a name for it. */
  calc: string | null;
};

/** An expertise grant, and the feature that hands it out. */
export type ExpertiseGrant = {
  name: string;
  source: string;
  level: number;
  /**
   * Whether the feature is an optional replacement rather than a given.
   *
   * Deft Explorer is Tasha's replacement for the 2014 ranger's Natural
   * Explorer. A ranger who did not take the option does not get its expertise,
   * so a builder that applied every grant would hand out a doubled skill the
   * character never chose.
   */
  isVariant: boolean;
  /** The alternatives on offer. One set with no `any` is not a choice at all. */
  sets: ExpertiseSet[];
};

/** What a second class hands over, which is less than a first one does. */
/**
 * The armour and weapons a class grants a character who takes it first.
 *
 * Weapons come in three shapes because the books write them three ways, and
 * flattening them would lose the difference: a category is a checkbox, a named
 * weapon is a checkbox, and a rule is a sentence nothing can check.
 */
export type StartingProficiencies = {
  /** "light", "medium", "heavy", "shield". */
  armor: string[];
  /** Whole categories: "simple", "martial". */
  weapons: string[];
  /** Named weapons — the 2014 druid's ten, the bard's four. */
  weaponItems: string[];
  /** "Martial weapons that have the Light property", and its like. */
  weaponClauses: string[];
};

export type MulticlassGrants = {
  /** "light", "medium", "shield". */
  armor: string[];
  /** "simple", "martial", or a named weapon — the 2014 monk gets shortswords. */
  weapons: string[];
  /** One skill from a shortlist, for the four classes that offer one. */
  skillChoice: SkillChoice | null;
  /** Tools granted outright, by name. */
  tools: string[];
  /** A category to choose a tool from, e.g. "Musical Instrument". */
  toolChoice: string | null;
};

/**
 * One thing a starting-equipment option hands over.
 *
 * Five kinds, and the awkward ones are the last three. A category is "any
 * simple weapon" — a choice inside a choice. Coins are how 2024 states "take
 * the money instead", counted in copper because that is what the data counts
 * in. A special is something with no item entry to point at, like the wizard's
 * spellbook.
 */
export type EquipmentEntry =
  | {
      kind: "item";
      /** The item's name as the item index knows it, lower case. */
      name: string;
      /** The book it comes from, or null when the data names none. */
      source: string | null;
      /** Absent when it is one, which is nearly always. */
      quantity?: number;
      /** "Book (Prayers)" for a plain book, when the data renames it. */
      displayName?: string;
    }
  | { kind: "category"; categories: string[]; quantity?: number }
  | { kind: "coins"; copper: number }
  | { kind: "special"; label: string; quantity?: number };

/** One row of a starting-equipment list: a grant, or a choice between letters. */
export type EquipmentRow = {
  /** True when everything in the row is granted rather than chosen between. */
  fixed: boolean;
  /** The alternatives, keyed as the books letter them: a/b/c, or A/B in 2024. */
  options: { key: string; entries: EquipmentEntry[] }[];
};

/** What a class or a background hands a character at level one. */
export type StartingEquipment = {
  rows: EquipmentRow[];
  /**
   * "4d4 × 10" — take this much gold instead of the whole list.
   *
   * A 2014 rule only. 2024 folded the money into the options themselves, so
   * there it reads as a plain B alternative and this is null.
   */
  goldAlternative: string | null;
  /** Whether the background's own equipment stacks on top of the class's. */
  additionalFromBackground: boolean;
};

/** A prerequisite that can be checked against a build rather than read. */
export type OptionalFeaturePrerequisite =
  | { kind: "level"; level: number; className: string | null; classSource: string | null }
  | { kind: "pact"; pact: string }
  /** A spell that must already be known, e.g. `"eldritch blast#c"`. */
  | { kind: "spell"; spell: string }
  /** Another optional feature that must already be taken. */
  | { kind: "optionalfeature"; name: string; source: string | null };

export type OptionalFeatureRow = IndexRow & {
  /** The pools this belongs to. A class offering that pool can pick it. */
  featureType: string[];
  prerequisites: OptionalFeaturePrerequisite[];
  /**
   * The prerequisites that are prose rather than data.
   *
   * 5etools writes two kinds for a person rather than a machine — a required
   * item ("A suit of armor (requires attunement)") and an `otherSummary`
   * ("Dragonmarked House Renown 25+"). Checking them would mean guessing, so
   * they are shown and the player judges.
   */
  prerequisiteText: string[];
};

export type ClassRow = IndexRow & {
  hitDie: number | null;
  /** The two abilities the class grants saving throw proficiency in. */
  savingThrows: string[];
  spellcastingAbility: string | null;
  casterProgression: string | null;
  preparedSpells: string | null;
  /**
   * The levels this class grants an ability score improvement at.
   *
   * Read from the class's own feature list rather than assumed, because the
   * common [4, 8, 12, 16, 19] is wrong for three of the classes in every
   * edition: the fighter also improves at 6 and 14, the rogue at 10, and 2024
   * dropped the level 19 improvement in favour of an epic boon.
   */
  improvementLevels: number[];
  /**
   * The level this class chooses a subclass at.
   *
   * 2014 ranges from 1 (cleric, sorcerer, warlock) through 2 (druid, wizard)
   * to 3; 2024 moved every class to 3.
   */
  subclassLevel: number | null;
  /** The skills this class picks from at level 1. Null for the handful with none. */
  skillChoice: SkillChoice | null;
  /** The choices this class makes the player answer as it levels. */
  optionalFeatureProgression: OptionalFeatureProgression[];
  /**
   * The expertise this class grants, by level.
   *
   * Read from 5etools' Foundry companion data rather than the class text,
   * where it is only prose. Empty for every class but the bard, the rogue, the
   * ranger, the 2024 wizard and Tasha's expert sidekick.
   */
  expertise: ExpertiseGrant[];
  /** Unarmored Defense, for the two classes that have it in every edition. */
  armorClass: ArmorClassOption[];
  /**
   * The scores a character needs before taking a level in this class.
   *
   * A list of alternatives: `[{str: 13}, {dex: 13}]` is "Strength or
   * Dexterity", `[{dex: 13, wis: 13}]` is "Dexterity and Wisdom". The two
   * editions state it in different fields and reach the same answer.
   */
  multiclassRequirements: Record<string, number>[];
  /**
   * The armour and weapons this class grants as a character's first.
   *
   * Null for the entries that state none at all — the sidekicks and the
   * unfinished prestige class.
   */
  startingProficiencies: StartingProficiencies | null;
  /**
   * What taking a level in this class grants someone who already has one.
   *
   * Not the same list as its starting proficiencies. A rogue's first level
   * gives four skills and thieves' tools; a rogue level taken second gives one
   * skill and thieves' tools. Null for the classes that state no block.
   */
  multiclassGrants: MulticlassGrants | null;
  /**
   * The level-one equipment list, with its choices intact.
   *
   * The prose form says the same thing — "(a) a rapier or (b) a shortsword" —
   * and cannot be offered as a choice, which is why equipment was a fixed list
   * until this was read.
   */
  startingEquipment: StartingEquipment | null;
  /**
   * 2024's weapon mastery: how many kinds of weapon this class can use the
   * mastery properties of, by character level.
   *
   * Null for every 2014 class and for the 2024 classes that never learn it.
   * The five that do state the number two different ways — the fighter and the
   * barbarian in a column of their own level table, because it grows, and the
   * paladin, ranger and rogue in the feature's text, where it never does.
   */
  weaponMastery: WeaponMastery | null;
  /**
   * Cantrips and spells per class level, off the class's own table.
   *
   * Both editions print it; nothing read it, and the builder carried a
   * hand-written switch over eight classes with the 2014 numbers instead. The
   * editions also renamed the column: 2014 has "Spells Known" for the classes
   * that learn a fixed list, and 2024 has "Prepared Spells" for every caster.
   *
   * Null for a class with no such table, which is every non-caster.
   */
  spellTable: SpellTable | null;
  /**
   * The level this class starts casting at.
   *
   * Not a constant: 2024 moved the paladin's and the ranger's Spellcasting
   * from level 2 to level 1. The warlock's feature is called Pact Magic, and
   * is read as the same thing.
   */
  spellcastingLevel: number | null;
};

/** One column per kind of count, twenty entries each, or null where absent. */
export type SpellTable = {
  cantrips: number[] | null;
  /** 2014's "Spells Known", for the classes that learn a fixed list. */
  known: number[] | null;
  /** 2024's "Prepared Spells", which every 2024 caster has. */
  prepared: number[] | null;
};

/** What a class's weapon mastery is worth, and what it may be spent on. */
export type WeaponMastery = {
  /** Twenty entries, one per character level. */
  countByLevel: number[];
  /** The barbarian's is narrower: Simple or Martial *Melee* weapons only. */
  meleeOnly: boolean;
};

/**
 * One block of spells a subclass grants, at one gate.
 *
 * Four kinds, and they are four rules: `prepared` and `expanded` widen what
 * the character may prepare, `known` is known outright, `innate` is cast
 * without preparing it at all.
 */
export type SubclassSpellEntry = {
  kind: "expanded" | "known" | "prepared" | "innate";
  /** The class level it arrives at, or null when another gate applies. */
  level: number | null;
  /**
   * The *spell* level it arrives with, for the warlock patrons.
   *
   * A warlock gains its patron's expanded spells when its pact slots reach
   * that level. Reading one of these as a class level hands a level 3 warlock
   * third-level spells five levels early.
   */
  spellLevel: number | null;
  /** Spells named outright, lower case. */
  names: string[];
  /** A filter to evaluate against the spell list. Null count means all. */
  filters: { filter: string; count: number | null }[];
  /** A choice from a named shortlist, which is not a filter. */
  choices: { from: string[]; count: number }[];
};

export type SubclassRow = IndexRow & {
  shortName: string | null;
  className: string | null;
  classSource: string | null;
  /**
   * The spells this subclass adds, and when.
   *
   * Domain, circle and oath lists for most — and for the Eldritch Knight and
   * the Arcane Trickster, the *only* spell list they have: a class's list
   * comes off the spell rows, the fighter and the rogue appear on none, so
   * those two were offered nothing at all.
   */
  spells: SubclassSpellEntry[];
  /** Choices the subclass grants on top of its class's. */
  optionalFeatureProgression: OptionalFeatureProgression[];
  /**
   * How the subclass advances spellcasting, when the class does not.
   *
   * The eldritch knight and the arcane trickster are the only two, and they
   * are the reason this cannot be read off the class: a fighter casts nothing
   * and an eldritch knight casts a third.
   */
  casterProgression: string | null;
  spellcastingAbility: string | null;
  /** Expertise the subclass grants on top of its class's. */
  expertise: ExpertiseGrant[];
  /** The draconic sorcerer's scales, and the 2024 dancing bard's defence. */
  armorClass: ArmorClassOption[];
};

/** The props this index covers, and the row type each yields. */
export type IndexedProp =
  | "spell"
  | "item"
  | "feat"
  | "race"
  | "subrace"
  | "background"
  | "class"
  | "subclass"
  | "optionalfeature";

export type RowFor = {
  spell: SpellRow;
  item: ItemRow;
  feat: FeatRow;
  race: RaceRow;
  subrace: SubraceRow;
  background: BackgroundRow;
  class: ClassRow;
  subclass: SubclassRow;
  optionalfeature: OptionalFeatureRow;
};

/**
 * Whether a row carries the class a subclass hangs off.
 *
 * Rows from the index always do; the check exists because callers reach this
 * through the widened `IndexRow`, where the fields are not visible.
 */
export function isSubclassRow(row: IndexRow): row is IndexRow & SubclassRow {
  const candidate = row as Partial<SubclassRow>;
  return typeof candidate.className === "string" && typeof candidate.classSource === "string";
}

/**
 * The reference for a row, ready to hand to Plutonium.
 *
 * A subclass hashes as state on its class's page rather than as an entity of
 * its own, so it takes a different builder. A subclass row missing its class
 * would hash to something Plutonium cannot resolve, so it fails rather than
 * falling through to the generic builder.
 */
export function refOf<P extends IndexedProp>(prop: P, row: RowFor[P]): VetoolsRef {
  if (prop === "subclass") {
    if (!isSubclassRow(row)) {
      throw new Error(`Subclass "${row.name}" has no class, so it cannot be referenced.`);
    }
    return buildSubclassRef({
      name: row.name,
      source: row.source,
      className: row.className as string,
      classSource: row.classSource as string,
      shortName: row.shortName ?? undefined,
    });
  }

  return buildRef(prop as VetoolsProp, row.name, row.source);
}

/** The ruleset a row belongs to, derived from its source. */
export function rulesVersionOfRow(row: IndexRow): RulesVersion {
  return rulesVersionOf(row.source);
}

/**
 * Keep only the rows legal for a build's ruleset.
 *
 * This is the filter that stops a 2014 character being offered 2024 content,
 * which would import as a different document than the player expects.
 */
export function forRulesVersion<T extends IndexRow>(rows: T[], rulesVersion: RulesVersion): T[] {
  return rows.filter((row) => isSourceAllowed(row.source, rulesVersion));
}

/** Normalise a name for searching: casefolded and stripped of accents. */
export function normalizeForSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Search rows by name.
 *
 * Rows whose name starts with the query rank above rows that merely contain
 * it, so typing "fire" surfaces Fire Bolt before Wall of Fire.
 */
export function searchByName<T extends IndexRow>(rows: T[], query: string, limit = 50): T[] {
  const needle = normalizeForSearch(query.trim());
  if (!needle) return rows.slice(0, limit);

  const prefix: T[] = [];
  const contains: T[] = [];

  for (const row of rows) {
    const name = normalizeForSearch(row.name);
    if (name.startsWith(needle)) prefix.push(row);
    else if (name.includes(needle)) contains.push(row);
    if (prefix.length >= limit) break;
  }

  return [...prefix, ...contains].slice(0, limit);
}

export type SpellFilter = {
  levels?: number[];
  schools?: string[];
  concentration?: boolean;
  ritual?: boolean;
};

/** Filter spells by the axes a picker exposes. Omitted axes do not constrain. */
export function filterSpells(rows: SpellRow[], filter: SpellFilter): SpellRow[] {
  return rows.filter((row) => {
    if (filter.levels?.length && !filter.levels.includes(row.level)) return false;
    if (filter.schools?.length && !filter.schools.includes(row.school)) return false;
    if (filter.concentration != null && Boolean(row.concentration) !== filter.concentration) return false;
    if (filter.ritual != null && Boolean(row.ritual) !== filter.ritual) return false;
    return true;
  });
}

/**
 * Group rows by name so a picker can show one entry per spell with its
 * available sources, instead of listing "Fire Bolt" once per book.
 */
export function groupByName<T extends IndexRow>(rows: T[]): Array<{ name: string; variants: T[] }> {
  const byName = new Map<string, T[]>();

  for (const row of rows) {
    const existing = byName.get(row.name);
    if (existing) existing.push(row);
    else byName.set(row.name, [row]);
  }

  return [...byName.entries()].map(([name, variants]) => ({ name, variants }));
}

export * from "./resolve.js";
export * from "./to-payload.js";
export * from "./data.js";
