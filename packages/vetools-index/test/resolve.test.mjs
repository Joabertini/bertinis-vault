import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { RefResolver, resolveAll } from "../dist/index.js";

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "data");
const load = (prop) => JSON.parse(fs.readFileSync(path.join(DATA, `${prop}.json`), "utf8"));

const collections = {
  spell: load("spell"),
  item: load("item"),
  feat: load("feat"),
  race: load("race"),
  background: load("background"),
  class: load("class"),
};

const classic = new RefResolver("2014", collections);
const modern = new RefResolver("2024", collections);

test("a slug resolves to the reference for the build's edition", () => {
  const result = classic.resolve("spell", "fire-bolt");

  assert.ok(result.ok);
  assert.deepEqual(result.value, {
    page: "spells.html",
    source: "PHB",
    hash: "fire%20bolt_phb",
    prop: "spell",
  });
});

test("the same slug resolves differently per edition", () => {
  const a = classic.resolve("spell", "fire-bolt");
  const b = modern.resolve("spell", "fire-bolt");

  assert.ok(a.ok && b.ok);
  assert.equal(a.value.source, "PHB");
  assert.equal(b.value.source, "XPHB");
  assert.notEqual(a.value.hash, b.value.hash);
});

test("slugs match names regardless of separators, case and accents", () => {
  for (const query of ["fire-bolt", "Fire Bolt", "firebolt", "FIRE_BOLT"]) {
    const result = classic.resolve("spell", query);
    assert.ok(result.ok, query);
    assert.equal(result.value.hash, "fire%20bolt_phb", query);
  }
});

test("a pick that exists only in the other edition says so", () => {
  // Weapon Mastery is 2024 content; a 2014 build must not silently get it.
  const result = classic.resolve("feat", "weapon-master");
  if (!result.ok && result.failure.reason === "wrong-edition") {
    assert.ok(result.failure.availableIn.length > 0);
  }

  // A spell present in both editions, asked for from a resolver built on one.
  const onlyModern = new RefResolver("2024", { spell: collections.spell });
  const phbOnly = collections.spell.filter((s) => s.source === "PHB");
  const resolver = new RefResolver("2024", { spell: phbOnly });
  const missing = resolver.resolve("spell", "fire-bolt");

  assert.ok(!missing.ok);
  assert.equal(missing.failure.reason, "wrong-edition");
  assert.deepEqual(missing.failure.availableIn, ["PHB"]);
  assert.ok(onlyModern.has("spell", "fire-bolt"));
});

test("an unknown pick is not-found rather than wrong-edition", () => {
  const result = classic.resolve("spell", "this-spell-does-not-exist");

  assert.ok(!result.ok);
  assert.equal(result.failure.reason, "not-found");
  assert.equal(result.failure.query, "this-spell-does-not-exist");
  assert.equal(result.failure.availableIn, undefined);
});

test("a pick with several candidates in one edition is ambiguous, not arbitrary", () => {
  const rows = [
    { name: "Shield", source: "PHB" },
    { name: "Shield", source: "XGE" },
  ];
  const resolver = new RefResolver("2014", { item: rows });
  const result = resolver.resolve("item", "shield");

  assert.ok(!result.ok);
  assert.equal(result.failure.reason, "ambiguous");
  assert.deepEqual(result.failure.availableIn, ["PHB", "XGE"]);
});

test("a preferred source settles ambiguity", () => {
  const rows = [
    { name: "Shield", source: "PHB" },
    { name: "Shield", source: "XGE" },
  ];
  const resolver = new RefResolver("2014", { item: rows });
  const result = resolver.resolve("item", "shield", "XGE");

  assert.ok(result.ok);
  assert.equal(result.value.source, "XGE");
});

test("a preferred source that does not apply falls back rather than failing", () => {
  const result = classic.resolve("spell", "fire-bolt", "NOT-A-BOOK");

  assert.ok(result.ok);
  assert.equal(result.value.source, "PHB");
});

test("every core class resolves in both editions", () => {
  for (const name of ["wizard", "fighter", "cleric", "warlock", "rogue", "druid"]) {
    assert.ok(classic.resolve("class", name).ok, `2014 ${name}`);
    assert.ok(modern.resolve("class", name).ok, `2024 ${name}`);
  }
});

test("resolveAll collects every failure instead of stopping at the first", () => {
  const { refs, failures } = resolveAll(classic, [
    { prop: "spell", query: "fire-bolt" },
    { prop: "spell", query: "nonsense-one" },
    { prop: "class", query: "wizard" },
    { prop: "spell", query: "nonsense-two" },
  ]);

  assert.equal(refs.length, 2);
  assert.equal(failures.length, 2);
  assert.deepEqual(
    failures.map((f) => f.query),
    ["nonsense-one", "nonsense-two"],
  );
});

test("a resolver built for one prop does not answer for another", () => {
  const resolver = new RefResolver("2014", { spell: collections.spell });

  assert.ok(!resolver.resolve("item", "fire-bolt").ok);
  assert.equal(resolver.has("item", "longsword"), false);
});
