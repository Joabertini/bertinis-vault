/**
 * Turning a payload into an actor.
 *
 * Two halves, and both of them had to be made quiet:
 *
 * 1. **Building.** `documentForRef` calls Plutonium's converters, which are
 *    pure functions, rather than its importers, which are its interactive
 *    layer. What the Charactermancer would have asked travels in each entry's
 *    `dataOpts` instead.
 * 2. **Writing.** `markAsDirectImport` is what stops Plutonium's
 *    `preCreateItem` hook intercepting the item on its way onto the actor and
 *    opening the Charactermancer anyway. This is the half that was missed for
 *    three attempts, all of them spent on the first one.
 *
 * Features are not safe under this, which took an imported actor to see. A
 * class item carries them as `ItemGrant` advancements that fire while a
 * character is levelled through the class, and a direct import levels nothing,
 * so the Features tab arrived empty. They are built and added alongside their
 * parent instead.
 */

import {
  getPlutoniumApi,
  documentForRef,
  featureDocumentsFor,
  loadEntity,
  markAsDirectImport,
  PROFICIENCY_IMPORT_MODE,
} from "./plutonium.js";
import { watchWindows } from "./window-watch.js";

/**
 * Everything a payload asks to be imported, in the order it must happen.
 *
 * Each entry pairs a reference with the converter options that reference needs.
 * They travel together because they are the answers to what the interactive
 * import would otherwise stop and ask: a class arrives at the level the builder
 * set, and only the first class in a multiclass build contributes its full
 * starting proficiencies — the rest contribute their multiclass ones, which is
 * the 5e rule and is also what Plutonium prompts for.
 */
export function orderedRefs(payload) {
  // A subrace entity is the whole species: 5etools merges the base race's
  // entries into it, so a hill dwarf carries Darkvision and Dwarven Resilience
  // as well as Dwarven Toughness. Both documents are still imported — the sheet
  // names them separately — but only one of them may contribute traits, or the
  // player gets Darkvision twice.
  const hasSubrace = Boolean(payload.race.subrace);
  const entries = [{ ref: payload.race.ref, dataOpts: {}, features: !hasSubrace }];
  if (hasSubrace) entries.push({ ref: payload.race.subrace, dataOpts: {} });

  for (const [index, entry] of payload.classes.entries()) {
    const level = entry.level;
    const proficiencyImportMode =
      index === 0 ? PROFICIENCY_IMPORT_MODE.primary : PROFICIENCY_IMPORT_MODE.multiclass;

    entries.push({ ref: entry.ref, dataOpts: { level, proficiencyImportMode }, featureLevel: level });
    // A subclass item carries no level of its own; the class item holds it.
    // Its features do need one — a level 3 Evoker has Sculpt Spells and not
    // Potent Cantrip — so the class's level travels with it separately from
    // `dataOpts`, which reaches Plutonium's converter untouched.
    if (entry.subclass) entries.push({ ref: entry.subclass, dataOpts: {}, featureLevel: level });
  }

  entries.push({ ref: payload.background.ref, dataOpts: {} });
  for (const feat of payload.feats ?? []) entries.push({ ref: feat.ref, dataOpts: {} });
  // Fighting styles, invocations, metamagic, maneuvers. They come after the
  // class that granted them, and before the spells an invocation can grant.
  for (const option of payload.optionalFeatures ?? []) entries.push({ ref: option.ref, dataOpts: {} });
  for (const spell of payload.spells ?? []) entries.push({ ref: spell.ref, dataOpts: {} });
  for (const item of payload.equipment ?? []) entries.push({ ref: item.ref, dataOpts: {} });

  return entries;
}

/**
 * The actor before anything is imported onto it.
 *
 * Only what Plutonium cannot know goes here: the name, the ability scores the
 * player assigned, and the values the builder derived. Everything else arrives
 * with the documents.
 */
