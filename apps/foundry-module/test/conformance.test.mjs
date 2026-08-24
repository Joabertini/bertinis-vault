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

import { baseActorData, derivedUpdates, equipmentUpdates, proficiencyUpdates } from "../src/import.js";

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
