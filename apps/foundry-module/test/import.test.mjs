import test from "node:test";
import assert from "node:assert/strict";

import {
  addItem,
  isRollableFormula,
  withoutUnrollableDamage,
  baseActorData,
  startingCurrency,
  appearanceDetails,
  biographyHtml,
  derivedUpdates,
  equipmentUpdates,
  findByRef,
  orderedRefs,
  proficiencyUpdates,
} from "../src/import.js";
import { markAsDirectImport } from "../src/plutonium.js";

const ref = (prop, page, name, source) => ({
  page,
  source,
  hash: `${encodeURIComponent(name.toLowerCase()).toLowerCase()}_${source.toLowerCase()}`,
  prop,
});

function payload(overrides = {}) {
  return {
    version: 1,
    rulesVersion: "2014",
    exportedAt: "2026-08-23T12:00:00.000Z",
    identity: { characterName: "Seraphina Vale", alignment: "Neutral Good" },
    race: { ref: ref("race", "races.html", "Half-Elf", "PHB") },
    classes: [
      {
        ref: ref("class", "classes.html", "Warlock", "PHB"),
        level: 5,
        subclass: ref("subclass", "classes.html", "The Fiend", "PHB"),
      },
    ],
    background: { ref: ref("background", "backgrounds.html", "Sage", "PHB") },
    abilities: { str: 8, dex: 14, con: 14, int: 12, wis: 10, cha: 17 },
    proficiencies: {
      skills: ["arcana", "deception"],
      languages: ["common", "infernal"],
      tools: [],
      savingThrows: ["wis", "cha"],
      expertise: [],
    },
    feats: [{ ref: ref("feat", "feats.html", "Alert", "PHB") }],
    optionalFeatures: [
      { ref: ref("optionalfeature", "optionalfeatures.html", "Agonizing Blast", "PHB") },
    ],
    spells: [{ ref: ref("spell", "spells.html", "Hex", "PHB"), prepared: true }],
    equipment: [{ ref: ref("item", "items.html", "Leather Armor", "PHB"), quantity: 1, equipped: true }],
    derived: {
      hp: 38,
      ac: 13,
      proficiencyBonus: 3,
      spellcasting: { ability: "cha", attackBonus: 6, saveDC: 14, slots: { 3: 2 } },
    },
    ...overrides,
  };
}

test("documents are imported in an order the importers can build on", () => {
  const entries = orderedRefs(payload());

  // Race, class and subclass and background come before anything that attaches
  // to them, because the importers derive proficiencies and progression there.
  assert.deepEqual(
    entries.map((e) => e.ref.prop),
    ["race", "class", "subclass", "background", "feat", "optionalfeature", "spell", "item"],
  );
});

test("a multiclass build keeps each class next to its own subclass", () => {
  const entries = orderedRefs(
    payload({
      classes: [
        { ref: ref("class", "classes.html", "Warlock", "PHB"), level: 3, subclass: ref("subclass", "classes.html", "The Fiend", "PHB") },
        { ref: ref("class", "classes.html", "Sorcerer", "PHB"), level: 2 },
      ],
    }),
  );

  assert.deepEqual(
    entries.map((e) => e.ref.hash),
    [
      "half-elf_phb",
      "warlock_phb",
      "the%20fiend_phb",
      "sorcerer_phb",
      "sage_phb",
      "alert_phb",
      "agonizing%20blast_phb",
      "hex_phb",
      "leather%20armor_phb",
    ],
  );
});

test("each class carries the level the builder set, so nothing has to ask", () => {
  const entries = orderedRefs(
    payload({
      classes: [
        { ref: ref("class", "classes.html", "Warlock", "PHB"), level: 3, subclass: ref("subclass", "classes.html", "The Fiend", "PHB") },
        { ref: ref("class", "classes.html", "Sorcerer", "PHB"), level: 2 },
      ],
    }),
  );

  const classes = entries.filter((e) => e.ref.prop === "class");
  assert.deepEqual(classes.map((e) => e.dataOpts.level), [3, 2]);

  // The first class grants its full starting proficiencies; a second class
  // grants only its multiclass ones. Leaving this unset grants neither.
  assert.deepEqual(classes.map((e) => e.dataOpts.proficiencyImportMode), [1, 0]);

  // A subclass item has no level of its own — the class item holds it.
  const subclass = entries.find((e) => e.ref.prop === "subclass");
  assert.deepEqual(subclass.dataOpts, {});
});

