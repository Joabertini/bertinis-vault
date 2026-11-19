#!/usr/bin/env node
/*
 * P0 measurement: run one book through text extraction and report how much of
 * its known content survives.
 *
 *   node bin/measure.mjs --pdf "<book.pdf>" --sources PHB --type spell \
 *        --rules ../../apps/web/public/rules --out report-phb.json
 *
 * Needs `pdfjs-dist` (the same library the browser engine will use). It is not
 * a dependency of the workspace, so install it next to where you run this:
 *   npm i --no-save pdfjs-dist@4.10.38
 *
 * The book is read from disk and never copied anywhere. Only the numbers and
 * the names that were not found are written to the report.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  addBookVocabulary,
  cleanBook,
  dictionaryFromRules,
  measureBook,
  pageToText,
  referenceFromRules,
  vocabularyFromRules,
} from "../dist/index.js";

function args() {
  const out = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 2) out[argv[i].replace(/^--/, "")] = argv[i + 1];
  return out;
}

const a = args();
for (const need of ["pdf", "sources", "rules"]) {
  if (!a[need]) {
    console.error(`missing --${need}`);
    process.exit(2);
  }
}
const type = a.type ?? "spell";

let pdfjs;
try {
  pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
} catch {
  console.error("pdfjs-dist is not installed: npm i --no-save pdfjs-dist@4.10.38");
  process.exit(2);
}

const doc = await pdfjs.getDocument({
  data: new Uint8Array(readFileSync(a.pdf)),
  disableFontFace: true,
  useSystemFonts: false,
  verbosity: 0,
}).promise;

const pages = [];
for (let n = 1; n <= doc.numPages; n++) {
  const page = await doc.getPage(n);
  const view = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const items = [];
  for (const it of content.items) {
    if (typeof it.str !== "string" || it.str.length === 0) continue;
    const t = it.transform;
    items.push({ str: it.str, x: t[4], y: t[5], w: it.width, h: Math.hypot(t[2], t[3]) || it.height });
  }
  pages.push({ page: n, width: view.width, height: view.height, items });
  page.cleanup();
}

const rules = JSON.parse(readFileSync(join(a.rules, `${type}.json`), "utf8"));
const refs = referenceFromRules(rules, new Set(a.sources.split(",")));

// The vocabulary is every word in every rules file there is (the builder's own text).
const allRules = readdirSync(a.rules)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(join(a.rules, f), "utf8")));
const vocabulary = vocabularyFromRules(...allRules);

// P1: the dictionary also learns the words this book repeats cleanly.
const dict = dictionaryFromRules(...allRules);
addBookVocabulary(dict, pages.map((p) => pageToText(p, true)));
const cleaned = cleanBook(pages, dict);

const reports = [
  { label: "plano", ...measureBook(pages, refs, { columns: false, vocabulary }) },
  { label: "columnas", ...measureBook(pages, refs, { columns: true, vocabulary }) },
  {
    label: "limpio",
    ...measureBook(pages, refs, {
      columns: true,
      vocabulary,
      reader: () => cleaned.pages.map((p) => ({ page: p.page, text: p.text })),
    }),
  },
];
const result = {
  pdf: a.pdf.split(/[\\/]/).pop(),
  type,
  sources: a.sources,
  clean: { totals: cleaned.totals, kinds: cleaned.kinds, textless: cleaned.textless },
  reports,
};
if (a.out) writeFileSync(a.out, JSON.stringify(result, null, 2));

const pct = (x) => `${(x * 100).toFixed(1)} %`;
console.log(
  `${result.pdf} | limpieza: ${cleaned.totals.spacingMerges} uniones de letras, ` +
    `${cleaned.totals.hyphenJoins} cortes unidos, ${cleaned.totals.ocrFixes} OCR corregidos, ` +
    `${cleaned.totals.runningRowsDropped} encabezados/pies quitados | páginas: ` +
    `${cleaned.kinds.prose} texto, ${cleaned.kinds["spell-list"]} listas de conjuros, ` +
    `${cleaned.kinds.table} tablas, ${cleaned.kinds.empty} vacías | sin texto: ${cleaned.textless ? "SÍ" : "no"}`,
);
for (const r of reports) {
  console.log(
    `${result.pdf} | ${r.label} | ${r.pages} págs, ${r.emptyPages} vacías, ` +
      `${r.meanColumns.toFixed(2)} col/pág | ${r.refs} ${type}: encontrados ${pct(r.recall)} ` +
      `(exacto ${pct(r.recallExact)}), página coincide ${pct(r.pageConsistent.rate)} ` +
      `(desfase ${r.pageOffset}) | ruido: ${r.noise.letterSpacedRuns} letras separadas, ` +
      `${r.noise.hyphenBreaks} cortes, ${r.noise.suspectWords} sospechosas, ` +
      `desconocidas ${r.noise.unknownRatio === null ? "n/d" : pct(r.noise.unknownRatio)}`,
  );
}
