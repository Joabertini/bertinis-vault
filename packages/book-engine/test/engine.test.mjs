import test from "node:test";
import assert from "node:assert/strict";

import {
  editDistance,
  fold,
  groupLines,
  locate,
  indexPages,
  measureBook,
  measureNoise,
  pageToText,
  referenceFromRules,
  splitColumns,
  squash,
  vocabularyFromRules,
} from "../dist/index.js";

// All text below is invented for the tests; no book text is stored in the repo.

const item = (str, x, y, w = str.length * 5, h = 10) => ({ str, x, y, w, h });

test("fold and squash make different spellings comparable", () => {
  assert.equal(fold("  Bola  de FUEGO "), "bola de fuego");
  assert.equal(fold("Nystul’s Magic"), "nystul's magic");
  assert.equal(fold("Crítico"), "critico");
  assert.equal(squash("a n i m a l"), "animal");
});

test("editDistance counts wrong letters and gives up past the limit", () => {
  assert.equal(editDistance("circle", "circle", 2), 0);
  assert.equal(editDistance("cirele", "circle", 2), 2);
  assert.equal(editDistance("abcdef", "uvwxyz", 2), 3);
});

test("groupLines joins runs on one baseline and spaces real gaps only", () => {
  const lines = groupLines([
    item("Hel", 0, 100, 15),
    item("lo", 15, 100, 10), // touching: same word
    item("world", 40, 100, 25), // gap: new word
    item("Second line", 0, 80, 55),
  ]);
  assert.deepEqual(
    lines.map((l) => l.text),
    ["Hello world", "Second line"],
  );
});

function twoColumnPage() {
  // Left column at x 40..140, right column at x 260..360, page 400 wide.
  const items = [];
  for (let row = 0; row < 6; row++) {
    const y = 700 - row * 14;
    items.push(item(`left ${row}`, 40, y, 100));
    items.push(item(`right ${row}`, 260, y, 100));
  }
  return { page: 1, width: 400, height: 800, items };
}

test("splitColumns finds the gutter and reads one column after the other", () => {
  const page = twoColumnPage();
  assert.equal(splitColumns(page.items, page.width).length, 2);

  const columns = pageToText(page, true).split("\n");
  assert.equal(columns[0], "left 0");
  assert.equal(columns[5], "left 5");
  assert.ok(columns.indexOf("right 0") > columns.indexOf("left 5"));

  // Without columns the lines run across and mix the two.
  assert.equal(pageToText(page, false).split("\n")[0], "left 0 right 0");
});

test("a full-width title does not hide the gutter", () => {
  const page = twoColumnPage();
  page.items.push(item("A TITLE ACROSS THE WHOLE PAGE", 40, 760, 320));
  assert.equal(splitColumns(page.items, page.width).length, 2);
});

test("measureNoise counts the known kinds of dirt", () => {
  const text = "A strong a n i m a l walks.\nThe crum-\nbling wall. IlIusion and Cirele.";
  const noise = measureNoise(text);
  assert.equal(noise.letterSpacedRuns, 1);
  assert.equal(noise.hyphenBreaks, 1);
  assert.ok(noise.suspectWords >= 1);
  assert.equal(noise.unknownRatio, null);

  const vocab = new Set(["strong", "walks", "the", "wall", "and"]);
  const withVocab = measureNoise("strong walks zzzz", vocab);
  assert.ok(Math.abs((withVocab.unknownRatio ?? 0) - 1 / 3) < 1e-9);
});

test("referenceFromRules keeps only the wanted books and reads the page", () => {
  const rules = {
    "fireball|a": { name: "Fireball", source: "A", page: 241 },
    "fireball|b": { name: "Fireball", source: "B" },
    "x|a": { name: "Other", source: "A" },
  };
  const refs = referenceFromRules(rules, new Set(["A"]));
  assert.equal(refs.length, 2);
  assert.equal(refs.find((r) => r.name === "Fireball")?.page, 241);
  assert.equal(refs.find((r) => r.name === "Other")?.page, null);
});

test("vocabularyFromRules collects the words of every string", () => {
  const vocab = vocabularyFromRules({ a: ["Hello World", { b: "Ñandú" }] });
  assert.ok(vocab.has("hello"));
  assert.ok(vocab.has("world"));
  assert.ok(vocab.has("nandu"));
});

test("locate tries exact, then ignoring spaces, then a few wrong letters", () => {
  const index = indexPages([
    { page: 1, text: "Magic Missile is a spell.\nNothing else here." },
    { page: 2, text: "A strong f i r e b a l l appears." },
    { page: 3, text: "CIRELE OF DEATH\n6th-level necromancy" },
  ]);
  assert.deepEqual(locate("Magic Missile", index), { kind: "exact", pages: [1] });
  assert.deepEqual(locate("Fireball", index), { kind: "squash", pages: [2] });
  assert.deepEqual(locate("Circle of Death", index), { kind: "fuzzy", pages: [3] });
  assert.deepEqual(locate("Wish", index), { kind: null, pages: [] });
});

test("measureBook reports recall, the page offset and what is missing", () => {
  const page = (n, text) => ({
    page: n,
    width: 400,
    height: 800,
    items: [item(text, 40, 700, 300)],
  });
  const pages = [
    page(1, "cover"),
    page(2, "Alpha Spell is here and the rest of the page text"),
    page(3, "Beta Spell is here and the rest of the page text"),
    page(4, "A  m  i  s  s  i  n  g  page with more text on it"),
  ];
  const refs = [
    { key: "alpha spell|t", name: "Alpha Spell", source: "T", page: 1 },
    { key: "beta spell|t", name: "Beta Spell", source: "T", page: 2 },
    { key: "gamma spell|t", name: "Gamma Spell", source: "T", page: 3 },
  ];
  const report = measureBook(pages, refs, { columns: true });
  assert.equal(report.pages, 4);
  assert.equal(report.emptyPages, 1); // the cover is under 20 characters
  assert.equal(report.found.exact, 2);
  assert.equal(report.found.missing, 1);
  assert.deepEqual(report.missing, ["Gamma Spell"]);
  assert.equal(report.pageOffset, 1);
  assert.equal(report.pageConsistent.ok, report.pageConsistent.checked);
  assert.ok(Math.abs(report.recall - 2 / 3) < 1e-9);
});
