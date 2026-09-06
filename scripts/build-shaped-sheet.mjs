/**
 * Turns the vendored roll20 sheet into something a browser can render.
 *
 * A roll20 sheet is not a document, it is a form roll20 assembles at upload
 * time. Three of the things roll20 does are missing when the file is served as
 * it sits in the repository, and this script does two of them (the third, the
 * data, happens at runtime in `shaped-render.ts`):
 *
 * 1. **Roll20 prefixes every class in the HTML with `sheet-`.** The stylesheet
 *    is written against the prefixed names — `.sheet-wrapper`, `.sheet-heading`
 *    — while the HTML carries them bare. 659 distinct classes, 7 of them
 *    already prefixed. Unprefixed, the sheet renders as an unstyled column of
 *    inputs; this is the single step that makes it look like the sheet.
 * 2. **Sheet workers never run outside roll20.** `<script type="text/worker">`
 *    blocks talk to `getAttrs`/`setAttrs`, an API that does not exist here.
 *    They are stripped: 195KB of JavaScript that could only throw.
 *
 * What is deliberately *not* touched: `.repcontainer`, `.repitem` and
 * `.repcontrol` are roll20's own wrappers around repeating rows, and the
 * stylesheet targets them unprefixed. The renderer emits them by hand.
 *
 * Run by `pnpm shaped:build`, and by the web build before Vite copies
 * `public/`.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const vendor = join(here, "..", "apps", "web", "vendor", "5eshaped");
const out = join(here, "..", "apps", "web", "public", "hoja");

/** Classes roll20 owns rather than the sheet author. Left exactly as written. */
const NOT_OURS = /^(repeating_|sheet-|charsheet$|repcontainer$|repitem$|repcontrol$)/;

function prefixClasses(html) {
  return html.replace(/\sclass="([^"]*)"/g, (whole, value) => {
    const prefixed = value
      .split(/\s+/)
      .filter(Boolean)
      .map((token) => (NOT_OURS.test(token) ? token : `sheet-${token}`))
      .join(" ");
    return ` class="${prefixed}"`;
  });
}

function stripWorkers(html) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
}

/**
 * Spanish where the sheet has it, English where it does not.
 *
 * The Shaped sheet ships all 1022 keys in every language file, but only 199 of
 * the Spanish ones are actually translated and two are blank strings. A blank
 * would render as a heading with no words, which reads as our bug, so English
 * is the floor rather than the empty string.
 */
function mergedLabels() {
  const es = JSON.parse(readFileSync(join(vendor, "labels-es.json"), "utf8"));
  const en = JSON.parse(readFileSync(join(vendor, "labels-en.json"), "utf8"));

  const merged = {};
  for (const key of new Set([...Object.keys(en), ...Object.keys(es)])) {
    merged[key] = String(es[key] ?? "").trim() || String(en[key] ?? "").trim() || key;
  }
  return merged;
}

const source = readFileSync(join(vendor, "5eShaped.html"), "utf8");
const sheet = prefixClasses(stripWorkers(source));

mkdirSync(out, { recursive: true });
writeFileSync(join(out, "sheet.html"), sheet);
writeFileSync(join(out, "sheet.css"), readFileSync(join(vendor, "5eShaped.css"), "utf8"));
writeFileSync(join(out, "labels.json"), JSON.stringify(mergedLabels()));

const kb = (text) => `${Math.round(text.length / 1024)}KB`;
console.log(
  `hoja: ${kb(sheet)} de HTML (de ${kb(source)}), ` +
    `${(sheet.match(/class="sheet-/g) ?? []).length} clases prefijadas`,
);
