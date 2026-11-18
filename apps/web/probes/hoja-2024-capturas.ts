/**
 * Escribe la hoja 2024 ya llena de dos personajes, para sacarle capturas en un
 * navegador de verdad (CI: `.github/workflows/hoja-capturas.yml`).
 *
 * `pnpm --filter @bertinis-vault/web exec vite build --ssr probes/hoja-2024-capturas.ts --outDir .probe`
 * y después `node .probe/hoja-2024-capturas.js <origen>`; deja
 * `public/hoja-2024/_capturas/<pj>.html`. jsdom no computa cascada: lo único que
 * dice si la hoja se ve como el boceto es Chromium mirando estos archivos.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { JSDOM } from "jsdom";

import { buildCanonicalSnapshot } from "@/lib/builder";
import { freshDraft, type BuilderState } from "@/lib/builder-state";
import { hojaDataFor, renderHoja, type HojaRules } from "@/lib/hoja-2024";

const origin = process.argv[2] ?? "http://localhost:4173";
const window = new JSDOM("").window;
Object.assign(globalThis, { DOMParser: window.DOMParser, location: { origin } });

const carpeta = join(process.cwd(), "public", "hoja-2024");
const template = readFileSync(join(carpeta, "hoja.html"), "utf8");
mkdirSync(join(carpeta, "_capturas"), { recursive: true });

const personajes: Record<string, BuilderState> = {
  vin: {
    ...freshDraft("5e-2024"),
    characterName: "Vin",
    classId: "rogue",
    subclassId: "arcane-trickster",
    raceId: "human",
    backgroundId: "criminal",
    level: 5,
    str: 8,
    dex: 18,
    con: 14,
    int: 14,
    wis: 12,
    cha: 10,
    weaponId: "scimitar",
    armorId: "studded-leather-armor",
    extraEquipmentText: "Explorer's Pack\nThieves' Tools\nShortsword",
    alignment: "Caótica Buena",
    appearance: "Pelo negro, capa gris con capucha.",
    notes: "Creció en los callejones de Luthadel.\n\nAprendió a robar antes que a leer.",
  },
  lea: {
    ...freshDraft("5e-2024"),
    characterName: "Lea",
    classId: "wizard",
    subclassId: "school-of-evocation",
    raceId: "elf",
    backgroundId: "sage",
    level: 5,
    str: 8,
    dex: 14,
    con: 14,
    int: 18,
    wis: 12,
    cha: 10,
    cantripsText: "Fire Bolt\nMage Hand\nPrestidigitation",
    spellsText: "Nv1: Magic Missile\nNv1: Shield\nNv2: Misty Step\nNv3: Fireball",
    extraEquipmentText: "Backpack\nQuarterstaff",
  },
};

const reglas = (kind: string) => JSON.parse(readFileSync(join(process.cwd(), "public", "rules", `${kind}.json`), "utf8"));
const rules: HojaRules = { classFeature: reglas("classFeature"), subclassFeature: reglas("subclassFeature"), spell: reglas("spell") };

for (const [clave, state] of Object.entries(personajes)) {
  const build = buildCanonicalSnapshot(state);
  const html = renderHoja(template, hojaDataFor(state, build, "2024", rules));
  writeFileSync(join(carpeta, "_capturas", `${clave}.html`), html, "utf8");
  console.log(`_capturas/${clave}.html`);
}
