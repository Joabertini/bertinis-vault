import test from "node:test";
import assert from "node:assert/strict";
import zlib from "node:zlib";

import {
  collectRefs,
  IMPORT_PAYLOAD_VERSION,
  importPayloadSchema,
  parseImportPayload,
  PayloadVersionError,
  totalLevel,
} from "../dist/index.js";

const ref = (prop, page, name, source) => ({
  page,
  source,
  hash: `${encodeURIComponent(name.toLowerCase()).toLowerCase()}_${source.toLowerCase()}`,
  prop,
});

function makePayload(overrides = {}) {
  return {
    version: IMPORT_PAYLOAD_VERSION,
    rulesVersion: "2014",
    exportedAt: "2026-08-23T12:00:00.000Z",
    identity: { characterName: "Seraphina Vale", playerName: "Joe" },
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
    feats: [],
    spells: [
      { ref: ref("spell", "spells.html", "Eldritch Blast", "PHB") },
      { ref: ref("spell", "spells.html", "Hex", "PHB"), prepared: true },
    ],
    equipment: [
      { ref: ref("item", "items.html", "Leather Armor", "PHB"), quantity: 1, equipped: true },
      { ref: ref("item", "items.html", "Dagger", "PHB"), quantity: 2 },
    ],
    derived: {
      hp: 38,
      ac: 13,
      proficiencyBonus: 3,
      spellcasting: { ability: "cha", attackBonus: 6, saveDC: 14, slots: { 3: 2 } },
    },
    ...overrides,
  };
}

test("a complete payload validates", () => {
  const parsed = importPayloadSchema.parse(makePayload());

  assert.equal(parsed.rulesVersion, "2014");
  assert.equal(parsed.classes[0].level, 5);
  assert.equal(parsed.derived.spellcasting.ability, "cha");
});

test("optional collections default to empty rather than being required", () => {
  const payload = makePayload();
  delete payload.feats;
  delete payload.spells;
  delete payload.equipment;

  const parsed = importPayloadSchema.parse(payload);

  assert.deepEqual(parsed.feats, []);
  assert.deepEqual(parsed.spells, []);
  assert.deepEqual(parsed.equipment, []);
});

test("equipment quantity defaults to one", () => {
  const payload = makePayload({
    equipment: [{ ref: ref("item", "items.html", "Torch", "PHB") }],
  });

  assert.equal(importPayloadSchema.parse(payload).equipment[0].quantity, 1);
});

test("both rulesets are accepted and nothing else is", () => {
  assert.ok(importPayloadSchema.safeParse(makePayload({ rulesVersion: "2014" })).success);
  assert.ok(importPayloadSchema.safeParse(makePayload({ rulesVersion: "2024" })).success);
  assert.ok(!importPayloadSchema.safeParse(makePayload({ rulesVersion: "5e-2014" })).success);
});

test("a build with no class is rejected", () => {
  assert.ok(!importPayloadSchema.safeParse(makePayload({ classes: [] })).success);
});

test("an unnamed character is rejected", () => {
  const payload = makePayload({ identity: { characterName: "   " } });
  assert.ok(!importPayloadSchema.safeParse(payload).success);
});

test("a reference missing any part of its triple is rejected", () => {
  for (const field of ["page", "source", "hash", "prop"]) {
    const payload = makePayload();
    delete payload.race.ref[field];
    assert.ok(!importPayloadSchema.safeParse(payload).success, `accepted a ref with no ${field}`);
  }
});

test("collectRefs returns every reference the payload carries", () => {
  const refs = collectRefs(importPayloadSchema.parse(makePayload()));

  // race + class + subclass + background + 2 spells + 2 items
  assert.equal(refs.length, 8);
  assert.ok(refs.every((r) => r.hash && r.source && r.page));
  assert.equal(refs[0].prop, "race");
});

test("totalLevel sums a multiclass build", () => {
  const payload = makePayload({
    classes: [
      { ref: ref("class", "classes.html", "Warlock", "PHB"), level: 3 },
      { ref: ref("class", "classes.html", "Sorcerer", "PHB"), level: 2 },
    ],
  });

  assert.equal(totalLevel(importPayloadSchema.parse(payload)), 5);
});

test("a payload from a newer format reports the version, not a wall of errors", () => {
  assert.throws(() => parseImportPayload(makePayload({ version: 99 })), PayloadVersionError);

  try {
    parseImportPayload(makePayload({ version: 99 }));
  } catch (error) {
    assert.match(error.message, /Update the module/);
    assert.equal(error.received, 99);
  }
});

test("parseImportPayload still validates a payload of the right version", () => {
  assert.ok(parseImportPayload(makePayload()));
  assert.throws(() => parseImportPayload({ version: IMPORT_PAYLOAD_VERSION }));
});

test("a realistic payload is small enough to store under a code", () => {
  // A level 20 wizard: the worst case a player can reach.
  const spells = Array.from({ length: 60 }, (_, i) =>
    ({ ref: ref("spell", "spells.html", `Spell Number ${i}`, "PHB"), prepared: i < 25 }));
  const equipment = Array.from({ length: 40 }, (_, i) =>
    ({ ref: ref("item", "items.html", `Item Number ${i}`, "PHB"), quantity: 1 }));

  const payload = makePayload({
    classes: [{ ref: ref("class", "classes.html", "Wizard", "PHB"), level: 20 }],
    spells,
    equipment,
  });

  const json = JSON.stringify(importPayloadSchema.parse(payload));
  const gzip = zlib.gzipSync(Buffer.from(json)).length;

  assert.ok(json.length < 64 * 1024, `payload is ${(json.length / 1024).toFixed(1)}KB raw`);
  assert.ok(gzip < 8 * 1024, `payload is ${(gzip / 1024).toFixed(1)}KB gzipped`);
});
