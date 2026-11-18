/**
 * Escribe la pantalla "Tu turno" de tres personajes como páginas sueltas, para sacarles capturas
 * en un navegador de verdad (CI: `.github/workflows/hoja-capturas.yml`).
 *
 * `vite build --ssr probes/turno-capturas.ts --outDir .probe-turno` y después
 * `node .probe-turno/turno-capturas.js`; deja `public/turno/_capturas/<pj>.html`.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

import TurnoView from "@/components/codex/TurnoView";
import { buildCanonicalSnapshot } from "@/lib/builder";
import { freshDraft, type BuilderState } from "@/lib/builder-state";
import { HOJA_RULE_KINDS, hojaDataFor, type HojaRules } from "@/lib/hoja-2024";
import { turnoFor } from "@/lib/turno";

const publica = join(process.cwd(), "public");
const carpeta = join(publica, "turno", "_capturas");
mkdirSync(carpeta, { recursive: true });
const reglas = (kind: string) => JSON.parse(readFileSync(join(publica, "rules", `${kind}.json`), "utf8"));
const rules = {
  ...Object.fromEntries(HOJA_RULE_KINDS.map((kind) => [kind, reglas(kind)])),
  classTable: reglas("classTable"),
} as HojaRules;

const personajes: Record<string, BuilderState> = {
  enrique: {
    ...freshDraft("5e-2024"),
    characterName: "Enrique Cavillo",
    classId: "barbarian",
    raceId: "human",
    backgroundId: "farmer",
    level: 1,
    str: 18,
    dex: 14,
    con: 14,
    int: 13,
    wis: 12,
    cha: 12,
    weaponId: "greataxe",
    extraEquipmentText: "greataxe\nhandaxe x4\nexplorer-s-pack",
    bannerImage: "https://api.bertinilabs.xyz/images/wY9hphfGs4fMLVGuwp-aEZ04z5779lR0",
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
  },
};

const css = readFileSync(join(process.cwd(), "src", "styles", "turno.css"), "utf8");

for (const [clave, state] of Object.entries(personajes)) {
  const data = hojaDataFor(state, buildCanonicalSnapshot(state), "2024", rules);
  const turno = turnoFor(data, rules, "2024", {});
  const body = renderToStaticMarkup(<TurnoView turno={turno} onSet={() => {}} onRest={() => {}} />);
  const page = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>@font-face{font-family:"Cinzel";src:url("/fonts/Cinzel-normal.woff2") format("woff2");font-weight:400 900}body{margin:0;background:#050404}${css}</style></head>
<body><div id="app">${body}</div></body></html>`;
  writeFileSync(join(carpeta, `${clave}.html`), page, "utf8");
  console.log(`turno/_capturas/${clave}.html`);
  // El turno en datos, para leerlo en el registro de CI.
  console.log(JSON.stringify({ clave, tips: turno.tips, accion: turno.slots[0]?.options.map((o) => `${o.name} ${o.big}`), adicional: turno.slots[1]?.options.map((o) => `${o.name} ${o.big}`), reacciones: turno.reactions.map((r) => r.name), recursos: turno.resources.map((r) => `${r.name} ${r.max}`), rasgo: turno.feature?.name }));
}