test("a subrace is imported alone, because dnd5e 6 takes a single species", () => {
  // Mark of Storm arrived as a plain half-elf: the base race went in first and
  // dnd5e refused the subrace as a second species.
  const storm = ref("subrace", "races.html", "Half-Elf (Variant; Mark of Storm)", "ERLW");
  const entries = orderedRefs(payload({ race: { ref: ref("race", "races.html", "Half-Elf", "PHB"), subrace: storm } }));

  const species = entries.filter((e) => e.ref.prop === "race" || e.ref.prop === "subrace");
  assert.deepEqual(species.map((e) => e.ref), [storm]);
  assert.notEqual(species[0].features, false);
});

test("a payload with no optional collections still yields the required refs", () => {
  const bare = payload();
  delete bare.feats;
  delete bare.optionalFeatures;
  delete bare.spells;
  delete bare.equipment;

  assert.equal(orderedRefs(bare).length, 4);
});

test("every document is marked so Plutonium does not intercept it on the way in", () => {
  // Plutonium hooks `preCreateItem` for class, subclass, race, background,
  // feat, item and optionalfeature. Without this flag it stops each one, asks
  // whether to use the importer, and opens the Charactermancer — no matter how
  // quietly the document was built.
  const marked = markAsDirectImport({
    name: "Warlock",
    type: "class",
    flags: { plutonium: { propDroppable: "class", source: "PHB" } },
  });

  assert.equal(marked.flags.plutonium.isDirectImport, true);
  // The rest of Plutonium's flags are what the hook matches on, and what the
  // sheet reads afterwards. They survive.
  assert.equal(marked.flags.plutonium.propDroppable, "class");
  assert.equal(marked.flags.plutonium.source, "PHB");
});

test("marking a document leaves other modules' flags alone", () => {
  const marked = markAsDirectImport({ name: "Hex", flags: { "some-other-module": { keep: 1 } } });

  assert.deepEqual(marked.flags["some-other-module"], { keep: 1 });
  assert.equal(marked.flags.plutonium.isDirectImport, true);
});

test("a document with no flags at all still gets marked", () => {
  assert.equal(markAsDirectImport({ name: "Alert" }).flags.plutonium.isDirectImport, true);
});

test("the base actor carries only what Plutonium cannot know", () => {
  const actor = baseActorData(payload());

  assert.equal(actor.name, "Seraphina Vale");
  assert.equal(actor.type, "character");
  assert.equal(actor.system.abilities.cha.value, 17);
  assert.equal(actor.system.attributes.hp.max, 38);
  assert.equal(actor.system.details.alignment, "Neutral Good");

  // No items: every one of those arrives as an imported document.
  assert.equal(actor.items, undefined);
});

test("the actor is stamped with what produced it", () => {
  const flags = baseActorData(payload()).flags["bertinis-vault"];

  assert.equal(flags.rulesVersion, "2014");
  assert.equal(flags.payloadVersion, 1);
  assert.ok(Date.parse(flags.importedAt));
});

test("an unaligned character does not get a literal undefined", () => {
  const bare = payload({ identity: { characterName: "Nameless" } });
  assert.equal(baseActorData(bare).system.details.alignment, "");
});

test("biography renders only the fields that were filled in", () => {
  const html = biographyHtml({ trait: "Writes everything down.", flaw: "Trusts books over people." });

  assert.match(html, /<strong>Trait:<\/strong> Writes everything down\./);
  assert.match(html, /<strong>Flaw:<\/strong>/);
  assert.ok(!html.includes("Ideal"));
  assert.equal(biographyHtml(undefined), "");
  assert.equal(biographyHtml({}), "");
});

