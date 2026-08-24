/**
 * Turning a payload into an actor.
 *
 * The order matters. Race, class and background are imported first because
 * Plutonium's importers attach proficiencies, features and spell progression as
 * a side effect of importing those documents; adding spells and gear before
 * them would mean writing onto an actor that is still changing shape.
 */

import { getPlutoniumApi, importRefOntoActor } from "./plutonium.js";

/** Everything a payload asks to be imported, in the order it must happen. */
export function orderedRefs(payload) {
  const refs = [payload.race.ref];
  if (payload.race.subrace) refs.push(payload.race.subrace);

  for (const entry of payload.classes) {
    refs.push(entry.ref);
    if (entry.subclass) refs.push(entry.subclass);
  }

  refs.push(payload.background.ref);
  for (const feat of payload.feats ?? []) refs.push(feat.ref);
  for (const spell of payload.spells ?? []) refs.push(spell.ref);
  for (const item of payload.equipment ?? []) refs.push(item.ref);

  return refs;
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
 * Proficiencies the player chose from a list.
 *
 * Skills and saves are flags on the actor rather than documents, so they are
 * written directly. Weapon and armour proficiencies are absent by design: they
 * come from the class and race documents, and writing our own over them would
 * fight with what Plutonium just imported.
 */
export function proficiencyUpdates(payload) {
  const updates = {};

  for (const skill of payload.proficiencies.skills ?? []) {
    updates[`system.skills.${skill}.value`] = 1;
  }
  for (const skill of payload.proficiencies.expertise ?? []) {
    updates[`system.skills.${skill}.value`] = 2;
  }
  for (const ability of payload.proficiencies.savingThrows ?? []) {
    updates[`system.abilities.${ability}.proficient`] = 1;
  }

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

  const refs = orderedRefs(payload);
  const helper = new api.importer.ActorMultiImportHelper({ actor });
  const results = [];

  for (const [index, ref] of refs.entries()) {
    onProgress({ index, total: refs.length, ref });
    results.push(await importRefOntoActor({ ref, actor, api, helper }));
  }

  await helper.pDoFinalize();

  await actor.update({ ...proficiencyUpdates(payload), ...derivedUpdates(payload) });
  await applyItemState(actor, payload);

  return {
    actor,
    imported: results.filter((r) => r.ok).length,
    failures: results.filter((r) => !r.ok),
  };
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
    if (entry.prepared == null) continue;
    const item = findByRef(byName, entry.ref);
    if (item) updates.push({ _id: item.id, "system.preparation.prepared": entry.prepared });
  }

  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
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
