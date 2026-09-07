/**
 * Escribe la hoja ya llena, para poder medirla en un navegador de verdad.
 *
 * `pnpm --filter @bertinis-vault/web exec vite build --ssr probes/hoja-render.ts --outDir .probe`
 * y después `node .probe/hoja-render.js`. Es una herramienta de medición, no
 * una prueba: jsdom no computa cascada, así que lo único que dice si la hoja
 * se ve bien es Chrome, y Chrome necesita el HTML con nuestros datos adentro.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { JSDOM } from "jsdom";

import { initialState, type BuilderState } from "@/lib/builder";
import { resolveDraft } from "@/lib/derive";
import { oglDataFor } from "@/lib/ogl-attrs";
import { renderOgl } from "@/lib/ogl-render";
import { sheetDataFor } from "@/lib/sheet-data";

const hoja = join(process.cwd(), "public", "hoja");
const html = readFileSync(join(hoja, "sheet.html"), "utf8");

const state: BuilderState = {
  ...initialState,
  characterName: "Kaelen Thorne",
  raceId: "human",
  subraceId: "",
  classId: "fighter",
  subclassId: "",
  backgroundId: "soldier",
  weaponId: "longsword",
  str: 16,
};

const resolved = resolveDraft(state);
if (resolved.status !== "ready") throw new Error("no derivó");

const dom = new JSDOM(`<body>${html}</body>`);
const root = dom.window.document.body.firstElementChild!;
// `renderOgl` usa `instanceof HTMLInputElement`, que en jsdom vive en la ventana.
Object.assign(globalThis, {
  HTMLInputElement: dom.window.HTMLInputElement,
  HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
  HTMLSelectElement: dom.window.HTMLSelectElement,
  HTMLElement: dom.window.HTMLElement,
});

renderOgl(root, oglDataFor(sheetDataFor(state, resolved.snapshot, "2014")));
writeFileSync(join(hoja, "sheet-llena.html"), root.outerHTML, "utf8");
console.log("sheet-llena.html escrito");
