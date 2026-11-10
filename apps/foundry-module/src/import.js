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
      ...startingCurrency(payload.currency),
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

/**
 * The purse, as `system.currency`.
 *
 * dnd5e keys it `pp`, `gp`, `ep`, `sp`, `cp` and stores whole coins, and the
 * builder already split the total — the character who chose 150 gold over a
 * greataxe chose a number, and it belongs in the box the sheet adds up.
 *
 * An empty purse writes nothing at all rather than five zeroes: a payload
 * exported before this field existed carries none, and blanking an actor's
 * money because an old build said nothing about it would be a loss the player
 * never asked for.
 */
export const CURRENCY_KEYS = ["pp", "gp", "ep", "sp", "cp"];

export function startingCurrency(currency) {
  const coins = {};
  for (const key of CURRENCY_KEYS) {
    const value = currency?.[key];
    if (Number.isInteger(value) && value > 0) coins[key] = value;
  }

  return Object.keys(coins).length ? { currency: coins } : {};
}

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

  // Mastery is not a proficiency, and dnd5e keeps it in its own set beside
  // one: `weaponProf.mastery.value`, tested with `.has(baseItem)` against the
  // weapon's id. Writing the mastery property there — "Vex", "Topple" — puts a
  // string in the set that no weapon will ever match, which looks filled in and
  // does nothing.
  const masteries = payload.proficiencies.masteries ?? [];
  if (masteries.length) updates["system.traits.weaponProf.mastery.value"] = masteries;

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
 * Put one resolved document on the actor, and say whether it landed.
 *
 * The return value is the whole point. `createEmbeddedDocuments` does not
 * throw when a document fails the system's validation: dnd5e reports the
 * failure through Foundry's error handler, drops that entry from the batch,
 * and answers with the documents it did create. So an import could announce
 * thirty-four entries, write thirty-three, and say nothing — which is what
 * happened to a longbow-carrying ranger whose weapon carried a damage part
 * dnd5e refused (`Unresolved StringTerm p requested for evaluation`).
 *
 * A silent drop is the worst shape a failure can have here. The player has no
 * reason to count items, the sheet looks ordinary, and the thing they will
 * notice is that an attack they expected is not there — at the table, mid
 * session, with nothing to point at.
 */
/**
 * A formula Foundry can actually roll.
 *
 * dnd5e keeps a custom damage part as a string and rolls it. Foundry parses a
 * bare word into a `StringTerm`, which parses cleanly and then refuses to
 * evaluate — so the document looks fine until dnd5e validates it on the way
 * in, and then the whole item is thrown out.
 *
 * The test is by elimination: take out the dice, the `@` references, the roll
 * functions and the arithmetic, and anything still standing is a word with no
 * business in a formula.
 */
const REFERENCE = /@[\w.[\]]+/g;
const DICE_TERM = /\d*d\d+(?:[a-z]+[\d<>=]*)*/gi;
const ROLL_FUNCTIONS = /\b(?:floor|ceil|round|abs|min|max|clamp|pow|sqrt)\b/gi;
const ONLY_ARITHMETIC = /^[\s\d+\-*/%^(),.[\]]*$/;

export function isRollableFormula(formula) {
  const text = `${formula ?? ""}`.trim();
  if (!text) return false;

  const remainder = text
    .replace(REFERENCE, "")
    .replace(DICE_TERM, "")
    .replace(ROLL_FUNCTIONS, "");

  return ONLY_ARITHMETIC.test(remainder);
}

/**
 * The same document without the damage parts Foundry cannot roll.
 *
 * Returns null when there is nothing to take out, so the caller can tell "I
 * repaired it" from "I have no idea what is wrong with this".
 *
 * This exists because of Plutonium's own `foundry-items.json`, where the
 * Oversized Longbow (WDH) carries `{formula: "2", types: ["d"]}` and
 * `{formula: "p", types: ["i"]}` — the string `2d6 piercing` sliced into
 * characters by whatever generated the entry. dnd5e refuses the second part
 * and takes the weapon with it. Dropping a rider we could never have rolled
 * costs the player nothing; losing the bow costs them an attack, at the table,
 * with nothing to point at.
 */
export function withoutUnrollableDamage(document) {
  const activities = document?.system?.activities;
  if (!activities || typeof activities !== "object") return null;

  const dropped = [];
  const copy = structuredClone(document);

  for (const activity of Object.values(copy.system.activities)) {
    const parts = activity?.damage?.parts;
    if (!Array.isArray(parts)) continue;

    activity.damage.parts = parts.filter((part) => {
      if (!part?.custom?.enabled) return true;
      if (isRollableFormula(part.custom.formula)) return true;

      dropped.push(part.custom.formula);
      return false;
    });
  }

  return dropped.length ? { document: copy, dropped } : null;
}