export function baseActorData(payload) {
  const abilities = {};
  for (const [id, value] of Object.entries(payload.abilities)) {
    abilities[id] = { value };
  }

  return {
    name: payload.identity.characterName,
    type: "character",
    system: {
      abilities,
      attributes: {
        hp: { value: payload.derived.hp, max: payload.derived.hp },
      },
      details: {
        alignment: payload.identity.alignment ?? "",
        biography: { value: biographyHtml(payload.identity.biography) },
        ...appearanceDetails(payload.identity.biography),
      },
    },
    flags: {
      "bertinis-vault": {
        importedAt: new Date().toISOString(),
        rulesVersion: payload.rulesVersion,
        payloadVersion: payload.version,
      },
    },
  };
}

/**
 * The boxes the dnd5e sheet already draws for a character's description.
 *
 * `age`, `height`, `weight`, `eyes`, `hair`, `skin`, `gender`, `faith` and
 * `appearance` are fields of `system.details` — measured on a real exported
 * actor, all nine are there and all nine were empty strings. Writing them into
 * the biography blob instead would put the words on the sheet in a place no
 * box reads, which is the same as not filling them in.
 *
 * A field the player left blank is left alone rather than written as "", so an
 * import never blanks something already on the actor.
 */
export const APPEARANCE_FIELDS = [
  "age",
  "height",
  "weight",
  "eyes",
  "hair",
  "skin",
  "gender",
  "faith",
  "appearance",
];

export function appearanceDetails(biography) {
  const details = {};
  for (const field of APPEARANCE_FIELDS) {
    const value = biography?.[field];
    if (typeof value === "string" && value.trim()) details[field] = value.trim();
  }
  return details;
}

export function biographyHtml(biography) {
  if (!biography) return "";

  const lines = [
    ["Trait", biography.trait],
    ["Ideal", biography.ideal],
    ["Bond", biography.bond],
    ["Flaw", biography.flaw],
    ["Notes", biography.notes],
  ].filter(([, value]) => value);

  return lines.map(([label, value]) => `<p><strong>${label}:</strong> ${value}</p>`).join("");
}

/**
 * Stamp the ability a tool rolls, the way `dnd5e` stamps it itself.
 *
 * `system.tools` is a mapping field with no fixed keys and an ability default
 * of Intelligence, so a tool written without one rolls Intelligence — a lute
 * would be played with Intelligence and a set of thieves' tools picked with
 * it. The system's own advancement code reads `CONFIG.DND5E.tools[id].ability`
 * at this exact moment, so this reads the same thing rather than shipping a
 * copy of the table that could drift from the system the world is running.
 *
 * A key the running system does not know gets no ability, which leaves the
 * system's default in place rather than writing a guess.
 */
function applyToolAbility(updates, tool) {
  const ability = globalThis.CONFIG?.DND5E?.tools?.[tool]?.ability;
  if (ability) updates[`system.tools.${tool}.ability`] = ability;
}

/**
 * Proficiencies the actor carries as flags rather than as documents.
 *
 * Skills, tools, saves and languages are fields on the actor, so they are
 * written directly.
 *
 * Weapon and armour proficiencies used to be left out "by design", on the
 * belief that they came from the class and race documents Plutonium imports.
 * An imported actor disproved it: `traits.armorProf.value` and
 * `traits.weaponProf.value` both came back empty, and the character was
 * proficient with nothing — every attack short its proficiency bonus, and
 * every suit of armour worn at disadvantage on Strength and Dexterity with
 * spellcasting blocked.
 *
 * The reason is in the documents. A class item carries its grants as `Trait`
 * advancements, and an advancement applies when a character is levelled
 * through it. A direct import is precisely what does not do that — which is
 * the same reason the class features never arrive as items.
 */
