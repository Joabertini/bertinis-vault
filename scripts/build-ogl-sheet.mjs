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

/**
 * Enciende el modo oscuro de la propia hoja.
 *
 * La hoja lo trae hecho —281 selectores, y 44 de ellos cambian el arte de
 * fondo por su versión `_dm.svg`—, pero cuelga de `.sheet-darkmode` puesta en
 * un **descendiente** de `.charsheet`, no en la raíz. Así que hay que meter un
 * nivel. Ninguna regla usa `.charsheet > algo`, así que el nivel de más no
 * desacomoda nada; se verificó sobre la CSS antes de escribir esto.
 *
 * Y son dos niveles, no uno. 59 de esos selectores nombran `.charsheet` **dos
 * veces** —`.charsheet .sheet-darkmode .charsheet .label`— porque en roll20 el
 * primero es su diálogo y el segundo la hoja de adentro. En un recorte con un
 * solo `.charsheet` no matchean, y entre ellos está el que le da color a los
 * rótulos: quedaban en el gris #333 del modo claro, ilegibles sobre negro.
 *
 * Medido sobre la CSS: con un nivel enganchan 140 de 281; con los dos, 180.
 * Los 101 que faltan son kingmaker, NPC y el charmancer, caras que no
 * mostramos.
 *
 * Es envolver el contenido, no reemplazarlo: la raíz sigue siendo el
 * `.charsheet` del que cuelga todo lo demás.
 */
function wrapInDarkmode(html) {
  const open = html.indexOf(">") + 1;
  const close = html.lastIndexOf("</div>");
  if (open < 1 || close < open) throw new Error("no se pudo envolver el .charsheet");

  const inner = html.slice(open, close);
  return `${html.slice(0, open)}<div class="sheet-darkmode"><div class="charsheet">${inner}</div></div>${html.slice(close)}`;
}

const source = readFileSync(join(vendor, "captura-v4.21.html"), "utf8");
const clipped = extractCharsheet(source).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");

// Un recorte sano se lleva casi toda la captura. Si se llevó una fracción, la
// cuenta de `<div>` se desincronizó y es mejor romper el build que desplegar
// media hoja.
if (clipped.length < source.length * 0.8) {
  throw new Error(`el recorte quedó en ${clipped.length} de ${source.length} bytes`);
}

/**
 * El idioma, que la captura trae sin resolver.
 *
 * La raíz vino con `lang-undefined` —roll20 la escribe antes de saber el
 * idioma y no la vuelve a tocar—, y la hoja tiene **27 reglas `.lang-es`**: las
 * pestañas y los interruptores están posicionados en absoluto con anchos
 * calibrados por idioma, porque "SPELLS" mide 60px y "CONJUROS" 88.
 *
 * Con la clase mal, esas 27 reglas quedan muertas y las etiquetas en español
 * se dibujan en las cajas del inglés: por eso PÚBLICO se comía a AL DJ y
 * CONJUROS quedaba cortada. No hacía falta escribir CSS, hacía falta que la
 * hoja supiera en qué idioma está.
 */
/**
 * Un rótulo que roll20 tradujo sin el espacio.
 *
 * La cadena en español de `class-level-u` es literalmente `CLASEY NIVEL`, y así
 * viene en la captura. No es nuestro y no hay forma de arreglarlo desde la CSS:
 * es texto, y está mal en el origen.
 *
 * Se cambia acá, sobre el recorte, y no en `captura-v4.21.html`, que es una
 * copia del DOM tal como lo entregó roll20 y tiene que seguir siéndolo — la
 * captura es la prueba de dónde salió la hoja, no un archivo que editamos.
 */
const sheet = wrapInDarkmode(clipped)
  .replace("lang-undefined", "lang-es")
  .replace(/>CLASEY NIVEL</g, ">CLASE Y NIVEL<");

/**
 * El arte de la hoja, cambiado por el del modo oscuro.
 *
 * Los fondos de la hoja son imágenes —el papel, los marcos, las cajas de
 * característica— y roll20 publica cada una en dos versiones. Encender
 * `.sheet-darkmode` cambia sólo las que sus propias reglas alcanzan, y las
 * suyas suponen un DOM que nuestro recorte no tiene entero: quedaban claras la
 * caja de las constantes, el borde de la bio, las monedas.
 *
 * Como acá **no hay modo claro** —la hoja se muestra siempre oscura—, no hace
 * falta pelear especificidad con cada selector suyo: alcanza con cambiar la
 * imagen en la única CSS que servimos.
 *
 * La lista es la de las que existen de verdad. Se comprobó una por una contra
 * el bucket, y de las 40 imágenes que usa el modo claro, 29 tienen par oscuro;
 * las 11 que faltan son plantillas de tirada del chat y el logo, que no se ven
 * en la hoja.
 */
