import test from "node:test";
import assert from "node:assert/strict";

import {
  addBookVocabulary,
  classifyPage,
  cleanBook,
  dictionaryFromRules,
  dictionaryFromWords,
  dropRunning,
  findRunningKeys,
  fixOcrLine,
  fixOcrToken,
  fixSpacing,
  joinHyphens,
} from "../dist/index.js";

// All text below is invented for the tests; no book text is stored in the repo.

const dict = dictionaryFromWords([
  "a", "an", "animal", "walks", "the", "crumbling", "wall", "strong", "dwarf", "craft",
  "find", "lost", "item", "illusion", "circle", "death", "fall", "of", "no", "thing",
  "well", "known", "wizard", "wizards", "promising", "to", "and", "more", "text",
  "here", "it", "is", "cut", "capital", "chapter", "spells",
]);

const item = (str, x, y, w = str.length * 5, h = 10) => ({ str, x, y, w, h });

test("fixSpacing joins letters spread apart, only into dictionary words", () => {
  assert.deepEqual(fixSpacing("A strong a n i m a l walks", dict), {
    text: "A strong animal walks",
    merged: 5,
  });
  assert.equal(fixSpacing("P romising to fi n d a lost item", dict).text, "Promising to find a lost item");
  assert.equal(fixSpacing("Wizard s walks", dict).text, "Wizards walks");
  assert.equal(fixSpacing("d w a r f- c raft", dict).text, "dwarf- craft");
});

test("fixSpacing leaves two real words alone", () => {
  assert.deepEqual(fixSpacing("no thing", dict), { text: "no thing", merged: 0 });
});

test("joinHyphens joins a cut word and keeps a real compound", () => {
  assert.deepEqual(joinHyphens(["The crum-", "bling wall here"], dict), {
    lines: ["The crumbling", "wall here"],
    joins: 1,
  });
  assert.deepEqual(joinHyphens(["crum-", "bling"], dict).lines, ["crumbling"]);
  assert.equal(joinHyphens(["It is well-", "known here"], dict).lines[0], "It is well-known");
  // A capital after the cut is a new word, not the end of the old one.
  assert.deepEqual(joinHyphens(["a cut-", "Capital"], dict), {
    lines: ["a cut-", "Capital"],
    joins: 0,
  });
});

test("fixOcrToken fixes one confusion into a known word and nothing else", () => {
  assert.equal(fixOcrToken("Cirele", dict), "Circle");
  assert.equal(fixOcrToken("IlIusion", dict), "Illusion");
  assert.equal(fixOcrToken("Fali", dict), "Fall");
  assert.equal(fixOcrToken("(Cirele),", dict), "(Circle),");
  assert.equal(fixOcrToken("Wizard", dict), null); // already a word
  assert.equal(fixOcrToken("Tenser's", dict), null); // unknown, no single fix
  assert.equal(fixOcrToken("cat", dict), null); // too short to trust
  assert.deepEqual(fixOcrLine("Cirele of Death", dict), { text: "Circle of Death", fixes: 1 });
});

test("classifyPage tells empty, spell lists, tables and prose apart", () => {
  assert.equal(classifyPage("abc"), "empty");
  assert.equal(
    classifyPage("WIZARD SPELLS\nCANTRIPS (0 LEVEL)\nBlade Ward\nChill Touch\n1ST LEVEL\nAlarm\nBurning Hands"),
    "spell-list",
  );
  assert.equal(classifyPage("10 20 30 40 50\n60 70 80 90 11\n12 13 14 15 16\nSome heading"), "table");
  assert.equal(
    classifyPage("A long paragraph of running text that goes on and on across a whole line of the page."),
    "prose",
  );
});

function pageWithHeader(n) {
  return {
    page: n,
    width: 400,
    height: 800,
    items: [
      item(`CHAPTER ${n} | SPELLS ${100 + n}`, 40, 780, 320),
      item("A strong a n i m a l walks", 40, 700, 120),
      item("The crum-", 40, 686, 120),
      item("bling wall", 40, 672, 120),
      item("Cirele of Death", 260, 700, 100),
      item("and more text here", 260, 686, 100),
    ],
  };
}

test("running heads and feet are found by repetition, digits aside", () => {
  const pages = [1, 2, 3, 4, 5].map(pageWithHeader);
  const keys = findRunningKeys(pages);
  assert.equal(keys.size, 1);
  const first = pages[0];
  const { items, dropped } = dropRunning(first, keys);
  assert.equal(dropped, 1);
  assert.equal(items.length, first.items.length - 1);
});

test("cleanBook reads columns, drops heads, joins letters and cuts, fixes OCR", () => {
  const book = cleanBook([1, 2, 3].map(pageWithHeader), dict);
  const page = book.pages[0];
  assert.ok(page.text.includes("A strong animal walks"));
  assert.ok(page.text.includes("The crumbling\nwall"));
  assert.ok(page.text.includes("Circle of Death"));
  assert.ok(!page.text.includes("CHAPTER"));
  // The left column is read whole before the right one.
  assert.ok(page.text.indexOf("wall") < page.text.indexOf("Circle"));
  assert.equal(page.fixes.spacingMerges, 5);
  assert.equal(page.fixes.hyphenJoins, 1);
  assert.equal(page.fixes.ocrFixes, 1);
  assert.equal(page.fixes.runningRowsDropped, 1);
  assert.equal(book.totals.hyphenJoins, 3);
  assert.equal(book.textless, false);
});

test("a book of pictures is reported as having no text", () => {
  const pages = Array.from({ length: 5 }, (_, i) => ({ page: i + 1, width: 400, height: 800, items: [] }));
  const book = cleanBook(pages, dict);
  assert.equal(book.textless, true);
  assert.equal(book.kinds.empty, 5);
});

test("the dictionary learns clean repeated words from a book, not damaged ones", () => {
  const d = dictionaryFromRules({ a: "Hello world" });
  addBookVocabulary(d, ["Fireball Fireball Fireball IlIusion IlIusion IlIusion Once"]);
  assert.ok(d.has("hello"));
  assert.ok(d.has("fireball")); // repeated and spelled normally
  assert.ok(!d.has("iliusion")); // damaged
  assert.ok(!d.has("once")); // seen once
});
