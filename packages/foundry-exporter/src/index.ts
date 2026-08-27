import {
  type AbilityId,
  type CharacterBuild,
  type FoundryActorPayload,
  type PreflightResult,
  foundryActorPayloadSchema,
} from "@bertinis-vault/contracts";
import { findWeaponCatalogEntry } from "@bertinis-vault/data-engine";
import {
  getArmorCatalogEntry,
  getFeatCatalogEntry,
  getGearCatalogEntry,
  getSpellCatalogEntry,
} from "@bertinis-vault/data-engine";
import {
  abilityModifierMap,
  buildPreflightResult,
  getEquipmentEntries,
  getFeatureEntries,
  getHitDieForClass,
  getNormalizedProficiencyLabels,
  getProficiencyLabels,
  resolveLanguageId as resolveLanguageIdShared,
  resolveSkillId as resolveSkillIdShared,
  getSpellAbilityForClass,
  getSpellEntries,
  getSpellProgressionForClass,
  normalizeClassId,
  resolveToolEntry as resolveToolEntryShared,
} from "@bertinis-vault/domain";

import blankTemplate from "./blank-actor-template.json" with { type: "json" };

type FoundryItem = Record<string, unknown>;
type DerivedSpellEntry = {
  name: string;
  level: number;
  spellId?: string;
};
type SpellReferenceCatalogMeta = {
  label?: string;
  source?: { book?: string };
  plutonium?: {
    source?: string;
    page?: string;
    hash?: string;
    propDroppable?: string;
  };
};
export type FoundryExportResult = {
  preflight: PreflightResult;
  payload?: FoundryActorPayload;
};

// ---------------------------------------------------------------------------
// Deep clone utility
// ---------------------------------------------------------------------------
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// ---------------------------------------------------------------------------
// Lookup tables
// ---------------------------------------------------------------------------

const CLASS_PROFS_BY_ID: Record<string, { armor: string[]; weapons: string[] }> = {
  barbarian: { armor: ["light", "medium", "shields"], weapons: ["simple", "martial"] },
  bard: { armor: ["light"], weapons: ["simple", "hand crossbow", "longsword", "rapier", "shortsword"] },
  cleric: { armor: ["light", "medium", "shields"], weapons: ["simple"] },
  druid: {
    armor: ["light", "medium", "shields"],
    weapons: ["clubs", "daggers", "darts", "javelins", "maces", "quarterstaffs", "scimitars", "sickles", "slings", "spears"],
  },
  fighter: { armor: ["light", "medium", "heavy", "shields"], weapons: ["simple", "martial"] },
  monk: { armor: [], weapons: ["simple", "shortswords"] },
  paladin: { armor: ["light", "medium", "heavy", "shields"], weapons: ["simple", "martial"] },
  ranger: { armor: ["light", "medium", "shields"], weapons: ["simple", "martial"] },
  rogue: { armor: ["light"], weapons: ["simple", "hand crossbow", "longsword", "rapier", "shortsword"] },
  sorcerer: { armor: [], weapons: ["daggers", "darts", "slings", "quarterstaffs", "light crossbows"] },
  warlock: { armor: ["light"], weapons: ["simple"] },
  wizard: { armor: [], weapons: ["daggers", "darts", "slings", "quarterstaffs", "light crossbows"] },
  artificer: { armor: ["light", "medium", "shields"], weapons: ["simple"] },
};

/**
 * What a class hands over when it is *not* the first one.
 *
 * A second class grants a shorter list than a first: a fighter who dips gets
 * light and medium armour and shields, never heavy. Reading the table above
 * for every class would hand the character proficiencies they do not have.
 *
 * Split by edition because the two genuinely differ — 2024's druid loses
 * medium armour, its barbarian and fighter grant martial weapons without
 * restating simple ones, and its monk has no block at all. Read off the index
 * rather than written from memory. A class with no entry contributes nothing,
 * which is what the book says by printing nothing.
 */
const CLASS_MULTICLASS_PROFS: Record<
  "2014" | "2024",
  Record<string, { armor: string[]; weapons: string[] }>