const DARK_ART = [
  "vitals", "vital-box", "vital-top", "vital-mid", "vital-bottom",
  "CharScroll", "BioScroll", "SpellScroll", "ScrollRight",
  "CharBox", "SpellBox", "SpellHeadBlock", "5eBorder",
  "ability-back", "ability-STR", "ability-DEX", "ability-CNS",
  "ability-INT", "ability-WIS", "ability-CHA",
  "inspiration", "proficency-bonus", "proficiency-block", "saves",
  "AC", "perception", "copper", "silver", "electrum",
];

const DARK_BASE = "https://storage.googleapis.com/char-sheet-app-images-6e101411/D%26D5e/images/darkmode";

/**
 * Lo que el diálogo de roll20 se llevaba puesto.
 *
 * La hoja vive dentro de su ventana, así que 15 reglas están escritas como
 * `.charsheet .ui-dialog .charsheet …`: el primero es la ventana, el segundo la
 * hoja. Nosotros recortamos la hoja y dejamos la ventana afuera, así que esas
 * 15 no matchean nunca.
 *
 * Entre ellas está la que esconde los controles de fila —mover, borrar, el
 * candado—, que roll20 sólo muestra cuando la lista está en modo edición. Sin
 * esa regla el `<div>` queda en su `display: block` de fábrica y los botones se
 * dibujan encima de cada fila.
 *
 * **Acá hubo un intento peor y conviene que quede escrito.** Se reescribía el
 * selector para encender las 15 de una, y las otras catorce no son inocentes:
 * `input { height: auto }` le saca la altura fija a todos los campos y
 * `button[type=roll] { font-size: 1.3em }` les cambia el cuerpo. Medido contra
 * la hoja sin tocar: el botón de SALVACIONES CONTRA MUERTE pasaba de 24px de
 * alto a 8, el de DADOS DE GOLPE de 12 a 8, y BONIFICACIÓN POR COMPETENCIA
 * ocupaba dos renglones en una caja de uno. Catorce reglas ajenas de daño para
 * conseguir una.
 *
 * Así que la que hace falta se escribe en `parches.css`, que es donde va lo
 * nuestro, y las otras catorce se quedan afuera, que es donde estaban.
 */

function useDarkArt(text) {
  let changed = 0;
  const swapped = text.replace(/url\("(https:\/\/[^"]*?)\/([^"/]+)\.(svg|png)"\)/g, (whole, base, name, ext) => {
    // Las que ya son oscuras se dejan como están.
    if (base.endsWith("/darkmode") || !DARK_ART.includes(name)) return whole;
    changed += 1;
    return `url("${DARK_BASE}/${name}_dm.${ext}")`;
  });

  return { swapped, changed };
}

const css = join(vendor, "sheet.css");
const hasCss = existsSync(css);

// Los parches van **después** de la hoja de roll20, que es lo que les deja
// tapar lo que ella da por sentado. Son dos archivos y no uno a propósito:
// `sheet.css` es ajena y se vuelve a bajar entera cuando haga falta.
const patches = readFileSync(join(vendor, "parches.css"), "utf8");

const art = useDarkArt(
  hasCss
    ? readFileSync(css, "utf8")
    : "/* Falta apps/web/vendor/roll20-ogl/sheet.css — ver ORIGEN.md */\n",
);

mkdirSync(out, { recursive: true });
writeFileSync(join(out, "sheet.html"), sheet);
writeFileSync(
  join(out, "sheet.css"),
  `${art.swapped}\n${patches}`,
);

const kb = (text) => `${Math.round(text.length / 1024)}KB`;
console.log(`hoja: ${kb(sheet)} de ${kb(source)}, ${art.changed} imágenes al modo oscuro`);
if (!hasCss) {
  console.warn("hoja: SIN estilos. Falta apps/web/vendor/roll20-ogl/sheet.css (ver ORIGEN.md)");
}
