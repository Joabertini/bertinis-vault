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
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { measureBook, referenceFromRules, vocabularyFromRules } from "../dist/index.js";

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
const vocabulary = vocabularyFromRules(rules);

const reports = [false, true].map((columns) => measureBook(pages, refs, { columns, vocabulary }));
const result = { pdf: a.pdf.split(/[\\/]/).pop(), type, sources: a.sources, reports };
if (a.out) writeFileSync(a.out, JSON.stringify(result, null, 2));

const pct = (x) => `${(x * 100).toFixed(1)} %`;
for (const r of reports) {
  console.log(
    `${result.pdf} | columnas ${r.columns ? "sí" : "no"} | ${r.pages} págs, ${r.emptyPages} vacías, ` +
      `${r.meanColumns.toFixed(2)} col/pág | ${r.refs} ${type}: encontrados ${pct(r.recall)} ` +
      `(exacto ${pct(r.recallExact)}), página coincide ${pct(r.pageConsistent.rate)} ` +
      `(desfase ${r.pageOffset}) | ruido: ${r.noise.letterSpacedRuns} letras separadas, ` +
      `${r.noise.hyphenBreaks} cortes, ${r.noise.suspectWords} sospechosas, ` +
      `desconocidas ${r.noise.unknownRatio === null ? "n/d" : pct(r.noise.unknownRatio)}`,
  );
}