> = {
  "2014": {
    barbarian: { armor: ["shields"], weapons: ["simple", "martial"] },
    bard: { armor: ["light"], weapons: [] },
    cleric: { armor: ["light", "medium", "shields"], weapons: [] },
    druid: { armor: ["light", "medium", "shields"], weapons: [] },
    fighter: { armor: ["light", "medium", "shields"], weapons: ["simple", "martial"] },
    monk: { armor: [], weapons: ["simple", "shortswords"] },
    paladin: { armor: ["light", "medium", "shields"], weapons: ["simple", "martial"] },
    ranger: { armor: ["light", "medium", "shields"], weapons: ["simple", "martial"] },
    rogue: { armor: ["light"], weapons: [] },
    warlock: { armor: ["light"], weapons: ["simple"] },
    artificer: { armor: ["light", "medium", "shields"], weapons: [] },
  },
  "2024": {
    barbarian: { armor: ["shields"], weapons: ["martial"] },
    bard: { armor: ["light"], weapons: [] },
    cleric: { armor: ["light", "medium", "shields"], weapons: [] },
    druid: { armor: ["light", "shields"], weapons: [] },
    fighter: { armor: ["light", "medium", "shields"], weapons: ["martial"] },
    paladin: { armor: ["light", "medium", "shields"], weapons: ["martial"] },
    ranger: { armor: ["light", "medium", "shields"], weapons: ["martial"] },
    rogue: { armor: ["light"], weapons: [] },
    warlock: { armor: ["light"], weapons: [] },
    artificer: { armor: ["light", "medium", "shields"], weapons: [] },
  },
};

const CLASS_SAVE_PROFS_BY_ID: Record<string, AbilityId[]> = {
  barbarian: ["str", "con"],
  bard: ["dex", "cha"],
  cleric: ["wis", "cha"],
  druid: ["int", "wis"],
  fighter: ["str", "con"],
  monk: ["str", "dex"],
  paladin: ["wis", "cha"],
  ranger: ["str", "dex"],
  rogue: ["dex", "int"],
  sorcerer: ["con", "cha"],
  warlock: ["wis", "cha"],
  wizard: ["int", "wis"],
  artificer: ["con", "int"],
};

const BACKGROUND_SKILL_PROFS_BY_ID: Record<string, string[]> = {
  acolyte: ["ins", "rel"],
  charlatan: ["dec", "slt"],
  criminal: ["dec", "ste"],
  entertainer: ["acr", "prf"],
  "folk-hero": ["ani", "sur"],
  "guild-artisan": ["ins", "per"],
  hermit: ["med", "rel"],
  noble: ["his", "per"],
  outlander: ["ath", "sur"],
  sage: ["arc", "his"],
  sailor: ["ath", "prc"],
  soldier: ["ath", "itm"],
  urchin: ["slt", "ste"],
};

const BACKGROUND_LANGUAGE_PROFS_BY_ID: Record<string, string[]> = {
  acolyte: ["common"],
  "guild-artisan": ["common"],
  hermit: ["common"],
  noble: ["common"],
  outlander: ["common"],
  sage: ["common"],
};

const BACKGROUND_TOOL_PROFS_BY_ID: Record<string, string[]> = {
  charlatan: ["Disguise Kit", "Forgery Kit"],
  criminal: ["Thieves' Tools", "Gaming Set"],
  entertainer: ["Disguise Kit", "Musical Instrument"],
  "guild-artisan": ["Artisan's Tools"],
  hermit: ["Herbalism Kit"],
  noble: ["Gaming Set"],
  outlander: ["Musical Instrument"],
  sailor: ["Navigator's Tools", "Vehicle Water"],
  soldier: ["Gaming Set", "Vehicle Land"],
  urchin: ["Disguise Kit", "Thieves' Tools"],
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function makeId(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 16 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s/-]/g, "")
    .trim()
    .replace(/[\s/]+/g, "-");
}

function makeStats(compendiumSource: string | null = null) {
  return {
    compendiumSource,
    duplicateSource: null,
    exportSource: null,
    coreVersion: "13.351",
    systemId: "dnd5e",
    systemVersion: "5.2.5",
    createdTime: null,
    modifiedTime: null,
    lastModifiedBy: null,
  };
}

function resolveSkillId(value: string) {
  return resolveSkillIdShared(value);
}

function parseLanguageEntry(value: string) {
  return resolveLanguageIdShared(value);
}

function parseToolEntry(value: string) {
  return resolveToolEntryShared(value);
}

// ---------------------------------------------------------------------------
// Fill abilities into cloned template
// ---------------------------------------------------------------------------