export async function addItem(actor, document) {
  const attempt = await writeItem(actor, document);
  if (attempt.ok) return attempt;

  // Refused. Before giving up on the whole item, try it again without the
  // damage parts nothing could have rolled: the refusal is usually one bad
  // rider on an otherwise ordinary weapon.
  const repaired = withoutUnrollableDamage(document);
  if (!repaired) return attempt;

  const retry = await writeItem(actor, repaired.document);
  // Still refused, for some reason we did not guess. Report the first refusal:
  // the second one is about a document the player never asked for.
  if (!retry.ok) return attempt;

  return { ok: true, repaired: repaired.dropped };
}

async function writeItem(actor, document) {
  try {
    const [created] = await actor.createEmbeddedDocuments("Item", [document]);
    if (created) return { ok: true };

    return {
      ok: false,
      reason: "Foundry refused the document. The console has the validation error.",
    };
  } catch (error) {
    // Some validation modes throw rather than report. Both mean the same thing
    // to the player, and neither should end the import.
    return { ok: false, reason: error?.message ?? String(error) };
  }
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
  // Documents that only landed because we took something out of them. Not a
  // failure and not a success worth staying quiet about.
  const repairs = [];

  // The import is meant to be silent. If it is not, the window says so itself.
  let windows = [];
  const stopWatching = watchWindows({ label: payload.identity.characterName });

  try {
    for (const [index, entry] of entries.entries()) {
      const { ref, dataOpts } = entry;
      onProgress({ index, total: entries.length, ref });
      const result = await documentForRef({ ref, api, dataOpts });

      if (!result.ok) {
        results.push(result);
        continue;
      }

      const { _id, ...document } = markAsDirectImport(result.document);
      const written = await addItem(actor, document);

      if (!written.ok) {
        // Named by what the player asked for, not by the document that failed:
        // "Longbow" is a thing they chose, and the document is an id.
        results.push({ ref, ok: false, reason: `${result.document?.name ?? ref.name}: ${written.reason}` });
        continue;
      }

      results.push(result);
      if (written.repaired) {
        repairs.push({ name: result.document?.name ?? ref.name, dropped: written.repaired });
      }

      // Spellcasting, Arcane Recovery, Darkvision: what the player actually
      // does with the class or species they picked. Added after their parent so
      // the sheet reads in the order the books do.
      for (const feature of await featuresFor({ entry, api })) {
        if (feature.error) {
          results.push({ ref, ok: false, reason: `${feature.name}: ${feature.error}` });
          continue;
        }
        const { _id: _featureId, ...featureDocument } = markAsDirectImport(feature.document);
        const featureWritten = await addItem(actor, featureDocument);

        if (!featureWritten.ok) {
          results.push({ ref, ok: false, reason: `${feature.name}: ${featureWritten.reason}` });
          continue;
        }

        results.push({ ref, ok: true, name: feature.name });
        if (featureWritten.repaired) {
          repairs.push({ name: feature.name, dropped: featureWritten.repaired });
        }
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
    repairs,
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
  const updates = itemStateUpdates([...actor.items], payload);
  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
}

/** dnd5e's item types for things a character carries, as opposed to knows. */
export const PHYSICAL_ITEM_TYPES = new Set([
  "weapon",
  "equipment",
  "consumable",
  "tool",
  "loot",
  "container",
]);

/**
 * The per-item updates, each entry matched to its own item.
 *
 * Matched by name, as before, but no longer to the first item of that name.
 * Two things went wrong with first-match:
 *
 * - **A spell and an item can share a name.** Spells are imported before
 *   equipment, so an Eldritch Knight's Shield spell was the first "Shield" on
 *   the actor: the shield's `equipped` and `quantity` were written onto the
 *   spell, and the shield itself kept whatever Plutonium gave it.
 * - **Two entries can share a name** and then both updates landed on one item
 *   and the second copy got none.
 *
 * So equipment only matches what a character carries, spells only match
 * spells, and an item that already took an entry's state is not reused. An
 * item with no type — a test double — matches either, which is what the old
 * behaviour was.
 */
export function itemStateUpdates(items, payload) {
  const used = new Set();
  const updates = [];

  const take = (ref, accepts) => {
    const name = refName(ref);
    const item = items.find(
      (candidate) =>
        !used.has(candidate.id) &&
        (candidate.type === undefined || accepts(candidate.type)) &&
        `${candidate.name ?? ""}`.toLowerCase() === name,
    );
    if (item) used.add(item.id);
    return item ?? null;
  };

  for (const entry of payload.equipment ?? []) {
    const item = take(entry.ref, (type) => PHYSICAL_ITEM_TYPES.has(type));
    if (!item) continue;

    const update = { _id: item.id, ...equipmentUpdates(entry) };
    if (Object.keys(update).length > 1) updates.push(update);
  }

  for (const entry of payload.spells ?? []) {
    const item = take(entry.ref, (type) => type === "spell");
    if (!item) continue;

    const update = { _id: item.id, ...spellUpdates(entry) };
    if (Object.keys(update).length > 1) updates.push(update);
  }

  return updates;
}

/** The entity name a reference's hash carries, decoded and lowercased. */
function refName(ref) {
  const [encodedName] = `${ref?.hash ?? ""}`.split("_");
  return decodeURIComponent(encodedName ?? "").toLowerCase();
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
