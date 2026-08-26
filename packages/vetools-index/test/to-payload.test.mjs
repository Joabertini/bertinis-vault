import test from "node:test";
import assert from "node:assert/strict";

import { importPayloadSchema } from "@bertinis-vault/contracts";

import { RefResolver, buildToPayload, collections, describeFailure } from "../dist/index.js";

const resolver = new RefResolver("2014", collections);

function makeBuild(overrides = {}) {
  return {
    meta: {
      rulesVersion: "5e-2014",
      sourceProfile: "vault-v1",
      createdAt: "2026-08-23T10:00:00.000Z",
      updatedAt: "2026-08-23T10:00:00.000Z",
    },
    identity: { characterName: "Seraphina Vale", playerName: "Joe" },
    ancestry: { raceId: "human" },
    classing: { classes: [{ classId: "wizard", level: 5 }] },
    background: { backgroundId: "sage", grantedFeatIds: [] },
    abilities: {
      generationMethod: "standard-array",
      base: { str: 8, dex: 14, con: 14, int: 15, wis: 12, cha: 10 },
      final: { str: 8, dex: 14, con: 14, int: 17, wis: 12, cha: 10 },
    },
    choices: {
      feats: [],
      proficiencies: [],
      spells: [],
      equipment: [],
      features: [],
      normalized: {
        feats: [],
        proficiencies: [
          { kind: "skill", id: "arcana", label: "Arcana" },
          { kind: "language", id: "elvish", label: "Elvish" },
          { kind: "tool", id: "thieves-tools", label: "Thieves' Tools" },
          { kind: "weapon", id: "longsword", label: "Longsword" },
        ],
        spells: [
          { spellId: "fire-bolt", label: "Fire Bolt", level: 0 },
          { spellId: "magic-missile", label: "Magic Missile", level: 1 },
        ],
        equipment: [{ itemId: "dagger", label: "Dagger", quantity: 2, category: "weapon" }],
        features: [],
      },
    },
    derived: { proficiencyBonus: 3, hp: 32, ac: 12 },
    ...overrides,
  };
}

test("a build converts into a payload that validates", () => {
  const { payload, failures } = buildToPayload(makeBuild(), resolver);

  assert.ok(payload, `conversion failed: ${failures.map(describeFailure).join("; ")}`);
  assert.ok(importPayloadSchema.safeParse(payload).success);
  assert.equal(payload.rulesVersion, "2014");
  assert.equal(payload.identity.characterName, "Seraphina Vale");
});

test("every pick becomes a reference, never a fabricated body", () => {
  const { payload } = buildToPayload(makeBuild(), resolver);

  assert.equal(payload.race.ref.page, "races.html");
  assert.equal(payload.classes[0].ref.page, "classes.html");
  assert.equal(payload.classes[0].level, 5);
  assert.equal(payload.background.ref.page, "backgrounds.html");
  assert.equal(payload.spells.length, 2);
  assert.equal(payload.equipment.length, 1);
  assert.equal(payload.equipment[0].quantity, 2);

  for (const spell of payload.spells) {
    assert.equal(spell.ref.page, "spells.html");
    assert.ok(spell.ref.hash.includes("_"));
    // Nothing resembling an item body should be travelling.
    assert.deepEqual(Object.keys(spell.ref).sort(), ["hash", "page", "prop", "source"]);
  }
});

test("references carry the sources of the build's own edition", () => {
  const { payload } = buildToPayload(makeBuild(), resolver);

  for (const ref of [payload.race.ref, payload.background.ref, ...payload.spells.map((s) => s.ref)]) {
    assert.notEqual(ref.source, "XPHB", `${ref.hash} came from the 2024 books`);
  }
});

test("proficiencies are split by kind, and weapons are left to the class document", () => {
  const { payload } = buildToPayload(makeBuild(), resolver);

  // Skills travel as the keys dnd5e uses, not as the names a player reads:
  // `system.skills.Arcana` is a path that does not exist.
  assert.deepEqual(payload.proficiencies.skills, ["arc"]);
  assert.deepEqual(payload.proficiencies.languages, ["elvish"]);
  // And so do tools. This asserted `thieves-tools` — the builder's own slug —
  // which is what the module was handed and what it silently failed to write:
  // `system.tools` has no fixed keys, so the wrong one is created rather than
  // rejected. The system's key is `thief`.
  assert.deepEqual(payload.proficiencies.tools, ["thief"]);
  // The weapon proficiency is deliberately absent: it comes from the class.
  assert.equal(JSON.stringify(payload.proficiencies).includes("longsword"), false);
});