function fillAbilities(actor: Record<string, any>, character: CharacterBuild) {
  const abilities = actor.system.abilities;
  const finals = character.abilities.final;
  const primaryClassId = normalizeClassId(character.classing.classes[0]?.classId ?? "");
  const saveProficiencies = new Set(CLASS_SAVE_PROFS_BY_ID[primaryClassId] ?? []);

  for (const abilityId of ["str", "dex", "con", "int", "wis", "cha"] as AbilityId[]) {
    abilities[abilityId].value = finals[abilityId];
    abilities[abilityId].proficient = saveProficiencies.has(abilityId) ? 1 : 0;
  }
}

// ---------------------------------------------------------------------------
// Fill skills into cloned template
// ---------------------------------------------------------------------------

function fillSkills(actor: Record<string, any>, character: CharacterBuild) {
  const skills = actor.system.skills;
  const backgroundSkillIds = BACKGROUND_SKILL_PROFS_BY_ID[character.background.backgroundId] ?? [];
  const selectedSkillIds = getProficiencyLabels(character, "skill")
    .map((entry) => resolveSkillId(entry))
    .filter((entry): entry is string => Boolean(entry));

  const proficientSkills = new Set([...backgroundSkillIds, ...selectedSkillIds]);

  for (const skillId of proficientSkills) {
    if (skillId in skills) {
      skills[skillId].value = 1;
    }
  }

  // Expertise doubles a proficiency rather than adding one, which is why it is
  // a second pass over the same skills. dnd5e reads the level as a number:
  // 1 is proficient, 2 is expertise. Written after the pass above so the
  // doubling is not overwritten by the proficiency it doubles.
  //
  // A skill listed as expertise the character is not proficient in is skipped,
  // not promoted. The rules layer already reports that as a problem the player
  // can see; silently granting it here would hide it.
  for (const label of getNormalizedProficiencyLabels(character, "expertise")) {
    const skillId = resolveSkillId(label);
    if (skillId && proficientSkills.has(skillId) && skillId in skills) {
      skills[skillId].value = 2;
    }
  }
}

// ---------------------------------------------------------------------------
// Fill tools into cloned template
// ---------------------------------------------------------------------------

function fillTools(actor: Record<string, any>, character: CharacterBuild) {
  const backgroundToolEntries = BACKGROUND_TOOL_PROFS_BY_ID[character.background.backgroundId] ?? [];
  const toolEntries = [...backgroundToolEntries, ...getProficiencyLabels(character, "tool")];

  for (const entry of toolEntries) {
    const tool = parseToolEntry(entry);
    if (!tool) continue;

    actor.system.tools[tool.id] = {
      value: 1,
      ability: tool.ability,
      roll: { min: null, max: null, mode: 0 },
      bonuses: { check: "" },
    };
  }
}

// ---------------------------------------------------------------------------
// Fill spell slots into cloned template
// ---------------------------------------------------------------------------

function fillSpellSlots(actor: Record<string, any>, character: CharacterBuild) {
  const derivedSlots = character.derived.spellcasting?.slots ?? {};
  const spells = actor.system.spells;

  for (let i = 1; i <= 9; i++) {
    const key = `spell${i}` as keyof typeof derivedSlots;
    spells[key].value = derivedSlots[key] ?? 0;
  }

  const primaryClassId = normalizeClassId(character.classing.classes[0]?.classId ?? "");
  if (getSpellProgressionForClass(primaryClassId) === "pact") {
    const pactSlotEntry = Object.entries(derivedSlots).find(([, value]) => (value ?? 0) > 0);
    if (pactSlotEntry) {
      spells.pact.value = pactSlotEntry[1] ?? 0;
    }
  }
}

// ---------------------------------------------------------------------------
// Fill languages into cloned template
// ---------------------------------------------------------------------------

function fillLanguages(actor: Record<string, any>, character: CharacterBuild) {
  const backgroundLanguageIds = BACKGROUND_LANGUAGE_PROFS_BY_ID[character.background.backgroundId] ?? [];
  const selectedLanguageIds = getProficiencyLabels(character, "language")
    .map((entry) => parseLanguageEntry(entry))
    .filter((entry): entry is string => Boolean(entry));
  const uniqueLanguageIds = Array.from(new Set([...backgroundLanguageIds, ...selectedLanguageIds]));

  actor.system.traits.languages.value = uniqueLanguageIds;
}

