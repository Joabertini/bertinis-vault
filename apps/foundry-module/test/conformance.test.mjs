/**
 * The builder and the module, checked against each other.
 *
 * Every other test here runs against a hand-written payload. That payload is
 * what the module's author believed the builder emits, and for a long time it
 * was not: slots were keyed one way and read another, skills travelled as
 * display labels, and armour class was carried and dropped. All three passed
 * every test on both sides, because no test ever put the two ends together.
 *
 * So this file writes no fixture. It derives a real build, converts it exactly
 * as the web app does, and asserts on what the module produces from it. A
 * fixture cannot drift from the builder here, because there is no fixture.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { deriveCharacterBuild } from "@bertinis-vault/domain";
import { RefResolver, buildToPayload, collections } from "@bertinis-vault/vetools-index";

import {
  baseActorData,
  derivedUpdates,
  equipmentUpdates,
  PREPARATION_STATE,
  preparationState,
  spellUpdates,
  proficiencyUpdates,
} from "../src/import.js";

const now = new Date().toISOString();

/** A build the way the web app assembles one, converted the way it converts. */
function payloadFor(overrides = {}) {
  const scores = { str: 8, dex: 14, con: 14, int: 16, wis: 12, cha: 10, ...(overrides.scores ?? {}) };

  const build = deriveCharacterBuild({
    meta: {
      rulesVersion: overrides.rulesVersion ?? "5e-2014",
      sourceProfile: "vault-v1",
      createdAt: now,
      updatedAt: now,
    },
    identity: { characterName: "Conformance" },
    ancestry: { raceId: "human" },
    classing: { classes: [{ classId: overrides.classId ?? "wizard", level: overrides.level ?? 5 }] },
    background: { backgroundId: "sage", grantedFeatIds: [] },
    abilities: { generationMethod: "manual", base: scores, final: scores },
    choices: {
      feats: [],
      proficiencies: [],
      spells: [],
      equipment: [],
      features: [],
      ...(overrides.weaponProficiencies
        ? { weaponProficiencies: overrides.weaponProficiencies }
        : {}),
      ...(overrides.armorProficiencies
        ? { armorProficiencies: overrides.armorProficiencies }
        : {}),
      normalized: {
        feats: [],
        spells: [],
        features: [],
        equipment: overrides.equipment ?? [],
        proficiencies: overrides.proficiencies ?? [],
      },
    },
  });

  const rulesVersion = overrides.rulesVersion === "5e-2024" ? "2024" : "2014";
  const { payload } = buildToPayload(build, new RefResolver(rulesVersion, collections));
  assert.ok(payload, "the build should convert");

  return payload;
}

/* ------------------------------------------------------------- slots -- */

test("spell slots land on paths that exist", () => {
  // The builder keyed these `spell1`; the module prefixes what it is given.
  // Together they produced `system.spells.spellspell1`, which is nothing, so
  // every imported character had no spell slots at all.
  const updates = derivedUpdates(payloadFor({ classId: "wizard", level: 5 }));

  assert.equal(updates["system.spells.spell1.value"], 4);
  assert.equal(updates["system.spells.spell2.value"], 3);
  assert.equal(updates["system.spells.spell3.value"], 2);
  assert.equal(updates["system.spells.spellspell1.value"], undefined);
});

test("a warlock's slots are pact slots, not ordinary ones", () => {
  const updates = derivedUpdates(payloadFor({ classId: "warlock", level: 5 }));

  assert.equal(updates["system.spells.pact.value"], 2);
  assert.equal(updates["system.spells.pact.max"], 2);
  assert.equal(updates["system.spells.spell3.value"], undefined);
});

test("a warlock's pact slot level is recorded, not just the count", () => {
  const payload = payloadFor({ classId: "warlock", level: 5 });

  assert.equal(payload.derived.spellcasting.pactLevel, 3);
});

test("a character with no spellcasting writes no slots", () => {
  const updates = derivedUpdates(payloadFor({ classId: "fighter", level: 5 }));

  assert.equal(JSON.stringify(updates).includes("spells"), false);
});

/* ------------------------------------------------------- proficiency -- */

test("skills reach the keys dnd5e uses, not the labels a player reads", () => {
  const updates = proficiencyUpdates(
    payloadFor({
      proficiencies: [
        { kind: "skill", label: "Arcana" },
        { kind: "skill", label: "Sleight of Hand" },
      ],
    }),
  );

  assert.equal(updates["system.skills.arc.value"], 1);
  assert.equal(updates["system.skills.slt.value"], 1);
  assert.equal(updates["system.skills.Arcana.value"], undefined);
});

test("a skill the builder cannot key is dropped rather than written wrong", () => {
  const payload = payloadFor({ proficiencies: [{ kind: "skill", label: "Basket Weaving" }] });

  assert.deepEqual(payload.proficiencies.skills, []);
});

test("saving throws reach the actor", () => {
  const updates = proficiencyUpdates(
    payloadFor({ proficiencies: [{ kind: "savingThrow", id: "int", label: "Inteligencia" }] }),
  );

  assert.equal(updates["system.abilities.int.proficient"], 1);
});

