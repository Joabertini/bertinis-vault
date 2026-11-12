/**
 * Escribe nuestro personaje encima del que trae la captura.
 *
 * La hoja vendorizada no es una plantilla vacía: es el DOM de roll20 con un
 * personaje adentro (ver `vendor/roll20-ogl/ORIGEN.md`). Eso cambia el trabajo
 * respecto de una hoja recién subida. No hay que traducir rótulos ni clonar
 * `<fieldset>`; hay que **borrar lo que quedó del otro personaje** antes de
 * escribir lo nuestro, porque un dato que no mapeamos no se ve vacío: se ve con
 * el valor de Gritko, que es peor que no verlo.
 *
 * Qué se borra y qué no:
 *
 * - **Se borra** lo que se lee: `<span name="attr_x">`, los `<input type=text>`
 *   y los `<textarea>`.
 * - **No se toca** lo escondido: `type=hidden`, `checkbox`, `radio` y `select`.
 *   Ahí no hay texto que leer, y son los que dejan a la hoja en el estado en el
 *   que la sacamos — `attr_npc` en 0 es lo que hace que se dibuje la cara de
 *   personaje y no la de monstruo. Vaciarlos apaga la hoja entera.
 *
 * Sin React para poder probarlo en jsdom contra el HTML de verdad, que es la
 * única forma de saber que un nombre sigue existiendo: un `attr_` mal escrito
 * no falla, deja la casilla vacía.
 */

import type { OglData, OglRow, OglValue } from "@bertinis-vault/forge/ogl-attrs";

export type { OglData, OglRow, OglValue } from "@bertinis-vault/forge/ogl-attrs";

const isText = (element: Element): boolean =>
  element instanceof HTMLInputElement &&
  (element.type === "text" || element.type === "number" || element.type === "");

/**
 * Escribe un valor donde lo escribiría roll20.
 *
 * El **atributo** `value` importa tanto como la propiedad: la hoja prende y
 * apaga bloques enteros con selectores como `.npc_toggle[value="1"] ~ .pc`, y
 * un selector de atributo nunca ve una asignación de propiedad.
 */
export function writeValue(element: Element, value: OglValue): void {
  const text = String(value);

  if (element instanceof HTMLInputElement) {
    if (element.type === "checkbox" || element.type === "radio") {
      // El `value` de estas casillas no es un dato, es la fórmula que roll20
      // tira: `value="(@{pb}*@{acrobatics_type})"`. Lo que decide el tilde es
      // nuestro "1" / "0", no una comparación contra esa fórmula.
      const on = text === "1" || text === "on" || text === "true";
      element.checked = on;
      element.toggleAttribute("checked", on);
      return;
    }
    element.value = text;
    element.setAttribute("value", text);
    return;
  }

  if (element instanceof HTMLTextAreaElement) {
    element.value = text;
    element.textContent = text;
    return;
  }

  if (element instanceof HTMLSelectElement) {
    element.value = text;
    // La propiedad sola no llega: la hoja se monta con `importNode`, y clonar
    // devuelve cada opción a su atributo `selected`. Sin mover el atributo, el
    // desplegable vuelve al de la captura — o a la primera opción si la
    // captura no marcaba ninguna, que es como el dado de golpe terminaba en d4.
    for (const option of element.options) {
      option.toggleAttribute("selected", option.value === text);
    }
    return;
  }

  element.textContent = text;
}

/** Borra lo que se lee, deja lo que gobierna la hoja. Ver el encabezado. */
function clearValue(element: Element): void {
  // Un `<select>` es un elemento con texto adentro, y ese texto son sus
  // opciones. Vaciarlo no borra un dato: deja el desplegable sin nada que
  // elegir y se lleva puestos los rótulos de la hoja.
  if (element instanceof HTMLSelectElement) return;

  if (element instanceof HTMLTextAreaElement) {
    element.value = "";
    element.textContent = "";
    return;
  }

  if (element instanceof HTMLInputElement) {
    if (!isText(element)) return;
    element.value = "";
    element.removeAttribute("value");
    return;
  }

  if (element instanceof HTMLElement) element.textContent = "";
}

/** Todo lo atado a un atributo, salteando las filas si se pide. */
function boundElements(root: ParentNode, insideRows: boolean): Element[] {
  const all = [...root.querySelectorAll("[name^='attr_']")];
  return insideRows ? all : all.filter((element) => !element.closest(".repitem"));
}