// ---------------------------------------------------------------------------
// Fill weapon/armor proficiencies into cloned template
// ---------------------------------------------------------------------------

/**
 * The coins the character starts with.
 *
 * Counted in copper by the builder, because that is the only unit that never
 * rounds. Split here into gold, silver and copper — and deliberately no
 * further.
 *
 * The book says a 2024 fighter who takes the money instead of the kit walks
 * away with 150 gold pieces, so the sheet says 150 gp. Rolling that up into
 * 15 platinum is the same money and a different answer: it puts the character's
 * whole purse in a box most tables never use, and the player has to convert it
 * back in their head to check it against what they were told they had.
 * Electrum is skipped for the same reason, and harder — almost no game uses it.
 */
function fillCurrency(actor: Record<string, any>, character: CharacterBuild) {
  const copper = character.choices.startingCopper ?? 0;
  if (copper <= 0) return;

  actor.system.currency.gp = Math.floor(copper / 100);
  actor.system.currency.sp = Math.floor((copper % 100) / 10);
  actor.system.currency.cp = copper % 10;
}

function fillProficiencies(actor: Record<string, any>, character: CharacterBuild) {
  const primaryClassId = normalizeClassId(character.classing.classes[0]?.classId ?? "");
  const primary = CLASS_PROFS_BY_ID[primaryClassId] ?? { armor: [], weapons: [] };

  // Every class past the first adds its multiclass block. Read only from the
  // first class, a wizard 4 / fighter 1 exported with no armour proficiency at
  // all — a character who cannot equip the armour they are wearing.
  const edition = character.meta.rulesVersion === "5e-2024" ? "2024" : "2014";
  const extras = character.classing.classes
    .slice(1)
    .map(
      (entry) =>
        CLASS_MULTICLASS_PROFS[edition][normalizeClassId(entry.classId)] ?? {
          armor: [],
          weapons: [],
        },
    );

  const merge = (lists: string[][]) => {
    const merged: string[] = [];
    for (const list of lists) for (const value of list) if (!merged.includes(value)) merged.push(value);
    return merged;
  };

  const armor = merge([primary.armor, ...extras.map((entry) => entry.armor)]);
  const weapons = merge([primary.weapons, ...extras.map((entry) => entry.weapons)]);

  actor.system.traits.weaponProf.custom = weapons.join(", ");

  // Weapon mastery, 2024's own idea. Foundry checks this set with
  // `has(item.type.baseItem)`, so the values are base-item ids — `longsword`,
  // never "Longsword" and never the property "Sap". The builder produces them;
  // anything else here would be a mastery the player chose and never got.
  actor.system.traits.weaponProf.mastery.value = character.choices.weaponMasteries ?? [];
  actor.system.traits.armorProf.value = armor.filter((type) => ["light", "medium", "heavy"].includes(type));
  actor.system.traits.armorProf.custom = armor.includes("shields") ? "shields" : "";
}

// ---------------------------------------------------------------------------
// Fill details (biography, race, background, class, etc.)
// ---------------------------------------------------------------------------

function fillDetails(actor: Record<string, any>, character: CharacterBuild) {
  const details = actor.system.details;
  const biography = character.identity.biography ?? {};

  details.alignment = character.identity.alignment ?? "";
  details.race = character.ancestry.raceId;
  details.background = character.background.backgroundId;
  details.originalClass = character.classing.classes[0]?.classId ?? "";
  details.trait = biography.trait ?? "";
  details.ideal = biography.ideal ?? "";
  details.bond = biography.bond ?? "";
  details.flaw = biography.flaw ?? "";

  const bioLines: string[] = [];
  if (biography.trait) bioLines.push(`<p><em>Trait:</em> ${biography.trait}</p>`);
  if (biography.ideal) bioLines.push(`<p><em>Ideal:</em> ${biography.ideal}</p>`);
  if (biography.bond) bioLines.push(`<p><em>Bond:</em> ${biography.bond}</p>`);
  if (biography.flaw) bioLines.push(`<p><em>Flaw:</em> ${biography.flaw}</p>`);
  if (biography.notes) bioLines.push(`<p><em>Notes:</em> ${biography.notes}</p>`);
  details.biography.value = bioLines.join("");
}