test("chosen skills, saves and languages become actor updates", () => {
  const updates = proficiencyUpdates(payload());

  assert.equal(updates["system.skills.arcana.value"], 1);
  assert.equal(updates["system.skills.deception.value"], 1);
  assert.equal(updates["system.abilities.cha.proficient"], 1);
  assert.deepEqual(updates["system.traits.languages.value"], ["common", "infernal"]);
});

test("expertise is a second rank, not a duplicate proficiency", () => {
  const build = payload();
  build.proficiencies.expertise = ["arcana"];

  assert.equal(proficiencyUpdates(build)["system.skills.arcana.value"], 2);
});

test("weapon and armour proficiencies are left to the class documents", () => {
  const serialized = JSON.stringify(proficiencyUpdates(payload()));

  assert.ok(!serialized.includes("weaponProf"));
  assert.ok(!serialized.includes("armorProf"));
});

test("no proficiencies produces no updates rather than empty writes", () => {
  const bare = payload({
    proficiencies: { skills: [], languages: [], tools: [], savingThrows: [], expertise: [] },
  });

  assert.deepEqual(proficiencyUpdates(bare), {});
});

test("the builder's hp wins over whatever the importers computed", () => {
  const updates = derivedUpdates(payload());

  assert.equal(updates["system.attributes.hp.value"], 38);
  assert.equal(updates["system.attributes.hp.max"], 38);
});

test("spell slots are written per level", () => {
  const updates = derivedUpdates(payload());

  assert.equal(updates["system.spells.spell3.value"], 2);
  assert.equal(updates["system.spells.spell3.max"], 2);
});

test("pact slots keep their own key rather than becoming spellpact", () => {
  const build = payload();
  build.derived.spellcasting.slots = { pact: 2 };

  const updates = derivedUpdates(build);

  assert.equal(updates["system.spells.pact.value"], 2);
  assert.equal(updates["system.spells.spellpact.value"], undefined);
});

test("a character with no spellcasting gets no slot updates", () => {
  const build = payload();
  delete build.derived.spellcasting;

  assert.equal(JSON.stringify(derivedUpdates(build)).includes("spells"), false);
});

test("an imported item is matched back to the reference that asked for it", () => {
  const items = new Map([
    ["Leather Armor", { id: "abc", name: "Leather Armor" }],
    ["Dagger", { id: "def", name: "Dagger" }],
  ]);

  const found = findByRef(items, ref("item", "items.html", "Leather Armor", "PHB"));
  assert.equal(found.id, "abc");
});

test("matching survives the encoding a hash puts a name through", () => {
  const items = new Map([["Heroes' Feast", { id: "xyz", name: "Heroes' Feast" }]]);

  assert.equal(findByRef(items, ref("spell", "spells.html", "Heroes' Feast", "PHB")).id, "xyz");
});

test("matching is case-insensitive, since the hash lowercases", () => {
  const items = new Map([["LEATHER ARMOR", { id: "up", name: "LEATHER ARMOR" }]]);

  assert.equal(findByRef(items, ref("item", "items.html", "Leather Armor", "PHB")).id, "up");
});

test("an item that never arrived returns null instead of a wrong match", () => {
  const items = new Map([["Dagger", { id: "def", name: "Dagger" }]]);

  assert.equal(findByRef(items, ref("item", "items.html", "Plate Armor", "PHB")), null);
});

test("tools land on the actor, keyed as the system keys them", () => {
  // Nothing wrote these before. `payload.proficiencies.tools` travelled the
  // whole way and was dropped on arrival, so every character exported from
  // this builder reached the table with no tool proficiency at all.
  const build = payload();
  build.proficiencies.tools = ["thief", "lute"];

  const updates = proficiencyUpdates(build);

  assert.equal(updates["system.tools.thief.value"], 1);
  assert.equal(updates["system.tools.lute.value"], 1);
});

