/**
 * Recorta la hoja de la ventana de roll20 y la deja en `public/hoja/`.
 *
 * La entrada es una captura del DOM ya renderizado (ver
 * `apps/web/vendor/roll20-ogl/ORIGEN.md`), así que no hay nada que traducir ni
 * que expandir: los rótulos ya tienen texto, las listas ya son filas y las
 * clases van sin prefijo, que es como las quiere la CSS de esta hoja.
 *
 * Quedan dos cosas por sacar, las dos ajenas a la hoja:
 *
 * 1. **La ventana de roll20.** La captura trae el diálogo, las pestañas y la
 *    barra de macros del VTT. La hoja es el `.charsheet` de adentro, que es
 *    justamente el nodo al que roll20 le cuelga sus estilos.
 * 2. **El `<script>` del final.** Cancela `submit` y el Enter dentro de un
 *    input. Insertado con `innerHTML` no correría igual.
 *
 * Los datos no se tocan acá: la captura conserva los del personaje con el que
 * se sacó y `ogl-render.ts` los pisa en el navegador.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const vendor = join(here, "..", "apps", "web", "vendor", "roll20-ogl");
const out = join(here, "..", "apps", "web", "public", "hoja");

const OPEN = '<div class="charactersheet';

/**
 * El `.charsheet` entero, contando `<div>` hasta cerrar el que abre.
 *
 * Con expresiones regulares no se puede: el nodo tiene 10.600 líneas y `<div>`
 * anidados hasta doce niveles. Contar es exacto mientras ningún atributo
 * contenga la cadena `<div`, y ninguno la contiene — se verifica abajo.
 */
function extractCharsheet(html) {
  const start = html.indexOf(OPEN);
  if (start < 0) throw new Error("la captura no tiene un .charsheet");

  const tag = /<(\/?)div\b/gi;
  tag.lastIndex = start;

  let depth = 0;
  let match;
  while ((match = tag.exec(html))) {
    depth += match[1] ? -1 : 1;
    if (depth === 0) {
      const end = html.indexOf(">", tag.lastIndex);
      return html.slice(start, end + 1);
    }
  }

  throw new Error("el .charsheet nunca cierra");
}

const source = readFileSync(join(vendor, "captura-v4.21.html"), "utf8");
const sheet = extractCharsheet(source).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");

// Un recorte sano se lleva casi toda la captura. Si se llevó una fracción, la
// cuenta de `<div>` se desincronizó y es mejor romper el build que desplegar
// media hoja.
if (sheet.length < source.length * 0.8) {
  throw new Error(`el recorte quedó en ${sheet.length} de ${source.length} bytes`);
}

const css = join(vendor, "sheet.css");
const hasCss = existsSync(css);

mkdirSync(out, { recursive: true });
writeFileSync(join(out, "sheet.html"), sheet);
writeFileSync(
  join(out, "sheet.css"),
  hasCss
    ? readFileSync(css, "utf8")
    : "/* Falta apps/web/vendor/roll20-ogl/sheet.css — ver ORIGEN.md */\n",
);

const kb = (text) => `${Math.round(text.length / 1024)}KB`;
console.log(`hoja: ${kb(sheet)} de ${kb(source)}`);
if (!hasCss) {
  console.warn("hoja: SIN estilos. Falta apps/web/vendor/roll20-ogl/sheet.css (ver ORIGEN.md)");
}