export function applyAttrs(root: ParentNode, attrs: Record<string, OglValue>): void {
  for (const element of boundElements(root, true)) {
    const name = element.getAttribute("name");
    if (!name) continue;

    const value = attrs[name];
    if (value !== undefined) writeValue(element, value);
  }
}

export function clearBound(root: ParentNode, insideRows: boolean): void {
  for (const element of boundElements(root, insideRows)) clearValue(element);
}

/**
 * Rehace cada lista con nuestras filas.
 *
 * Un grupo aparece más de una vez —`repeating_attack` está en la página de
 * personaje, en la de conjuros y en la versión imprimible—, así que se recorren
 * todos los contenedores y no el primero. La fila que se clona es una de las
 * que ya están: trae el `.itemcontrol` y las clases que roll20 le puso, que es
 * lo que la CSS busca. Si no hay ninguna, sirve el `<fieldset>` plantilla que
 * la hoja deja escondido al lado.
 *
 * Se vacían **todos** los contenedores, también los grupos que el mapa no
 * cubre. Una fila de la captura es del personaje con el que se sacó, y no hay
 * quién la borre después: `clearBound` saltea el interior de las filas para no
 * pisar lo que acá se escribe, así que una fila que sobreviva a esta pasada
 * queda a la vista para siempre. Es lo que pasaba con las herramientas y los
 * recursos de Gritko, que no son grupos nuestros y se dibujaban igual.
 */
export function applyRows(root: ParentNode, rows: Record<string, OglRow[]>): void {
  for (const container of root.querySelectorAll(".repcontainer[data-groupname]")) {
    const group = container.getAttribute("data-groupname") ?? "";
    const entries = rows[group];

    const existing = container.querySelector(".repitem");
    const template =
      existing?.innerHTML ??
      root.querySelector(`fieldset[class~='${group}']`)?.innerHTML ??
      null;

    container.replaceChildren();
    if (!entries || template === null) continue;

    for (const [index, entry] of entries.entries()) {
      const item = container.ownerDocument.createElement("div");
      item.className = "repitem";
      // roll20 le pone a cada fila su id de fila. Nada de lo nuestro lo lee,
      // pero la hoja lo usa para agrupar y es lo que espera encontrar.
      item.setAttribute("data-reprowid", `vault-${group}-${index}`);
      item.innerHTML = template;

      clearBound(item, true);
      applyAttrs(item, entry);
      container.appendChild(item);
    }
  }
}

/**
 * Cierra las caras de edición que la captura trajo abiertas.
 *
 * La hoja tiene dos caras por bloque y las conmuta con una casilla escondida:
 * `.attack .options` es `display: none` hasta que aparece
 * `.attacks .options-flag:checked ~ .options`. La captura se sacó con varios
 * bloques abiertos, y ese estado viaja en el HTML — 83 casillas marcadas.
 *
 * Abierto, un bloque no muestra el dato: muestra el formulario para escribirlo,
 * con sus botones de fijar, editar, borrar y el candado de la lista. Todo eso
 * es de una hoja que se edita, y ésta se pidió para leerla. Cerrarlas es lo que
 * deja a la vista la cara de lectura, que es la que tiene los datos.
 *
 * Se cierran por clase y no por nombre de atributo: `attr_options-flag` se
 * repite en cada fila, mientras que la clase es lo que la CSS mira.
 */
function closeEditors(root: ParentNode): void {
  for (const element of root.querySelectorAll(
    "input[class*='options-flag'], input.details-flag, input.inventorysubflag",
  )) {
    if (!(element instanceof HTMLInputElement)) continue;
    element.checked = false;
    element.removeAttribute("checked");
  }
}

/**
 * La pasada entera, en el orden en que los pasos dependen entre sí.
 *
 * Las filas primero: su contenido son clones que se hacen acá, y borrar o
 * escribir antes de que existan no llega a nada. Después el borrado global, que
 * saltea las filas para no vaciar lo que se acaba de escribir en ellas. El
 * cierre de las caras de edición va al final, cuando ya existen las filas
 * nuevas: cada una hereda del clon la casilla que traía la de la captura.
 */
export function renderOgl(root: ParentNode, data: OglData): void {
  applyRows(root, data.rows);
  clearBound(root, false);

  for (const element of boundElements(root, false)) {
    const name = element.getAttribute("name");
    if (!name) continue;

    const value = data.attrs[name];
    if (value !== undefined) writeValue(element, value);
  }

  closeEditors(root);
}