test("a known language becomes a key and an unknown one becomes custom text", () => {
  const updates = proficiencyUpdates(
    payloadFor({
      proficiencies: [
        { kind: "language", label: "Common" },
        { kind: "language", label: "Thieves' Cant" },
        { kind: "language", label: "Netherese" },
      ],
    }),
  );

  // Thieves' Cant has a key of its own; a setting's dead language does not.
  assert.deepEqual(updates["system.traits.languages.value"], ["common", "cant"]);
  assert.equal(updates["system.traits.languages.custom"], "Netherese");
});

/* --------------------------------------------------------- equipment -- */

test("armour the character wears is marked worn", () => {
  // Foundry computes armour class from what is equipped. Importing armour
  // without equipping it leaves the character in an empty body at AC 10,
  // whatever the builder showed.
  const payload = payloadFor({
    equipment: [
      { label: "Leather Armor", quantity: 1, category: "armor", armorFormula: "11+DEX" },
      { label: "Shield", quantity: 1, category: "shield", grantsShieldBonus: true },
      { label: "Quarterstaff", quantity: 1, category: "weapon" },
      { label: "Rations", quantity: 10, category: "gear" },
    ],
  });

  const equipped = Object.fromEntries(
    payload.equipment.map((entry) => [entry.ref.hash, entry.equipped ?? false]),
  );

  // Hashes are URL-encoded, so a space is `%20`.
  assert.equal(equipped["leather%20armor_phb"], true);
  assert.equal(equipped["shield_phb"], true);
  assert.equal(equipped["quarterstaff_phb"], true);
  assert.equal(Object.keys(equipped).some((hash) => hash.startsWith("rations")), false);
});

test("the update the module builds carries the equipped flag through", () => {
  const payload = payloadFor({
    equipment: [{ label: "Leather Armor", quantity: 1, category: "armor", armorFormula: "11+DEX" }],
  });

  const [entry] = payload.equipment;
  assert.deepEqual(equipmentUpdates(entry), { "system.quantity": 1, "system.equipped": true });
});

/* -------------------------------------------------- half-casters -- */

test("a 2014 paladin casts nothing at level 1", () => {
  // The two editions disagree about when a half-caster starts, and the builder
  // applied the 2024 rule to both: a level 1 paladin was handed two slots it
  // does not have until level 2.
  const updates = derivedUpdates(payloadFor({ classId: "paladin", level: 1 }));

  assert.equal(JSON.stringify(updates).includes("spells"), false);
});

test("a 2024 paladin casts at level 1", () => {
  const updates = derivedUpdates(
    payloadFor({ classId: "paladin", level: 1, rulesVersion: "5e-2024" }),
  );

  assert.equal(updates["system.spells.spell1.value"], 2);
});

test("both editions agree from level 2 up", () => {
  for (const level of [2, 5, 9, 17]) {
    const twentyFourteen = derivedUpdates(payloadFor({ classId: "ranger", level }));
    const twentyFour = derivedUpdates(
      payloadFor({ classId: "ranger", level, rulesVersion: "5e-2024" }),
    );

    assert.deepEqual(twentyFourteen, twentyFour, `ranger level ${level}`);
  }
});

test("the artificer rounds up in both editions, as the rule is named for it", () => {
  const updates = derivedUpdates(payloadFor({ classId: "artificer", level: 1 }));

  assert.equal(updates["system.spells.spell1.value"], 2);
});

/* ------------------------------------------------------------- rest -- */

test("hit points reach the actor as the builder computed them", () => {
  const payload = payloadFor({ classId: "wizard", level: 5 });
  const actor = baseActorData(payload);

  assert.equal(actor.system.attributes.hp.value, payload.derived.hp);
  assert.equal(actor.system.attributes.hp.max, payload.derived.hp);
});

test("every ability score the player assigned reaches the actor", () => {
  const payload = payloadFor({ scores: { str: 8, dex: 14, con: 14, int: 17, wis: 12, cha: 10 } });
  const actor = baseActorData(payload);

  assert.equal(actor.system.abilities.int.value, 17);
  assert.equal(actor.system.abilities.str.value, 8);
});

test("the payload validates against its own contract", async () => {
  const { importPayloadSchema } = await import("@bertinis-vault/contracts");

  assert.doesNotThrow(() => importPayloadSchema.parse(payloadFor()));
});

test("the module's copy of the language keys matches the contract's", async () => {
  // The module ships into Foundry with no bundler, so it carries its own copy.
  // This is what keeps the copy from drifting away from the original.
  const { languageIdFor } = await import("@bertinis-vault/contracts");
  const { partitionLanguages } = await import("../src/import.js");

  for (const name of ["Common", "Deep Speech", "Thieves' Cant", "Undercommon", "Draconic"]) {
    assert.deepEqual(
      partitionLanguages([name]).known,
      [languageIdFor(name)],
      `${name} should key the same on both sides`,
    );
  }
});

/* ------------------------------------------- armour and weapon profs -- */

