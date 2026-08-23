import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  filterSpells,
  forRulesVersion,
  groupByName,
  normalizeForSearch,
  refOf,
  rulesVersionOfRow,
  searchByName,
} from "../dist/index.js";

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data");
const load = (prop) => JSON.parse(fs.readFileSync(path.join(DATA, `${prop}.json`), "utf8"));

const spells = load("spell");
const items = load("item");
const classes = load("class");
const manifest = JSON.parse(fs.readFileSync(path.join(DATA, "manifest.json"), "utf8"));

test("the shipped index matches its manifest", () => {
  for (const [prop, meta] of Object.entries(manifest)) {
    assert.equal(load(prop).length, meta.count, prop);
  }
});

test("the whole index stays small enough to bundle", () => {
  const total = Object.values(manifest).reduce((sum, m) => sum + m.gzip, 0);
  assert.ok(total < 128 * 1024, `index grew to ${(total / 1024).toFixed(0)}KB gzip`);
});

test("every row can be turned into a reference", () => {
  // A row without a usable source would be unpickable in the builder.
  for (const row of spells) {
    assert.ok(row.name, "row has no name");
    assert.ok(row.source, `${row.name} has no source`);
  }

  const fireBolt = spells.find((s) => s.name === "Fire Bolt" && s.source === "PHB");
  assert.deepEqual(refOf("spell", fireBolt), {
    page: "spells.html",
    source: "PHB",
    hash: "fire%20bolt_phb",
    prop: "spell",
  });
});

test("rows carry the fields a picker filters on", () => {
  const fireBolt = spells.find((s) => s.name === "Fire Bolt" && s.source === "PHB");

  assert.equal(fireBolt.level, 0);
  assert.equal(fireBolt.school, "V");
  assert.equal(fireBolt.components, "vs");
  assert.equal(fireBolt.concentration, 0);
});

test("a spell reprinted in both editions appears once per source", () => {
  const fireBolts = spells.filter((s) => s.name === "Fire Bolt");
  const sources = fireBolts.map((s) => s.source).sort();

  assert.deepEqual(sources, ["PHB", "XPHB"]);
  assert.equal(rulesVersionOfRow(fireBolts.find((s) => s.source === "PHB")), "2014");
  assert.equal(rulesVersionOfRow(fireBolts.find((s) => s.source === "XPHB")), "2024");
});

test("filtering by ruleset keeps a build from being offered the other edition", () => {
  const classic = forRulesVersion(spells, "2014");
  const modern = forRulesVersion(spells, "2024");

  assert.ok(classic.length > 0);
  assert.ok(modern.length > 0);
  assert.equal(classic.length + modern.length, spells.length);
  assert.ok(classic.every((s) => s.source !== "XPHB"));
  assert.ok(modern.every((s) => s.source !== "PHB"));
});

test("the 2014 and 2024 class lists are both complete", () => {
  const classic = forRulesVersion(classes, "2014").map((c) => c.name);
  const modern = forRulesVersion(classes, "2024").map((c) => c.name);

  for (const name of ["Wizard", "Fighter", "Warlock", "Druid"]) {
    assert.ok(classic.includes(name), `2014 is missing ${name}`);
    assert.ok(modern.includes(name), `2024 is missing ${name}`);
  }
});

test("search ranks prefix matches above substring matches", () => {
  const results = searchByName(spells, "fire", 20).map((s) => s.name);

  const firstContains = results.findIndex((n) => !normalizeForSearch(n).startsWith("fire"));
  const lastPrefix = results.map((n) => normalizeForSearch(n).startsWith("fire")).lastIndexOf(true);

  if (firstContains !== -1) assert.ok(lastPrefix < firstContains, "a substring match outranked a prefix match");
  assert.ok(results.includes("Fire Bolt"));
});

test("search ignores case and accents", () => {
  assert.equal(normalizeForSearch("Café"), "cafe");
  assert.ok(searchByName(spells, "FIRE BOLT").some((s) => s.name === "Fire Bolt"));
});

test("an empty query returns a capped slice rather than everything", () => {
  assert.equal(searchByName(spells, "   ", 10).length, 10);
});

test("filterSpells narrows on each axis and ignores omitted ones", () => {
  const cantrips = filterSpells(spells, { levels: [0] });
  assert.ok(cantrips.length > 0);
  assert.ok(cantrips.every((s) => s.level === 0));

  const concentration = filterSpells(spells, { concentration: true });
  assert.ok(concentration.every((s) => s.concentration === 1));

  const rituals = filterSpells(spells, { ritual: true });
  assert.ok(rituals.length > 0);
  assert.ok(rituals.every((s) => s.ritual === 1));

  assert.equal(filterSpells(spells, {}).length, spells.length);
});

test("filterSpells combines axes conjunctively", () => {
  const result = filterSpells(spells, { levels: [1], concentration: true });
  assert.ok(result.every((s) => s.level === 1 && s.concentration === 1));
});

test("groupByName collapses reprints into one entry with its sources", () => {
  const grouped = groupByName(spells);
  const fireBolt = grouped.find((g) => g.name === "Fire Bolt");

  assert.equal(fireBolt.variants.length, 2);
  assert.ok(grouped.length < spells.length);
});

test("items keep the fields an equipment picker sorts on", () => {
  const withWeight = items.filter((i) => i.weight != null);
  const withRarity = items.filter((i) => i.rarity != null);

  assert.ok(withWeight.length > 0);
  assert.ok(withRarity.length > 0);
  assert.ok(items.every((i) => i.attunement === 0 || i.attunement === 1));
});