// ---------------------------------------------------------------------------
// Fill attributes (HP, spellcasting ability, etc.)
// ---------------------------------------------------------------------------

function fillAttributes(actor: Record<string, any>, character: CharacterBuild) {
  actor.system.attributes.hp.value = character.derived.hp;
  actor.system.attributes.spellcasting = character.derived.spellcasting?.ability ?? "";
}

// ---------------------------------------------------------------------------
// Item builders (these create new objects — they don't fill the template)
// ---------------------------------------------------------------------------

function buildClassItems(character: CharacterBuild): FoundryItem[] {
  return character.classing.classes.map((entry) => {
    const classId = normalizeClassId(entry.classId);
    const spellAbility = getSpellAbilityForClass(classId) ?? "";
    const progression = getSpellProgressionForClass(classId);
    const hitDie = getHitDieForClass(classId);

    return {
      _id: makeId(),
      name: entry.classId,
      type: "class",
      img: "systems/dnd5e/icons/svg/items/class.svg",
      system: {
        identifier: slugify(entry.classId),
        description: {
          value: `<p>${entry.classId}${entry.subclassId ? ` - ${entry.subclassId}` : ""}</p>`,
          chat: "",
        },
        source: { custom: "", book: "PHB'14", page: "", license: "", rules: "2014", revision: 1 },
        levels: entry.level,
        hd: { denomination: `d${hitDie}`, spent: 0, additional: "" },
        spellcasting: { progression, ability: spellAbility, preparation: {} },
        primaryAbility: { value: [spellAbility || "str"], all: false },
        wealth: "",
        advancement: [],
        startingEquipment: [],
        properties: [],
      },
      flags: {},
      effects: [],
      _stats: makeStats(),
      folder: null,
      sort: 0,
      ownership: { default: 0 },
    };
  });
}

function buildFeatItem(name: string, featType: string): FoundryItem {
  return {
    _id: makeId(),
    name,
    type: "feat",
    img: "icons/svg/item-bag.svg",
    system: {
      source: { custom: "", book: "", page: "", license: "", rules: "2014", revision: 1 },
      description: { value: "", chat: "" },
      requirements: "",
      uses: { max: "", recovery: [], spent: 0 },
      type: { value: featType, subtype: "" },
      properties: [],
      advancement: [],
      activities: {},
      identifier: slugify(name),
      crewed: false,
      enchant: {},
      prerequisites: { items: [], repeatable: false },
    },
    flags: {},
    effects: [],
    _stats: makeStats(),
    folder: null,
    sort: 0,
    ownership: { default: 0 },
  };
}

function buildSpellReference(spellId: string | undefined) {
  if (!spellId) return null;
  return {
    type: "spell",
    spellId,
    compendiumPack: "dnd5e.spells",
    lookup: `identifier:${spellId}`,
    comparable: true,
  };
}

