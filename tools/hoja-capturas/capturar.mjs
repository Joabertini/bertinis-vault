// Una captura por pestaña de cada hoja escrita por probes/hoja-2024-capturas.ts.
// Uso: node tools/hoja-capturas/capturar.mjs <ruta-a-playwright> <origen> <carpeta-salida>
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const [, , playwrightPath, origin = "http://localhost:4173", out = "capturas"] = process.argv;
const { chromium } = createRequire(import.meta.url)(playwrightPath);

const TABS = ["details", "inventory", "features", "spells", "effects", "biography", "specialTraits"];
const PJS = ["vin", "lea"];

mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 860, height: 740 }, deviceScaleFactor: 1 });
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
page.on("requestfailed", (request) => errors.push(`falló ${request.url()}`));

for (const pj of PJS) {
  await page.goto(`${origin}/hoja-2024/_capturas/${pj}.html`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  for (const tab of TABS) {
    const button = page.locator(`nav.tabs [data-action="tab"][data-tab="${tab}"]`);
    if ((await button.count()) === 0) continue;
    await button.click();
    await page.waitForTimeout(150);
    await page.screenshot({ path: join(out, `${pj}-${tab}.png`), clip: { x: 0, y: 0, width: 850, height: 720 } });
  }
}
// Lo que se toca: cada interacción deja su captura y su registro.
const shot = (name) => page.screenshot({ path: join(out, `int-${name}.png`), clip: { x: 0, y: 0, width: 850, height: 720 } });
const tab = async (name) => {
  await page.click(`nav.tabs [data-action="tab"][data-tab="${name}"]`);
  await page.waitForTimeout(150);
};
const log = [];
await page.goto(`${origin}/hoja-2024/_capturas/vin.html`, { waitUntil: "networkidle" });
await page.evaluate(() => {
  window.__avisos = [];
  addEventListener("message", (e) => window.__avisos.push(e.data));
});
await tab("inventory");
await page.click('section.tab[data-tab="inventory"] li.item:has(.title:text-is("Scimitar")) .item-row .name');
await page.waitForTimeout(200);
await shot("arma-desplegada");
await page.click('section.tab[data-tab="inventory"] .hoja-tirar >> nth=0');
await page.waitForTimeout(150);
await shot("arma-tirada");
const ac = () => page.textContent(".sidebar .ac-badge > div");
log.push(`CA con armadura: ${(await ac()).trim()}`);
await page.click('section.tab[data-tab="inventory"] li.item:has(.title:text-is("Studded Leather Armor")) [data-action="equip"]');
log.push(`CA sin armadura: ${(await ac()).trim()}`);
await shot("armadura-fuera");
await page.click('section.tab[data-tab="inventory"] li.container');
await page.waitForTimeout(500);
await shot("mochila");
await page.click(`section.tab[data-tab="inventory"] li.item:has(.title:text-is("Thieves' Tools")) [data-action="increase"]`);
log.push(`Carga tras +1 herramientas: ${(await page.textContent(".encumbrance .label .value")).trim()}`);
await page.click(".sidebar .meter.hit-points .progress .label");
await page.keyboard.type("-7");
await page.keyboard.press("Enter");
log.push(`Vida tras -7: ${(await page.textContent(".sidebar .meter.hit-points .label .value")).trim()}`);
await page.click(".sidebar .meter.hit-dice");
await page.waitForTimeout(150);
log.push(`Vida tras dado de golpe: ${(await page.textContent(".sidebar .meter.hit-points .label .value")).trim()}, dados ${(await page.textContent(".sidebar .meter.hit-dice .label .value")).trim()}`);
await shot("vida-y-dado");
await tab("details");
await page.click('section.tab[data-tab="details"] li[data-key="ste"] [data-action="roll"]');
await page.waitForTimeout(150);
await page.click('section.tab[data-tab="details"] .pill-lg.race');
await page.waitForTimeout(150);
await shot("especie-y-sigilo");
await tab("features");
await page.click('section.tab[data-tab="features"] li.item:has(.title:text-is("Sneak Attack")) .item-row .name');
await page.waitForTimeout(150);
await shot("rasgo");
await page.click('section.tab[data-tab="features"] .classes .class');
await page.waitForTimeout(150);
await shot("clase");
await tab("effects");
await page.click('.conditions-list .condition[data-condition-id="blinded"] .title');
await page.waitForTimeout(150);
await shot("condicion");
await page.click('.conditions-list .condition[data-condition-id="prone"] i');
await tab("inventory");
await page.click(".window-header .mode-slider");
await page.waitForTimeout(150);
log.push(`Modo edición: ${await page.evaluate(() => document.querySelector("form.application").classList.contains("editable"))}`);
const borrar = 'section.tab[data-tab="inventory"] li.item:has(.title:text-is("Shortsword")) .hoja-borrar';
await page.click(borrar);
await page.click(borrar);
await shot("edicion-inventario");
await tab("details");
await page.click(".sheet-header .document-name");
await page.keyboard.press("End");
await page.keyboard.type(" Venture");
await page.keyboard.press("Enter");
await page.click('.ability-scores .ability-score[data-ability="str"] .score');
await page.keyboard.type("12");
await page.keyboard.press("Enter");
await shot("edicion-detalles");
const cambios = await page.evaluate(() => window.__avisos.filter((a) => a.hoja === "cambio").map((a) => JSON.stringify(a.edit)));
log.push(`Cambios enviados: ${cambios.join(" | ")}`);
await page.click('.sidebar [data-action="toggleSidebar"]');
await page.waitForTimeout(400);
await shot("barra-cerrada");
await page.waitForTimeout(100);
const avisos = await page.evaluate(() => window.__avisos.map((a) => a.hoja));
log.push(`Avisos al marco: ${[...new Set(avisos)].join(", ")}`);
const ultimo = await page.evaluate(() => [...window.__avisos].reverse().find((a) => a.hoja === "estado")?.estado);
log.push(`Estado guardado: ${JSON.stringify(ultimo)}`);
for (const line of log) console.log(line);

await browser.close();
if (errors.length) console.log(errors.join("\n"));
console.log("capturas en", out);