export function proficiencyUpdates(payload) {
  const updates = {};

  for (const skill of payload.proficiencies.skills ?? []) {
    updates[`system.skills.${skill}.value`] = 1;
  }
  for (const skill of payload.proficiencies.expertise ?? []) {
    updates[`system.skills.${skill}.value`] = 2;
  }
  // Tools after skills and expertise after tools, so the doubled value is the
  // one that survives when a character is proficient in and expert with the
  // same tool.
  for (const tool of payload.proficiencies.tools ?? []) {
    updates[`system.tools.${tool}.value`] = 1;
    applyToolAbility(updates, tool);
  }
  for (const tool of payload.proficiencies.toolExpertise ?? []) {
    updates[`system.tools.${tool}.value`] = 2;
    applyToolAbility(updates, tool);
  }

  for (const ability of payload.proficiencies.savingThrows ?? []) {
    updates[`system.abilities.${ability}.proficient`] = 1;
  }

  // dnd5e checks armour with `armorProf.value.has("lgt")` and weapons with
  // `weaponProf.value` against either the category key or the weapon's own
  // base-item id. Both sets are already in those keys when they arrive; the
  // builder speaks Foundry's vocabulary rather than the book's.
  const armor = payload.proficiencies.armor ?? [];
  const weapons = payload.proficiencies.weapons ?? [];
  if (armor.length) updates["system.traits.armorProf.value"] = armor;
  if (weapons.length) updates["system.traits.weaponProf.value"] = weapons;

  // A language the system has a key for goes in the list it validates; one it
  // does not — a setting's own, or a secret like Thieves' Cant — goes in the
  // free-text field beside it rather than being dropped.
  const { known, custom } = partitionLanguages(payload.proficiencies.languages ?? []);
  if (known.length) updates["system.traits.languages.value"] = known;
  if (custom.length) updates["system.traits.languages.custom"] = custom.join(", ");

  return updates;
}

/**
 * The language keys `dnd5e` accepts.
 *
 * Duplicated from the contract rather than imported: this module ships into
 * Foundry as plain files with no bundler and no dependencies. The conformance
 * test asserts the two agree, which is what keeps the copy honest.
 */
const LANGUAGE_IDS = {
  common: "common", dwarvish: "dwarvish", elvish: "elvish", giant: "giant",
  gnomish: "gnomish", goblin: "goblin", halfling: "halfling", orc: "orc",
  abyssal: "abyssal", celestial: "celestial", draconic: "draconic",
  "deep speech": "deep", infernal: "infernal", primordial: "primordial",
  sylvan: "sylvan", undercommon: "undercommon", druidic: "druidic",
  "thieves' cant": "cant", "common sign language": "communal",
};

export function partitionLanguages(names) {
  const known = [];
  const custom = [];

  for (const name of names) {
    const id = LANGUAGE_IDS[name.trim().toLowerCase().replace(/\s+/g, " ")];
    if (id) {
      if (!known.includes(id)) known.push(id);
    } else if (name.trim() && !custom.includes(name.trim())) {
      custom.push(name.trim());
    }
  }

  return { known, custom };
}

/**
 * Values the builder computed, written after the documents land.
 *
 * The importers recalculate HP and AC as they attach class and armour, so these
 * are applied last: the builder owns the rules, and its numbers are the ones
 * the player saw when they made their choices.
 */
export function derivedUpdates(payload) {
  const updates = {
    "system.attributes.hp.value": payload.derived.hp,
    "system.attributes.hp.max": payload.derived.hp,
  };

  // The payload keys slots by the level they are — `{"1": 4}` — and the field
  // name is built here. It was once given field names and prefixed them again,
  // producing `system.spells.spellspell1`, so every character imported with no
  // slots at all. The conformance test is what proves the two agree now.
  if (payload.derived.spellcasting?.slots) {
    for (const [level, count] of Object.entries(payload.derived.spellcasting.slots)) {
      const key = level === "pact" ? "pact" : `spell${level}`;
      updates[`system.spells.${key}.value`] = count;
      updates[`system.spells.${key}.max`] = count;
    }
  }

  // A warlock's slots are cast at a level the count alone does not say.
  if (payload.derived.spellcasting?.pactLevel) {
    updates["system.spells.pact.level"] = payload.derived.spellcasting.pactLevel;
  }

  return updates;
}