test("armour and weapon proficiencies reach the actor", () => {
  /*
   * Measured on an imported actor, not guessed: `traits.armorProf.value` and
   * `traits.weaponProf.value` both came back empty, so the character was
   * proficient with nothing — every attack short its proficiency bonus, and
   * every suit of armour worn at disadvantage on Strength and Dexterity with
   * spellcasting blocked.
   *
   * They were left out on the belief that Plutonium's class and race documents
   * carried them. Those documents hold the grants as `Trait` advancements, and
   * an advancement applies when a character is levelled through it — which a
   * direct import is exactly what does not do.
   */
  const updates = proficiencyUpdates(
    payloadFor({
      classId: "fighter",
      armorProficiencies: ["lgt", "med", "hvy", "shl"],
      weaponProficiencies: ["sim", "mar"],
    }),
  );

  assert.deepEqual(updates["system.traits.armorProf.value"], ["lgt", "med", "hvy", "shl"]);
  assert.deepEqual(updates["system.traits.weaponProf.value"], ["sim", "mar"]);
});

test("a weapon named one by one travels as its base-item id", () => {
  // A dwarf wizard swings a warhammer at their proficiency bonus, and no class
  // document knows that. Foundry checks `weaponProf.value` against the
  // category keys *and* against `item.type.baseItem`, so both fit in one set.
  const updates = proficiencyUpdates(
    payloadFor({
      classId: "wizard",
      weaponProficiencies: ["dagger", "quarterstaff", "warhammer"],
    }),
  );

  assert.ok(updates["system.traits.weaponProf.value"].includes("warhammer"));
});

test("a character granted nothing writes nothing rather than an empty set", () => {
  // Writing an empty array would erase whatever the sheet already had, which
  // is worse than leaving it alone.
  const updates = proficiencyUpdates(payloadFor({}));

  assert.equal(updates["system.traits.armorProf.value"], undefined);
  assert.equal(updates["system.traits.weaponProf.value"], undefined);
});

test("the payload carries them where the module looks", () => {
  const payload = payloadFor({
    armorProficiencies: ["lgt"],
    weaponProficiencies: ["sim"],
  });

  assert.deepEqual(payload.proficiencies.armor, ["lgt"]);
  assert.deepEqual(payload.proficiencies.weapons, ["sim"]);
});

/* ------------------------------------------------- prepared spells -- */

test("a prepared spell is written where dnd5e keeps it", () => {
  /*
   * It was written to `system.preparation.prepared` as a boolean, which is
   * where dnd5e kept it before 5.1 and nowhere at all since. An exported actor
   * has no `preparation` key on any spell: the field is `system.prepared`,
   * and it is a number because there are three states and not two —
   * `DND5E.spellPreparationStates` is unprepared 0, prepared 1, always 2.
   *
   * So nothing landed. Every imported spell arrived unprepared, on a wizard
   * whose entire class is deciding which ones are not.
   */
  assert.equal(preparationState("unprepared"), 0);
  assert.equal(preparationState("prepared"), 1);
  assert.equal(preparationState("always"), 2);
});

test("the state names are dnd5e's own, not names invented here", () => {
  // Copied from `DND5E.spellPreparationStates` in dnd5e 5.3.3. A rename in the
  // system should break this rather than silently write the wrong number.
  assert.deepEqual(PREPARATION_STATE, { unprepared: 0, prepared: 1, always: 2 });
});

test("a spell that says nothing is castable", () => {
  /*
   * Absence is not `unprepared`. Every build written before the field existed
   * carries no state at all, and every one of its spells is meant to be
   * castable — a sheet that silently unprepared them would be worse than one
   * that offers a spell a day early.
   */
  assert.equal(preparationState(undefined), 1);
  assert.equal(preparationState("nonsense"), 1);
});

test("the wizard's book is the reason there are three states", () => {
  // A spell in the book and not prepared today is still on the character.
  // With a boolean there was nowhere to put it but "not prepared", which on
  // an actor means "not there at all".
  assert.notEqual(preparationState("unprepared"), preparationState("prepared"));
  assert.notEqual(preparationState("always"), preparationState("prepared"));
});

test("a granted spell carries the ability it is cast with", () => {
  /*
   * Measured in dnd5e 5.3.3: `SpellData#availableAbilities` returns the
   * spell's own ability where it has one and falls back to the class's only
   * otherwise. A fighter has none, so without this a species cantrip on a
   * fighter has no save DC and no attack bonus at all.
   */
  assert.deepEqual(spellUpdates({ ability: "cha" }), { "system.ability": "cha" });
});

test("an innate spell says how it is cast and how often it comes back", () => {
  assert.deepEqual(
    spellUpdates({ preparation: "prepared", method: "innate", uses: { max: 1, period: "day" } }),
    {
      "system.prepared": 1,
      "system.method": "innate",
      "system.uses.max": "1",
      "system.uses.spent": 0,
      "system.uses.recovery": [{ period: "day", type: "recoverAll" }],
    },
  );
});

test("a spell with nothing to say produces no update at all", () => {
  // An empty update would still be sent, and `updateEmbeddedDocuments` on a
  // document that needs nothing is a write for its own sake.
  assert.deepEqual(spellUpdates({}), {});
});