test("a tool's ability comes from the running system, not from us", () => {
  // `system.tools` defaults its ability to Intelligence, so a lute written
  // without one is played with Intelligence. dnd5e's own advancement code
  // reads `CONFIG.DND5E.tools[id].ability` at this moment; so does this.
  const previous = globalThis.CONFIG;
  globalThis.CONFIG = { DND5E: { tools: { thief: { ability: "dex" }, lute: { ability: "cha" } } } };

  try {
    const build = payload();
    build.proficiencies.tools = ["thief", "lute", "unknown-to-the-system"];

    const updates = proficiencyUpdates(build);

    assert.equal(updates["system.tools.thief.ability"], "dex");
    assert.equal(updates["system.tools.lute.ability"], "cha");
    // A key the running system does not know keeps its proficiency and gets no
    // ability, which leaves the system's own default rather than a guess.
    assert.equal(updates["system.tools.unknown-to-the-system.value"], 1);
    assert.ok(!("system.tools.unknown-to-the-system.ability" in updates));
  } finally {
    globalThis.CONFIG = previous;
  }
});

test("tool expertise doubles the tool it names", () => {
  const build = payload();
  build.proficiencies.tools = ["thief"];
  build.proficiencies.toolExpertise = ["thief"];

  // Written after the proficiency, so the doubled value is the one that
  // survives rather than being overwritten by the plain one.
  assert.equal(proficiencyUpdates(build)["system.tools.thief.value"], 2);
});

test("the description lands in the boxes dnd5e draws, not in the biography blob", () => {
  /*
   * `age`, `height`, `weight`, `eyes`, `hair`, `skin`, `gender`, `faith` and
   * `appearance` are all fields of `system.details` — measured on a real
   * exported actor, all nine are there. Written into the biography HTML they
   * would be words on the sheet in a place no box reads, which is the same as
   * not filling them in.
   */
  const details = appearanceDetails({
    age: "27",
    height: "1,75 m",
    eyes: "Grises",
    appearance: "Una cicatriz que le cruza la ceja.",
    trait: "Writes everything down.",
  });

  assert.deepEqual(details, {
    age: "27",
    height: "1,75 m",
    eyes: "Grises",
    appearance: "Una cicatriz que le cruza la ceja.",
  });
});

test("a box the player left blank is left alone rather than blanked", () => {
  // Writing "" would wipe whatever the actor already had in it.
  assert.deepEqual(appearanceDetails({ age: "", height: "   ", eyes: "Grises" }), {
    eyes: "Grises",
  });
  assert.deepEqual(appearanceDetails(undefined), {});
});

test("the actor is built with the description on it", () => {
  const actor = baseActorData({
    version: 1,
    rulesVersion: "5e-2014",
    identity: {
      characterName: "Rathma",
      biography: { trait: "Writes everything down.", eyes: "Grises", age: "27" },
    },
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    derived: { hp: 12, ac: 14, proficiencyBonus: 2 },
  });

  assert.equal(actor.system.details.eyes, "Grises");
  assert.equal(actor.system.details.age, "27");
  // And the personality lines still go where they always did.
  assert.match(actor.system.details.biography.value, /Writes everything down/);
});

test("the money the character chose reaches the box the sheet adds up", () => {
  // dnd5e keys the purse `pp`/`gp`/`ep`/`sp`/`cp` on `system.currency`, and
  // the builder already split the total.
  const actor = baseActorData(payload({ currency: { pp: 0, gp: 150, ep: 0, sp: 5, cp: 2 } }));

  assert.deepEqual(actor.system.currency, { gp: 150, sp: 5, cp: 2 });
});

test("an empty purse writes nothing rather than five zeroes", () => {
  /*
   * A payload written before the field existed carries none, and blanking an
   * actor's money because an old build said nothing about it is a loss the
   * player never asked for.
   */
  assert.equal(baseActorData(payload()).system.currency, undefined);
  assert.deepEqual(startingCurrency({ pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 }), {});
  assert.deepEqual(startingCurrency(undefined), {});
});

test("a coin that is not a whole coin is left out rather than written", () => {
  // The schema refuses these, but the module reads payloads it did not write.
  assert.deepEqual(startingCurrency({ gp: 1.5, sp: "many", cp: -3, ep: 2 }), { currency: { ep: 2 } });
});