function toPlutoniumSource(book?: string) {
  if (!book) return "PHB";
  return book
    .replace(/'14/g, "")
    .replace(/'24/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
}

function toPlutoniumHash(name: string, source: string) {
  return `${encodeURIComponent(name.trim().toLowerCase())}_${source.trim().toLowerCase()}`;
}

function buildPlutoniumSpellReference(
  name: string,
  spellId: string,
  catalogEntry?: SpellReferenceCatalogMeta,
) {
  const source = catalogEntry?.plutonium?.source ?? toPlutoniumSource(catalogEntry?.source?.book);
  const page = catalogEntry?.plutonium?.page ?? "spells.html";
  const hash = catalogEntry?.plutonium?.hash ?? toPlutoniumHash(catalogEntry?.label ?? name, source);
  const propDroppable = catalogEntry?.plutonium?.propDroppable ?? "spell";
  return { page, source, hash, propDroppable, spellId };
}

function buildSpellDescription(name: string, summary?: string, reference?: ReturnType<typeof buildSpellReference>) {
  const lines = [`<p>${summary || `${name} exported from the canonical Bertini's Vault build.`}</p>`];
  if (reference) {
    lines.push(`<p><strong>Compendium lookup:</strong> ${reference.compendiumPack} / ${reference.lookup}</p>`);
  }
  return lines.join("");
}

function buildSpellItem(entry: DerivedSpellEntry, classId: string): FoundryItem {
  const catalogEntry = getSpellCatalogEntry(entry.spellId ?? entry.name);
  const spellId = entry.spellId ?? catalogEntry?.id ?? slugify(entry.name);
  const name = catalogEntry?.label ?? entry.name;
  const level = catalogEntry?.level ?? entry.level;
  const spellAbility = getSpellAbilityForClass(classId) ?? "int";
  const activityId = "dnd5eactivity000";
  const reference = buildSpellReference(spellId);
  const plutoniumReference = buildPlutoniumSpellReference(name, spellId, catalogEntry);
  const description = buildSpellDescription(name, catalogEntry?.summary, reference);
  const components = catalogEntry?.components ?? ["vocal", "somatic"];
  const castingTime = catalogEntry?.castingTime ?? { type: "action", value: 1 };
  const range = catalogEntry?.range ?? { value: null, units: "ft" };
  const duration = catalogEntry?.duration ?? { value: "", units: "inst" };

  return {
    _id: makeId(),
    name,
    type: "spell",
    img: "icons/svg/book.svg",
    system: {
      source: { custom: "", book: "", page: "", license: "", rules: "2014", revision: 1 },
      description: { value: description, chat: catalogEntry?.summary ?? "" },
      level,
      school: catalogEntry?.school ?? "evo",
      properties: components,
      ability: spellAbility,
      materials: { value: catalogEntry?.materials ?? "", consumed: false, cost: 0, supply: 0 },
      target: { template: { contiguous: false, units: "ft" }, affects: { count: "1", type: "creature", choice: false } },
      range: { value: range.value, units: range.units },
      activation: { type: castingTime.type, value: castingTime.value, condition: "" },
      duration: { value: duration.value, units: duration.units },
      uses: { max: "", recovery: [], spent: 0 },
      method: "spell",
      prepared: level === 0 ? 2 : 1,
      activities: {
        [activityId]: {
          _id: activityId,
          type: "utility",
          activation: { type: castingTime.type, value: null, override: false },
          consumption: { targets: [], scaling: { allowed: false, max: "" }, spellSlot: true },
          description: { chatFlavor: catalogEntry?.summary ?? "" },
          duration: { units: duration.units, concentration: false, override: false },
          effects: [],
          range: { override: false, units: range.units },
          target: { prompt: true, template: { contiguous: false, units: "ft" }, affects: { choice: false }, override: false },
          uses: { spent: 0, recovery: [] },
          sort: 0,
          flags: {},
        },
      },
      identifier: spellId,
    },
    flags: {
      plutonium: { ...plutoniumReference },
      "bertinis-vault": { reference, plutonium: plutoniumReference },
    },
    effects: [],
    _stats: makeStats(),
    folder: null,
    sort: 0,
    ownership: { default: 0 },
  };
}

function buildSpellItems(character: CharacterBuild): FoundryItem[] {
  const primaryClassId = normalizeClassId(character.classing.classes[0]?.classId ?? "");
  const dedupedItems: FoundryItem[] = [];
  const seen = new Set<string>();

  for (const entry of getSpellEntries(character)) {
    const catalogEntry = getSpellCatalogEntry(entry.spellId ?? entry.name);
    const spellKey = `${catalogEntry?.id ?? slugify(entry.name)}:${entry.level}`;
    if (seen.has(spellKey)) continue;
    seen.add(spellKey);
    dedupedItems.push(buildSpellItem(entry, primaryClassId));
  }

  return dedupedItems;
}

function buildFeatItems(character: CharacterBuild): FoundryItem[] {
  const backgroundFeats = character.background.grantedFeatIds.map((featId) =>
    buildFeatItem(getFeatCatalogEntry(featId)?.label ?? featId, "background"),
  );
  const chosenFeats = character.choices.feats.map((featId) =>
    buildFeatItem(getFeatCatalogEntry(featId)?.label ?? featId, "feat"),
  );
  const featureItems = getFeatureEntries(character).map((feature) =>
    buildFeatItem(feature.name, feature.source),
  );
  const dedupedItems: FoundryItem[] = [];
  const seen = new Set<string>();

  for (const item of [...backgroundFeats, ...chosenFeats, ...featureItems]) {
    const key = `${String(item.type)}:${String(item.name).toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    dedupedItems.push(item);
  }

  return dedupedItems;
}

function parseDamageFormula(formula: string) {
  const match = formula.match(/(\d+)d(\d+)/i);
  const [, numberPart, denominationPart] = match ?? [];
  return {
    number: numberPart ? Number.parseInt(numberPart, 10) : 1,
    denomination: denominationPart ? Number.parseInt(denominationPart, 10) : 6,
  };
}

function findWeaponData(name: string) {
  return findWeaponCatalogEntry(name);
}

function findArmorData(name: string) {
  return getArmorCatalogEntry(name);
}

function findGearData(name: string) {
  return getGearCatalogEntry(name);
}

function buildWeaponItem(name: string, quantity = 1): FoundryItem {
  const weaponData = findWeaponData(name);
  const activityId = "dnd5eactivity000";
  const damage = parseDamageFormula(weaponData?.damage ?? "1d6");

  return {
    _id: makeId(),
    name,
    type: "weapon",
    img: "icons/svg/sword.svg",
    system: {
      source: { custom: "", book: "", page: "", license: "", rules: "2014", revision: 1 },
      description: { value: "", chat: "" },
      quantity,
      weight: { value: 0, units: "lb" },
      price: { value: 0, denomination: "gp" },
      attunement: { required: false },
      equipped: true,
      identified: true,
      rarity: "common",
      uses: { max: "", recovery: [], spent: 0 },
      activation: { type: "action", value: 1, condition: "" },
      duration: { value: "", units: "inst" },
      target: {
        template: { count: "", contiguous: false, type: "", size: "", width: "", height: "", units: "ft" },
        affects: { count: "1", type: "creature", choice: false, special: "" },
      },
      range: { value: null, units: "ft" },
      damage: {
        base: {
          number: damage.number,
          denomination: damage.denomination,
          bonus: "",
          types: [weaponData?.damageType ?? "slashing"],
          custom: { enabled: false },
          scaling: { mode: "whole", number: 1, formula: "" },
        },
      },
      type: { value: weaponData?.itemType ?? "simpleM", baseItem: "" },
      properties: [],
      proficient: null,
      activities: {
        [activityId]: {
          _id: activityId,
          type: "attack",
          activation: { type: "action", value: null, override: false },
          consumption: { targets: [], scaling: { allowed: false, max: "" }, spellSlot: false },
          description: { chatFlavor: "" },
          duration: { units: "inst", concentration: false, override: false },
          effects: [],
          range: { override: false, units: "ft" },
          target: { prompt: true, template: { contiguous: false, units: "ft" }, affects: { choice: false }, override: false },
          attack: {
            ability: "",
            bonus: "",
            critical: { threshold: null },
            flat: false,
            type: { value: weaponData?.attackType ?? "melee", classification: "weapon" },
          },
          damage: {
            critical: { bonus: "" },
            includeBase: true,
            parts: [
              {
                number: damage.number,
                denomination: damage.denomination,
                bonus: "",
                types: [weaponData?.damageType ?? "slashing"],
                custom: { enabled: false, formula: "" },
                scaling: { mode: "whole", number: 1, formula: "" },
              },
            ],
          },
          uses: { spent: 0, recovery: [] },
          sort: 0,
          flags: {},
        },
      },
      identifier: slugify(name),
    },
    flags: {},
    effects: [],
    _stats: makeStats(),
    folder: null,
    sort: 0,
    ownership: { default: 0 },
  };
}

function buildArmorItem(name: string, quantity = 1, equipped: boolean): FoundryItem {
  const armorData = findArmorData(name);

  return {
    _id: makeId(),
    name: armorData?.label ?? name,
    type: "equipment",
    img: "icons/svg/shield.svg",
    system: {
      source: { custom: "", book: "", page: "", license: "", rules: "2014", revision: 1 },
      description: { value: "", chat: "" },
      quantity,
      weight: { value: 0, units: "lb" },
      price: { value: 0, denomination: "gp" },
      attunement: { required: false },
      equipped,
      identified: true,
      rarity: "common",
      uses: { max: "", recovery: [], spent: 0 },
      armor: {
        type: armorData?.grantsShieldBonus ? "shield" : "light",
        value: armorData?.armorFormula ?? "",
      },
      strength: 0,
      stealth: false,
      proficient: null,
      identifier: slugify(name),
    },
    flags: {},
    effects: [],
    _stats: makeStats(),
    folder: null,
    sort: 0,
    ownership: { default: 0 },
  };
}

function buildGearItem(name: string, quantity = 1): FoundryItem {
  const gearData = findGearData(name);

  return {
    _id: makeId(),
    name: gearData?.label ?? name,
    type: "loot",
    img: "icons/svg/item-bag.svg",
    system: {
      source: { custom: "", book: "", page: "", license: "", rules: "2014", revision: 1 },
      description: { value: "", chat: "" },
      quantity,
      weight: { value: 0, units: "lb" },
      price: { value: 0, denomination: "gp" },
      rarity: "common",
      identified: true,
      container: null,
      identifier: slugify(name),
    },
    flags: {},
    effects: [],
    _stats: makeStats(),
    folder: null,
    sort: 0,
    ownership: { default: 0 },
  };
}

// ---------------------------------------------------------------------------
// Build all items array
// ---------------------------------------------------------------------------

function buildItems(character: CharacterBuild): FoundryItem[] {
  const equipment = getEquipmentEntries(character);
  let equippedArmorAssigned = false;
  let equippedShieldAssigned = false;

  const equipmentItems = equipment.flatMap((item) => {
    if (findWeaponData(item.lookupName)) {
      return [buildWeaponItem(item.lookupName, item.quantity)];
    }

    const armorData = findArmorData(item.lookupName);
    if (armorData) {
      const isShield = Boolean(armorData.grantsShieldBonus);
      const shouldEquip = isShield ? !equippedShieldAssigned : !equippedArmorAssigned;
      if (isShield) equippedShieldAssigned = true;
      else equippedArmorAssigned = true;
      return [buildArmorItem(item.lookupName, item.quantity, shouldEquip)];
    }

    return [buildGearItem(item.lookupName, item.quantity)];
  });

  return [
    ...buildClassItems(character),
    ...buildFeatItems(character),
    ...buildSpellItems(character),
    ...equipmentItems,
  ];
}

// ---------------------------------------------------------------------------
// Main export: clone template + fill
// ---------------------------------------------------------------------------

function buildFoundryActorPayloadUnchecked(character: CharacterBuild): FoundryActorPayload {
  const actor = deepClone(blankTemplate) as Record<string, any>;

  // Identity
  actor.name = character.identity.characterName;
  actor.prototypeToken.name = character.identity.characterName;

  // Fill system fields into the cloned template
  fillAbilities(actor, character);
  fillSkills(actor, character);
  fillTools(actor, character);
  fillSpellSlots(actor, character);
  fillAttributes(actor, character);
  fillLanguages(actor, character);
  fillProficiencies(actor, character);
  fillCurrency(actor, character);
  fillDetails(actor, character);

  // Items (these are built fresh and injected into the empty array)
  actor.items = buildItems(character);

  // Flags
  actor.flags = {
    "bertinis-vault": {
      sourceProfile: character.meta.sourceProfile,
      rulesVersion: character.meta.rulesVersion,
      preflight: {
        blockers: 0,
        warnings: 0,
        info: 0,
        total: 0,
      },
    },
  };

  return foundryActorPayloadSchema.parse(actor);
}

export function buildFoundryExportResult(character: CharacterBuild): FoundryExportResult {
  const preflight = buildPreflightResult(character, {
    target: {
      rulesVersion: character.meta.rulesVersion,
      sourceProfile: character.meta.sourceProfile,
      foundryVersion: "13.351",
      systemId: "dnd5e",
      systemVersion: "5.2.5",
    },
  });

  if (!preflight.ok) {
    return { preflight };
  }

  const payload = buildFoundryActorPayloadUnchecked(character);
  const flaggedPayload: FoundryActorPayload = foundryActorPayloadSchema.parse({
    ...payload,
    flags: {
      ...payload.flags,
      "bertinis-vault": {
        ...((payload.flags?.["bertinis-vault"] as Record<string, unknown> | undefined) ?? {}),
        preflight: preflight.summary,
      },
    },
  });

  return {
    preflight,
    payload: flaggedPayload,
  };
}

export function buildFoundryActorPayload(character: CharacterBuild): FoundryActorPayload {
  const result = buildFoundryExportResult(character);

  if (!result.payload) {
    const blockerSummary = result.preflight.issues
      .filter((issue) => issue.severity === "blocker")
      .map((issue) => issue.message)
      .join(" ");

    throw new Error(
      blockerSummary || "Foundry export blocked by preflight validation.",
    );
  }

  return result.payload;
}