test("derived values are carried, not recomputed inside Foundry", () => {
  const { payload } = buildToPayload(makeBuild(), resolver);

  assert.equal(payload.derived.hp, 32);
  assert.equal(payload.derived.ac, 12);
  assert.equal(payload.derived.proficiencyBonus, 3);
});

test("an unresolvable spell is reported but the rest of the character still exports", () => {
  const build = makeBuild();
  build.choices.normalized.spells.push({ spellId: "not-a-real-spell", label: "Nonsense", level: 2 });

  const { payload, failures } = buildToPayload(build, resolver);

  assert.ok(payload, "one bad spell should not sink the build");
  assert.equal(payload.spells.length, 2);
  assert.equal(failures.length, 1);
  assert.equal(failures[0].query, "not-a-real-spell");
  assert.match(describeFailure(failures[0]), /not found/i);
});

test("a missing race yields no payload, because that is not a character", () => {
  const build = makeBuild({ ancestry: { raceId: "not-a-race" } });
  const { payload, failures } = buildToPayload(build, resolver);

  assert.equal(payload, null);
  assert.ok(failures.some((f) => f.query === "not-a-race"));
});

test("a missing background also yields no payload", () => {
  const build = makeBuild({ background: { backgroundId: "not-a-background", grantedFeatIds: [] } });
  assert.equal(buildToPayload(build, resolver).payload, null);
});

test("a build whose only class fails to resolve yields no payload", () => {
  const build = makeBuild({ classing: { classes: [{ classId: "not-a-class", level: 3 }] } });
  assert.equal(buildToPayload(build, resolver).payload, null);
});

test("granted and chosen feats both make it in", () => {
  const build = makeBuild({
    background: { backgroundId: "sage", grantedFeatIds: ["alert"] },
  });
  build.choices.feats = ["lucky"];

  const { payload } = buildToPayload(build, resolver);

  assert.equal(payload.feats.length, 2);
  assert.ok(payload.feats.every((f) => f.ref.page === "feats.html"));
});

test("a multiclass build keeps every class and its level", () => {
  const build = makeBuild({
    classing: {
      classes: [
        { classId: "wizard", level: 3 },
        { classId: "fighter", level: 2 },
      ],
    },
  });

  const { payload } = buildToPayload(build, resolver);

  assert.equal(payload.classes.length, 2);
  assert.deepEqual(
    payload.classes.map((c) => c.level),
    [3, 2],
  );
});

test("a build with no normalized choices still converts", () => {
  const build = makeBuild();
  delete build.choices.normalized;

  const { payload } = buildToPayload(build, resolver);

  assert.ok(payload);
  assert.deepEqual(payload.spells, []);
  assert.deepEqual(payload.equipment, []);
});

test("the converted payload stays small", () => {
  const build = makeBuild();
  const { payload } = buildToPayload(build, resolver);

  assert.ok(JSON.stringify(payload).length < 8 * 1024);
});

/* --------------------------------------------------------- source books -- */

test("a name that appears in several books of one edition fails without a book", () => {
  const { payload, failures } = buildToPayload(makeBuild({ ancestry: { raceId: "aarakocra" } }), resolver);

  assert.equal(payload, null);
  const failure = failures.find((entry) => entry.query === "aarakocra");
  assert.equal(failure.reason, "ambiguous");
  assert.deepEqual(failure.availableIn, ["DMG", "EEPC", "MPMM"]);
});

test("naming the book resolves what the name alone could not", () => {
  const { payload, failures } = buildToPayload(
    makeBuild({
      ancestry: { raceId: "aarakocra" },
      sourceBooks: { "race:aarakocra": "MPMM" },
    }),
    resolver,
  );

  assert.equal(failures.length, 0);
  assert.equal(payload.race.ref.source, "MPMM");
});

test("a book that does not carry the entity is ignored rather than obeyed", () => {
  const { payload } = buildToPayload(
    makeBuild({ sourceBooks: { "race:human": "NOT-A-BOOK" } }),
    resolver,
  );

  assert.equal(payload.race.ref.source, "PHB");
});

test("a build with no source books converts exactly as it did before", () => {
  const withTable = buildToPayload(makeBuild({ sourceBooks: {} }), resolver);
  const without = buildToPayload(makeBuild(), resolver);

  assert.deepEqual(
    { ...withTable.payload, exportedAt: null },
    { ...without.payload, exportedAt: null },
  );
});
