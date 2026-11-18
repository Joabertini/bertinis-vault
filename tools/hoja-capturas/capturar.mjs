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
await browser.close();
if (errors.length) console.log(errors.join("\n"));
console.log("capturas en", out);