test("mastery is written to its own set, not to the proficiency beside it", () => {
  // `weaponProf.value` says which weapons the character swings with their
  // bonus; `weaponProf.mastery.value` says which ones the 2024 feature applies
  // to. Foundry tests the second with `.has(baseItem)`.
  const build = payload();
  build.proficiencies.masteries = ["longsword", "shortbow"];

  const updates = proficiencyUpdates(build);

  assert.deepEqual(updates["system.traits.weaponProf.mastery.value"], ["longsword", "shortbow"]);
  assert.notDeepEqual(updates["system.traits.weaponProf.value"], ["longsword", "shortbow"]);
});

test("no mastery writes no key, so a sheet that has one keeps it", () => {
  assert.equal(
    "system.traits.weaponProf.mastery.value" in proficiencyUpdates(payload()),
    false,
  );
});

test("an attuned item reaches the sheet attuned", () => {
  // Foundry counts the actor's attunement from the items that say they are
  // attuned. A Cloak of Protection with the box unticked grants nothing.
  assert.deepEqual(
    equipmentUpdates({ ref: ref("item", "items.html", "Cloak of Protection", "DMG"), quantity: 1, attuned: true }),
    { "system.quantity": 1, "system.attuned": true },
  );
});

/*
 * A document dnd5e refuses is dropped, not thrown.
 *
 * Measured on a live import: thirty-four entries announced, thirty-three on
 * the actor, and no message anywhere. The weapon carried a damage part whose
 * formula dnd5e could not evaluate, the system reported it through Foundry's
 * error handler, and `createEmbeddedDocuments` answered with the rest of the
 * batch as if nothing had happened.
 */
test("a document Foundry refuses is reported rather than lost", async () => {
  const actor = { createEmbeddedDocuments: async () => [] };

  const result = await addItem(actor, { name: "Longbow" });

  assert.equal(result.ok, false);
  assert.match(result.reason, /console/);
});

test("a document Foundry accepts says so", async () => {
  const actor = { createEmbeddedDocuments: async (_type, [doc]) => [doc] };

  assert.deepEqual(await addItem(actor, { name: "Longbow" }), { ok: true });
});

test("a validation mode that throws does not end the import", async () => {
  // Foundry can be configured to throw instead of reporting. The player's
  // character is worth more than the one item that failed, either way.
  const actor = {
    createEmbeddedDocuments: async () => {
      throw new Error("Unresolved StringTerm p requested for evaluation");
    },
  };

  const result = await addItem(actor, { name: "Longbow" });

  assert.equal(result.ok, false);
  assert.match(result.reason, /StringTerm p/);
});


/*
 * The Oversized Longbow (WDH), copied out of Plutonium's `foundry-items.json`
 * exactly as it ships. Two custom parts, and the second one is the string "p"
 * with a damage type of "i" — `2d6 piercing` cut into characters by whatever
 * generated the entry. dnd5e refuses the part and the bow goes with it.
 */
const oversizedLongbow = () => ({
  name: "Oversized Longbow",
  system: {
    activities: {
      dnd5eactivity000: {
        type: "damage",
        damage: {
          parts: [
            { custom: { enabled: true, formula: "2" }, types: ["d"] },
            { custom: { enabled: true, formula: "p" }, types: ["i"] },
          ],
        },
      },
    },
  },
});

test("a bare word is not a formula", () => {
  assert.equal(isRollableFormula("p"), false);
  assert.equal(isRollableFormula("piercing"), false);
  assert.equal(isRollableFormula(""), false);
  assert.equal(isRollableFormula(null), false);
});

test("dice, references and arithmetic are formulas", () => {
  for (const formula of [
    "2d6",
    "1d8 + 2",
    "2",
    "@abilities.dex.mod",
    "4d6kh3",
    "floor(@classes.ranger.levels / 2)",
    "2d6 + @mod - 1",
  ]) {
    assert.equal(isRollableFormula(formula), true, formula);
  }
});

test("only the unrollable part is taken out", () => {
  const repaired = withoutUnrollableDamage(oversizedLongbow());

  assert.deepEqual(repaired.dropped, ["p"]);
  assert.deepEqual(
    repaired.document.system.activities.dnd5eactivity000.damage.parts,
    [{ custom: { enabled: true, formula: "2" }, types: ["d"] }],
  );
});