/**
 * The per-character state of one imported item.
 *
 * Separate from the loop that applies it so it can be checked without a live
 * actor: whether armour arrives worn decides the armour class Foundry
 * computes, and that is worth a test rather than a reading.
 */
export function equipmentUpdates(entry) {
  const update = {};
  if (entry.quantity != null) update["system.quantity"] = entry.quantity;
  if (entry.equipped != null) update["system.equipped"] = entry.equipped;
  if (entry.attuned != null) update["system.attuned"] = entry.attuned;

  return update;
}

/**
 * Import a payload as a new actor.
 *
 * `onProgress` is called per reference so a long import can show what it is
 * doing. Failures are collected rather than thrown: a character missing one
 * item is more use to a player than no character at all.
 */
export async function importPayload(payload, { folderId = null, onProgress = () => {} } = {}) {
  const api = getPlutoniumApi();

  const actorData = baseActorData(payload);
  if (folderId) actorData.folder = folderId;

  const actor = await Actor.create(actorData);
  if (!actor) throw new Error("Foundry refused to create the actor.");

  const entries = orderedRefs(payload);
  const results = [];

  // The import is meant to be silent. If it is not, the window says so itself.
  let windows = [];
  const stopWatching = watchWindows({ label: payload.identity.characterName });

  try {
    for (const [index, entry] of entries.entries()) {
      const { ref, dataOpts } = entry;
      onProgress({ index, total: entries.length, ref });
      const result = await documentForRef({ ref, api, dataOpts });
      results.push(result);

      if (!result.ok) continue;

      const { _id, ...document } = markAsDirectImport(result.document);
      await actor.createEmbeddedDocuments("Item", [document]);

      // Spellcasting, Arcane Recovery, Darkvision: what the player actually
      // does with the class or species they picked. Added after their parent so
      // the sheet reads in the order the books do.
      for (const feature of await featuresFor({ entry, api })) {
        if (feature.error) {
          results.push({ ref, ok: false, reason: `${feature.name}: ${feature.error}` });
          continue;
        }
        const { _id: _featureId, ...featureDocument } = markAsDirectImport(feature.document);
        await actor.createEmbeddedDocuments("Item", [featureDocument]);
        results.push({ ref, ok: true, name: feature.name });
      }
    }
  } finally {
    windows = stopWatching();
  }

  await actor.update({ ...proficiencyUpdates(payload), ...derivedUpdates(payload) });
  await applyItemState(actor, payload);

  return {
    actor,
    imported: results.filter((r) => r.ok).length,
    failures: results.filter((r) => !r.ok),
    windows,
  };
}

/**
 * The features one imported document grants.
 *
 * Reloading the entity costs nothing: `DataLoader` caches, so this is the same
 * object the document was built from a moment ago rather than a second fetch.
 *
 * A failure here loses the features and not the character, which is the right
 * way round — a sheet missing Arcane Recovery is worth more than no sheet.
 */
async function featuresFor({ entry, api }) {
  if (entry.features === false) return [];

  try {
    const entity = await loadEntity(entry.ref);
    return await featureDocumentsFor({ api, entity, prop: entry.ref.prop, level: entry.featureLevel });
  } catch {
    return [];
  }
}

/**
 * Per-character item state.
 *
 * Quantity, equipped and prepared are properties of this character's copy, not
 * of the document Plutonium imported, so they are applied once the items exist.
 * Matching is by name because the importer assigns its own ids.
 */
