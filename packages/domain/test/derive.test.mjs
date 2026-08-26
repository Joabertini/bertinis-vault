import test from "node:test";
import assert from "node:assert/strict";

import { deriveCharacterBuild } from "../dist/index.js";

function makeInput(overrides = {}) {
  return {
    meta: {
      rulesVersion: "5e-2014",
      sourceProfile: "vault-v1",
      createdAt: "2026-03-22T00:00:00.000Z",
      updatedAt: "2026-03-22T00:00:00.000Z",
    },
    identity: {
      characterName: "Seraphina Vale",
      alignment: "Neutral Good",
    },
    ancestry: {
      raceId: "human",
    },
    classing: {
      classes: [{ classId: "wizard", level: 3 }],
    },
    background: {
      backgroundId: "sage",
      grantedFeatIds: [],
    },
    abilities: {
      generationMethod: "manual",
      base: { str: 8, dex: 14, con: 13, int: 17, wis: 12, cha: 10 },
      final: { str: 8, dex: 14, con: 13, int: 17, wis: 12, cha: 10 },
    },
    choices: {
      feats: [],
      proficiencies: [],
      spells: ["Nv0: Mage Hand", "Nv1: Shield"],
      equipment: ["quarterstaff", "mage-armor", "shield"],
      features: [],
    },
    ...overrides,
  };
}

test("deriveCharacterBuild computes hp, ac, proficiency bonus and spellcasting", () => {
  const build = deriveCharacterBuild(makeInput());

  assert.equal(build.derived.proficiencyBonus, 2);
  assert.equal(build.derived.hp, 17);
  assert.equal(build.derived.ac, 17);
  assert.equal(build.derived.spellcasting?.ability, "int");
  assert.equal(build.derived.spellcasting?.attackBonus, 5);
  assert.equal(build.derived.spellcasting?.saveDC, 13);
  // Keyed by the level the slot is, which is the payload's shape. Foundry's
  // own `spell1` field names belong to the direct actor exporter.
  assert.equal(build.derived.spellcasting?.slots["1"], 4);
  assert.equal(build.derived.spellcasting?.slots["2"], 2);
  assert.equal(build.derived.spellcasting?.slots.spell1, undefined);
});

test("deriveCharacterBuild omits spellcasting for non-casters", () => {
  const build = deriveCharacterBuild(
    makeInput({
      classing: {
        classes: [{ classId: "fighter", level: 3 }],
      },
      choices: {
        feats: [],
        proficiencies: [],
        spells: [],
        equipment: ["chain-mail", "shield"],
        features: [],
      },
    }),
  );

  assert.equal(build.derived.ac, 18);
  assert.equal(build.derived.spellcasting, undefined);
});

test("deriveCharacterBuild uses pact slot progression for warlocks", () => {
  const build = deriveCharacterBuild(
    makeInput({
      classing: {
        classes: [{ classId: "warlock", level: 5 }],
      },
      abilities: {
        generationMethod: "manual",
        base: { str: 8, dex: 14, con: 14, int: 10, wis: 12, cha: 18 },
        final: { str: 8, dex: 14, con: 14, int: 10, wis: 12, cha: 18 },
      },
      choices: {
        feats: [],
        proficiencies: [],
        spells: ["Nv0: Eldritch Blast", "Nv3: Hunger of Hadar"],
        equipment: ["dagger", "leather", "arcane-focus"],
        features: [],
      },
    }),
  );

  assert.equal(build.derived.spellcasting?.ability, "cha");
  // A warlock's are pact slots, a separate resource, cast at their own level.
  assert.equal(build.derived.spellcasting?.slots.pact, 2);
  assert.equal(build.derived.spellcasting?.pactLevel, 3);
  assert.equal(build.derived.spellcasting?.slots["3"], undefined);
});

test("a barbarian's Unarmored Defense reaches the derived armour class", () => {
  // The end of the wire. `calculateArmorClass` has had a parameter for this
  // since the beginning and nothing ever passed it, so this build derived 12
  // and the sheet in Foundry showed 15. The two disagreed and the number the
  // player planned with was the wrong one.
  const barbarian = makeInput({
    classing: { classes: [{ classId: "barbarian", level: 3 }] },
    abilities: {
      generationMethod: "manual",
      base: { str: 16, dex: 14, con: 16, int: 8, wis: 12, cha: 10 },
      final: { str: 16, dex: 14, con: 16, int: 8, wis: 12, cha: 10 },
    },
    choices: {
      feats: [],
      proficiencies: [],
      spells: [],
      equipment: ["greataxe"],
      features: [],
      normalized: {
        feats: [],
        proficiencies: [],
        spells: [],
        equipment: [],
        features: [],
        armorClassOptions: [
          {
            name: "Unarmored Defense",
            source: "PHB",
            level: 1,
            isVariant: false,
            base: 10,
            abilities: ["dex", "con"],
            allowsShield: true,
            requiresNoArmor: true,
            calc: null,
          },
        ],
      },
    },
  });

  assert.equal(deriveCharacterBuild(barbarian).derived.ac, 15);
});

test("a build with no armour class options derives exactly what it did before", () => {
  // The guard on the change: a wizard in mage armour and a shield is 17, which
  // is what this file has asserted since before any of this existed.
  const build = deriveCharacterBuild(makeInput());

  assert.equal(build.derived.ac, 17);
});

test("a multiclass caster derives the combined table, not the first class's", () => {
  // A wizard 3 / cleric 2 is caster level 5. Read as a wizard 3 — which is
  // what every build derived until now, because `classes[0]` was the only
  // entry anything looked at — it was two slots short and a whole spell level
  // missing.
  const build = deriveCharacterBuild(
    makeInput({
      classing: {
        classes: [
          { classId: "wizard", level: 3, casterProgression: "full", hitDie: 6 },
          { classId: "cleric", level: 2, casterProgression: "full", hitDie: 8 },
        ],
      },
    }),
  );

  assert.equal(build.derived.proficiencyBonus, 3);
  assert.deepEqual(build.derived.spellcasting?.slots, { 1: 4, 2: 3, 3: 2 });
});

test("a multiclass character's hit points use each class's own die", () => {
  // Barbarian 1 / wizard 4 at Constitution +1: 12 + 1, then four levels of
  // d6 at 4 + 1. Read as five barbarian levels it was fourteen too many.
  const build = deriveCharacterBuild(
    makeInput({
      classing: {
        classes: [
          { classId: "barbarian", level: 1, hitDie: 12 },
          { classId: "wizard", level: 4, casterProgression: "full", hitDie: 6 },
        ],
      },
      abilities: {
        generationMethod: "manual",
        base: { str: 14, dex: 14, con: 12, int: 16, wis: 10, cha: 8 },
        final: { str: 14, dex: 14, con: 12, int: 16, wis: 10, cha: 8 },
      },
    }),
  );

  assert.equal(build.derived.hp, 33);
});

test("a warlock dip keeps its pact slots apart from the rest", () => {
  const build = deriveCharacterBuild(
    makeInput({
      classing: {
        classes: [
          { classId: "sorcerer", level: 3, casterProgression: "full", hitDie: 6 },
          { classId: "warlock", level: 2, casterProgression: "pact", hitDie: 8 },
        ],
      },
    }),
  );

  assert.deepEqual(build.derived.spellcasting?.slots, { 1: 4, 2: 2, pact: 2 });
  assert.equal(build.derived.spellcasting?.pactLevel, 1);
});