test("repairing does not touch the document it was handed", () => {
  const document = oversizedLongbow();
  withoutUnrollableDamage(document);

  assert.equal(document.system.activities.dnd5eactivity000.damage.parts.length, 2);
});

test("a document with nothing wrong is left alone", () => {
  assert.equal(withoutUnrollableDamage({ name: "Longbow" }), null);
  assert.equal(
    withoutUnrollableDamage({
      name: "Longbow",
      system: {
        activities: {
          a: { damage: { parts: [{ custom: { enabled: true, formula: "1d8" } }] } },
        },
      },
    }),
    null,
  );
});

test("a weapon refused for one bad damage part still reaches the sheet", async () => {
  const written = [];
  const actor = {
    createEmbeddedDocuments: async (_type, [doc]) => {
      const parts = Object.values(doc.system.activities)[0].damage.parts;
      // Stand in for dnd5e: refuse the whole document over the part it cannot
      // evaluate, the way it refuses the real one.
      if (parts.some((part) => part.custom?.formula === "p")) return [];
      written.push(doc);
      return [doc];
    },
  };

  const result = await addItem(actor, oversizedLongbow());

  assert.deepEqual(result, { ok: true, repaired: ["p"] });
  assert.equal(written.length, 1);
  assert.equal(written[0].system.activities.dnd5eactivity000.damage.parts.length, 1);
});

test("a refusal we cannot explain is still reported as a refusal", async () => {
  // Repairing is a guess. When the guess is wrong, the player hears about the
  // refusal itself, not about the document we invented trying to fix it.
  const actor = { createEmbeddedDocuments: async () => [] };

  const result = await addItem(actor, oversizedLongbow());

  assert.equal(result.ok, false);
  assert.match(result.reason, /console/);
});

test("the Shield spell does not take the shield's equipped state", async () => {
  // Spells import before equipment, so the spell is the first "Shield" on the
  // actor. First-match by name wrote `equipped` onto the spell and left the
  // shield as Plutonium had it.
  const { itemStateUpdates } = await import("../src/import.js");
  const items = [
    { id: "spell", name: "Shield", type: "spell" },
    { id: "armour", name: "Shield", type: "equipment" },
  ];
  const updates = itemStateUpdates(items, {
    equipment: [{ ref: ref("item", "items.html", "Shield", "PHB"), quantity: 1, equipped: true }],
    spells: [{ ref: ref("spell", "spells.html", "Shield", "PHB"), preparation: "prepared" }],
  });

  const forArmour = updates.find((update) => update._id === "armour");
  const forSpell = updates.find((update) => update._id === "spell");
  assert.equal(forArmour["system.equipped"], true);
  assert.equal(forSpell["system.equipped"], undefined);
  assert.equal(forSpell["system.prepared"], 1);
});

test("two entries of the same name each reach their own item", async () => {
  const { itemStateUpdates } = await import("../src/import.js");
  const items = [
    { id: "worn", name: "Leather Armor", type: "equipment" },
    { id: "spare", name: "Leather Armor", type: "equipment" },
  ];
  const leather = ref("item", "items.html", "Leather Armor", "PHB");
  const updates = itemStateUpdates(items, {
    equipment: [
      { ref: leather, quantity: 1, equipped: true },
      { ref: leather, quantity: 1, equipped: false },
    ],
  });

  assert.deepEqual(
    updates.map((update) => [update._id, update["system.equipped"]]),
    [
      ["worn", true],
      ["spare", false],
    ],
  );
});

test("a class feature that shares an item's name is left alone", async () => {
  const { itemStateUpdates } = await import("../src/import.js");
  const items = [
    { id: "feature", name: "Shield", type: "feat" },
    { id: "armour", name: "Shield", type: "equipment" },
  ];
  const updates = itemStateUpdates(items, {
    equipment: [{ ref: ref("item", "items.html", "Shield", "PHB"), equipped: true }],
  });

  assert.deepEqual(updates.map((update) => update._id), ["armour"]);
});