async function applyItemState(actor, payload) {
  const updates = [];

  const byName = new Map();
  for (const item of actor.items) {
    if (!byName.has(item.name)) byName.set(item.name, item);
  }

  for (const entry of payload.equipment ?? []) {
    const item = findByRef(byName, entry.ref);
    if (!item) continue;

    const update = { _id: item.id, ...equipmentUpdates(entry) };
    if (Object.keys(update).length > 1) updates.push(update);
  }

  for (const entry of payload.spells ?? []) {
    const item = findByRef(byName, entry.ref);
    if (!item) continue;

    const update = { _id: item.id, ...spellUpdates(entry) };
    if (Object.keys(update).length > 1) updates.push(update);
  }

  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
}

/**
 * What has to change on a spell that Plutonium has already imported.
 *
 * Three things, and only one of them is about preparation. A species grants
 * its spells cast `innate`ly, a fixed number of times a day and without a
 * slot: importing one as an ordinary spell charges a tiefling a level 1 slot
 * for a Faerie Fire the rules hand over free. `system.method` is where dnd5e
 * keeps that, and `system.uses` is how many and how they come back.
 *
 * dnd5e sets `uses.max` from a formula string rather than a number, which is
 * why the count is written as one.
 *
 * And `system.ability`, where the grant states one of its own. A species
 * casts its spells with an ability the class may not have at all; measured in
 * dnd5e 5.3.3, `SpellData#availableAbilities` returns the spell's own where
 * it has one and falls back to the class's only otherwise.
 */
export function spellUpdates(entry) {
  const updates = {};

  if (entry.preparation) updates["system.prepared"] = preparationState(entry.preparation);
  if (entry.method) updates["system.method"] = entry.method;
  // dnd5e prefers the spell's own ability over the class's, which is the only
  // thing that gives a fighter's species cantrip a save DC: a fighter has no
  // spellcasting ability to fall back on.
  if (entry.ability) updates["system.ability"] = entry.ability;
  if (entry.uses) {
    updates["system.uses.max"] = String(entry.uses.max);
    updates["system.uses.spent"] = 0;
    // `recoverAll` rather than a formula: a spell that comes back once a day
    // comes back entirely, and dnd5e's own default for a recovery is this.
    updates["system.uses.recovery"] = [{ period: entry.uses.period, type: "recoverAll" }];
  }

  return updates;
}

/**
 * Whether a spell is prepared, as dnd5e records it.
 *
 * This was written to `system.preparation.prepared` as a boolean, which is
 * where dnd5e kept it before 5.1 and nowhere at all since. An exported actor
 * has no `preparation` key on any spell — the field is `system.prepared`, and
 * it is a number rather than a flag because there are three states and not two:
 * `DND5E.spellPreparationStates` is `unprepared: 0`, `prepared: 1`,
 * `always: 2`. The third is what a domain or patron spell gets, and it is the
 * difference between a cleric's domain spells costing them preparations and
 * not.
 *
 * So nothing landed. Every imported spell arrived unprepared, including on a
 * wizard whose whole class is deciding which ones are.
 *
 * The names are dnd5e's own, copied from `DND5E.spellPreparationStates` rather
 * than invented here, so a state that stops matching the system is a state
 * that fails to resolve instead of one that quietly writes the wrong number.
 * An unrecognised one reads as prepared, because a spell nobody can cast is a
 * worse wrong answer than one that is available a day early.
 */
export const PREPARATION_STATE = { unprepared: 0, prepared: 1, always: 2 };

export function preparationState(preparation) {
  return PREPARATION_STATE[preparation] ?? PREPARATION_STATE.prepared;
}

/**
 * Find an imported item for a reference.
 *
 * The hash's first segment is the entity name, url-encoded and lowercased, so
 * it can be decoded back into something comparable with what was imported.
 */
export function findByRef(byName, ref) {
  const [encodedName] = ref.hash.split("_");
  const name = decodeURIComponent(encodedName ?? "");

  for (const [itemName, item] of byName) {
    if (itemName.toLowerCase() === name) return item;
  }

  return null;
}
