import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRef,
  buildSubclassRef,
  dedupeRefs,
  encodeArrayForHash,
  encodeForHash,
  getEntitySource,
  MissingSourceError,
  PROP_TO_PAGE,
  refFromEntity,
} from "../dist/index.js";

/*
 * Expected hashes are taken from real 5etools entries shipped with Plutonium,
 * not constructed by hand, so a drift in the algorithm shows up as a failure
 * rather than as a matching pair of mistakes.
 */

test("spell names encode spaces, slashes and apostrophes the way 5etools does", () => {
  const cases = [
    ["Antipathy/Sympathy", "XPHB", "antipathy%2fsympathy_xphb"],
    ["Blindness/Deafness", "XPHB", "blindness%2fdeafness_xphb"],
    ["Crusader's Mantle", "XPHB", "crusader's%20mantle_xphb"],
    ["Drawmij's Instant Summons", "XPHB", "drawmij's%20instant%20summons_xphb"],
    ["Evard's Black Tentacles", "XPHB", "evard's%20black%20tentacles_xphb"],
    ["Heroes' Feast", "XPHB", "heroes'%20feast_xphb"],
  ];

  for (const [name, source, expected] of cases) {
    assert.equal(encodeArrayForHash(name, source), expected, name);
  }
});

test("percent-encoding is lowercased, so hashes match regardless of hex case", () => {
  // encodeURIComponent emits uppercase hex; 5etools lowercases the result.
  assert.equal(encodeForHash("Antipathy/Sympathy"), "antipathy%2fsympathy");
  assert.equal(encodeForHash("Café"), "caf%c3%a9");

  const encoded = encodeForHash("Café/Über");
  assert.equal(encoded, encoded.toLowerCase());
});

test("characters encodeURIComponent leaves alone stay literal", () => {
  assert.equal(encodeForHash("Mordenkainen's Sword"), "mordenkainen's%20sword");
  assert.equal(encodeForHash("Wish!"), "wish!");
  assert.equal(encodeForHash("A(B)C"), "a(b)c");
});

test("buildRef pairs the hash with the page that owns the prop", () => {
  const ref = buildRef("spell", "Fire Bolt", "PHB");

  assert.deepEqual(ref, {
    page: "spells.html",
    source: "PHB",
    hash: "fire%20bolt_phb",
    prop: "spell",
  });
});

test("every referenceable prop maps to a page", () => {
  for (const [prop, page] of Object.entries(PROP_TO_PAGE)) {
    assert.match(page, /\.html$/, prop);
    assert.equal(buildRef(prop, "X", "PHB").page, page);
  }
});

test("item variants take their source from the parent they inherit", () => {
  // Real `magicvariant` entries carry no `source` of their own.
  const variant = { name: "+1 Ammunition", inherits: { source: "DMG" } };

  assert.equal(getEntitySource(variant), "DMG");
  assert.deepEqual(refFromEntity("magicvariant", variant), {
    page: "items.html",
    source: "DMG",
    hash: "%2b1%20ammunition_dmg",
    prop: "magicvariant",
  });
});

test("variants sharing a name are told apart by their inherited source", () => {
  // "+1 Ammunition" exists twice, once under DMG and once under XDMG.
  const dmg = refFromEntity("magicvariant", { name: "+1 Ammunition", inherits: { source: "DMG" } });
  const xdmg = refFromEntity("magicvariant", { name: "+1 Ammunition", inherits: { source: "XDMG" } });

  assert.notEqual(dmg.hash, xdmg.hash);
});

test("a leading plus is percent-encoded", () => {
  assert.equal(encodeForHash("+1 Arcane Grimoire"), "%2b1%20arcane%20grimoire");
});

test("an entity's own source wins over an inherited one", () => {
  const entity = { name: "Shield", source: "PHB", inherits: { source: "DMG" } };
  assert.equal(getEntitySource(entity), "PHB");
});

test("an entity with no source anywhere is rejected rather than guessed", () => {
  assert.throws(() => refFromEntity("item", { name: "Mystery Box" }), MissingSourceError);
});

test("dedupeRefs sums quantities for the same document", () => {
  const torch = buildRef("item", "Torch", "PHB");
  const rope = buildRef("item", "Rope, Hempen (50 feet)", "PHB");

  const result = dedupeRefs([
    { ref: torch, quantity: 5 },
    { ref: rope, quantity: 1 },
    { ref: torch, quantity: 5 },
  ]);

  assert.equal(result.length, 2);
  assert.equal(result[0].quantity, 10);
  assert.equal(result[1].quantity, 1);
});

test("dedupeRefs keeps entries that differ only by source", () => {
  const entries = [
    { ref: buildRef("spell", "Fire Bolt", "PHB") },
    { ref: buildRef("spell", "Fire Bolt", "XPHB") },
  ];

  assert.equal(dedupeRefs(entries).length, 2);
});

test("dedupeRefs leaves unquantified entries alone", () => {
  const bolt = buildRef("spell", "Fire Bolt", "PHB");
  const result = dedupeRefs([{ ref: bolt, prepared: true }, { ref: bolt, prepared: true }]);

  assert.equal(result.length, 1);
  assert.equal(result[0].quantity, undefined);
  assert.equal(result[0].prepared, true);
});

test("a subclass hashes as state on its class's page, not as an entity", () => {
  // Read from `UrlUtil.URL_TO_HASH_BUILDER["subclass"]` in the Plutonium
  // bundle: the class hash, then the subclass as a state part.
  const ref = buildSubclassRef({
    name: "School of Abjuration",
    source: "PHB",
    className: "Wizard",
    classSource: "PHB",
    shortName: "Abjuration",
  });

  assert.equal(ref.hash, "wizard_phb,state:sub_abjuration_phb=b1");
  assert.equal(ref.page, "classes.html");
  assert.equal(ref.source, "PHB");
  assert.equal(ref.prop, "subclass");
});

test("a subclass falls back to its full name when it has no short name", () => {
  const ref = buildSubclassRef({
    name: "Bladesinging",
    source: "TCE",
    className: "Wizard",
    classSource: "PHB",
  });

  assert.equal(ref.hash, "wizard_phb,state:sub_bladesinging_tce=b1");
});

test("a subclass hangs off the class edition it was attached to", () => {
  // The 2024 Wizard's own subclasses live under XPHB, and their class part
  // differs from the 2014 ones even where the subclass name would not.
  const ref = buildSubclassRef({
    name: "Abjurer",
    source: "XPHB",
    className: "Wizard",
    classSource: "XPHB",
    shortName: "Abjurer",
  });

  assert.equal(ref.hash, "wizard_xphb,state:sub_abjurer_xphb=b1");
});
