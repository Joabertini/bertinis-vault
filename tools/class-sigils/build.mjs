/**
 * Genera packages/forge/src/class-sigils.ts: el canon de sigilos de clase.
 *
 * Forma: la de cada clase en class-icon-paths.ts (game-icons). Estilo: el emblema
 * de «Misión cumplida» (Errante): el contorno pasado por Rough.js, en color y con
 * un núcleo claro, más dos anillos irregulares. Los trazos se fijan acá, con
 * semillas fijas, para que la web no cargue Rough.js y cada clase se vea siempre igual.
 *
 * Uso:  ROUGHJS=<carpeta node_modules/roughjs> node tools/class-sigils/build.mjs
 *       (o con roughjs@4.6.6 instalado donde node lo encuentre)
 */
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const rough = require(process.env.ROUGHJS ? resolve(process.env.ROUGHJS, "bundled/rough.cjs.js") : "roughjs");
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const src = readFileSync(resolve(ROOT, "packages/forge/src/class-icon-paths.ts"), "utf8");
const ICONS = JSON.parse(src.slice(src.indexOf("= {") + 2, src.lastIndexOf("}") + 1));

/** Color por clase (aprobado 2026-11-17): el color es de la clase, no del rol. */
const COLOR = {
  rojo: ["#ff5a1f", "#ffe1c2"],
  verde: ["#5fd36a", "#e3ffd9"],
  plata: ["#c9d6e6", "#ffffff"],
  amarillo: ["#f2b437", "#fff1c9"],
  azul: ["#7fc4ff", "#e3f3ff"],
  violeta: ["#a76bff", "#eadcff"],
};
const DE = {
  barbarian: "rojo", fighter: "rojo", monk: "rojo", rogue: "rojo",
  druid: "verde", ranger: "verde",
  cleric: "plata", paladin: "plata",
  bard: "amarillo",
  artificer: "azul",
  wizard: "violeta", sorcerer: "violeta", warlock: "violeta",
};
/** Dibujos que irradian: se agrandan y se recortan al círculo para llenar el anillo. */
const FILL_CIRCLE = { warlock: 1.24 };

const gen = rough.generator();
let seed = 7;
const trim = (d) => d.replace(/-?\d+\.\d+/g, (n) => String(Math.round(Number(n) * 10) / 10));

const out = {};
for (const [id, tone] of Object.entries(DE)) {
  const glyph = [];
  for (const d of ICONS[id].paths) {
    const drawable = gen.path(d, { roughness: 1.1, bowing: 0.6, strokeWidth: 11, fill: "none", seed: seed++ });
    for (const p of gen.toPaths(drawable)) glyph.push(trim(p.d));
  }
  const rings = [];
  for (const [r, rug] of [[300, 1.6], [338, 2.4]]) {
    for (const p of gen.toPaths(gen.circle(256, 256, r * 2, { roughness: rug, strokeWidth: 3, seed: seed++ }))) rings.push(trim(p.d));
  }
  const [color, core] = COLOR[tone];
  out[id] = { color, core, glyph: glyph.join(" "), rings: rings.join(" "), ...(FILL_CIRCLE[id] ? { fillCircle: FILL_CIRCLE[id] } : {}) };
}

const ts = `/**
 * Generado por tools/class-sigils/build.mjs; no editar a mano.
 *
 * El canon de sigilos de clase D&D: forma de class-icon-paths (game-icons, CC BY 3.0),
 * trazo a mano luminoso y color por clase. viewBox del dibujo 512x512; los anillos
 * llegan a un radio de ~340 alrededor del centro (256, 256).
 */
export type ClassSigilArt = {
  color: string;
  core: string;
  /** El contorno, ya pasado por Rough.js. */
  glyph: string;
  /** Dos anillos irregulares alrededor. */
  rings: string;
  /** Agrandar el dibujo por este factor y recortarlo al círculo. */
  fillCircle?: number;
};

export const CLASS_SIGILS: Record<string, ClassSigilArt> = ${JSON.stringify(out)};
`;
writeFileSync(resolve(ROOT, "packages/forge/src/class-sigils.ts"), ts);
console.log(Object.keys(out).length, "clases,", (ts.length / 1024).toFixed(0), "KB");
