import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRef,
  EDITION_THRESHOLD,
  isClassicSource,
  isKnownSource,
  isSourceAllowed,
  setBookLibrary,
  listSources,
  partitionByRulesVersion,
  rulesVersionOf,
  SOURCES,
  sourcesForRulesVersion,
} from "../dist/index.js";

test("the source registry is complete and well formed", () => {
  const codes = Object.keys(SOURCES);

  assert.equal(codes.length, 181);
  for (const code of codes) {
    const meta = SOURCES[code];
    assert.ok(meta.full, `${code} has no title`);
    assert.ok(meta.abv, `${code} has no short label`);
  }
});

test("only Adventurers' League is undated", () => {
  const undated = Object.keys(SOURCES).filter((code) => SOURCES[code].date === null);
  assert.deepEqual(undated, ["AL"]);
});

test("the edition boundary is the 2024 Player's Handbook release", () => {
  assert.equal(EDITION_THRESHOLD, "2024-09-17");
  assert.equal(SOURCES.XPHB.date, EDITION_THRESHOLD);
  assert.equal(SOURCES.XPHB.full, "Player's Handbook (2024)");
  assert.equal(SOURCES.PHB.full, "Player's Handbook (2014)");
});

test("the core books land on the ruleset they belong to", () => {
  for (const source of ["PHB", "DMG", "MM", "XGE", "TCE", "SCAG"]) {
    assert.equal(rulesVersionOf(source), "2014", source);
  }

  for (const source of ["XPHB", "XDMG", "XMM", "XSAC"]) {
    assert.equal(rulesVersionOf(source), "2024", source);
  }
});

test("Xanathar's Guide is 2014 despite the X, since the split is by date", () => {
  // XGE predates the 2024 PHB; only XPHB/XDMG/XMM are the revised core.
  assert.equal(SOURCES.XGE.date, "2017-11-21");
  assert.ok(isClassicSource("XGE"));
});

test("the two rulesets partition the registry with nothing left over", () => {
  const classic = sourcesForRulesVersion("2014");
  const modern = sourcesForRulesVersion("2024");

  assert.equal(classic.length + modern.length, Object.keys(SOURCES).length);
  assert.equal(new Set([...classic, ...modern]).size, Object.keys(SOURCES).length);
  assert.equal(modern.length, 34);
});

test("sources are listed newest first", () => {
  const dates = sourcesForRulesVersion("2024").map((s) => SOURCES[s].date ?? "");
  assert.deepEqual(dates, [...dates].sort().reverse());
});

test("an unknown source is treated as classic rather than throwing", () => {
  // 5etools compares an invalid date against the threshold, which is false.
  assert.equal(isKnownSource("NOT-A-BOOK"), false);
  assert.equal(isClassicSource("NOT-A-BOOK"), true);
  assert.equal(rulesVersionOf("NOT-A-BOOK"), "2014");
});

test("listSources can be scoped to one ruleset or return everything", () => {
  assert.equal(listSources().length, 181);

  const modern = listSources("2024");
  assert.equal(modern.length, 34);
  assert.ok(modern.every((entry) => entry.full));
  assert.ok(modern.some((entry) => entry.source === "XPHB"));
});

test("isSourceAllowed gates a source against the build's ruleset", () => {
  assert.ok(isSourceAllowed("PHB", "2014"));
  assert.ok(!isSourceAllowed("PHB", "2024"));
  assert.ok(isSourceAllowed("XPHB", "2024"));
  assert.ok(!isSourceAllowed("XPHB", "2014"));
});

test("partitionByRulesVersion separates mixed-edition picks instead of dropping them", () => {
  const entries = [
    { ref: buildRef("spell", "Fire Bolt", "PHB") },
    { ref: buildRef("spell", "Fire Bolt", "XPHB") },
    { ref: buildRef("feat", "Alert", "PHB") },
  ];

  const { allowed, rejected } = partitionByRulesVersion(entries, "2014");

  assert.equal(allowed.length, 2);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].ref.source, "XPHB");
});

test("the book library widens or narrows what a table may use", () => {
  try {
    setBookLibrary("core");
    assert.ok(isSourceAllowed("XPHB", "2024"));
    assert.ok(!isSourceAllowed("TCE", "2014"));
    assert.ok(!isSourceAllowed("FRHoF", "2024"));

    setBookLibrary("all");
    // A 2024 table with supplements gets the older ones, not the 2014 core.
    assert.ok(isSourceAllowed("TCE", "2024"));
    assert.ok(isSourceAllowed("SCC", "2024"));
    assert.ok(!isSourceAllowed("PHB", "2024"));
    // A 2014 table never gets 2024 books.
    assert.ok(!isSourceAllowed("XPHB", "2014"));
  } finally {
    setBookLibrary("edition");
  }
});
