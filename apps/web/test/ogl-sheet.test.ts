/**
 * La hoja de roll20, llenada con la hoja de roll20 de verdad.
 *
 * El test lee el HTML vendorizado y lo llena igual que la app. Es la única
 * forma de saber que un nombre de atributo sigue existiendo: si `attr_ac`
 * fuera `attr_AC`, no falla nada en ningún lado — la hoja se dibuja entera con
 * la casilla vacía. Un test que arme su propio HTML no vería eso nunca.
 *
 * Y hay algo que esta hoja pide y la anterior no: la captura viene con un
 * personaje adentro. Un dato que no mapeamos no se ve vacío, se ve con el de
 * Gritko, así que un test comprueba que no quede nada suyo a la vista.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, test } from "vitest";

import { initialState, type BuilderState } from "../src/lib/builder";
import { resolveDraft } from "../src/lib/derive";
import { oglDataFor } from "../src/lib/ogl-attrs";
import { renderOgl } from "../src/lib/ogl-render";
import { sheetDataFor } from "../src/lib/sheet-data";

const hoja = join(process.cwd(), "public", "hoja");

let html = "";

beforeAll(() => {
  // Lo genera `pretest`. Si falta, el mensaje tiene que decir eso y no
  // "ENOENT" a secas.
  try {
    html = readFileSync(join(hoja, "sheet.html"), "utf8");
  } catch {
    throw new Error("Falta public/hoja: corré `node scripts/build-ogl-sheet.mjs`");
  }
});

const character = (overrides: Partial<BuilderState> = {}): BuilderState => ({
  ...initialState,
  characterName: "Kaelen Thorne",
  raceId: "human",
  subraceId: "",
  classId: "fighter",
  subclassId: "",
  backgroundId: "soldier",
  weaponId: "longsword",
  str: 16,
  ...overrides,
});

function renderedSheet(state: BuilderState = character()) {
  const resolved = resolveDraft(state);
  if (resolved.status !== "ready") throw new Error(`no derivó: ${resolved.missing.join(", ")}`);

  const data = sheetDataFor(state, resolved.snapshot, "2014");
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const root = parsed.body.firstElementChild!;

  renderOgl(root, oglDataFor(data));
  return { root, data, build: resolved.snapshot };
}

/**
 * Lo que la hoja *muestra* de un atributo.
 *
 * Un mismo `attr_` está en varios elementos: los `<input type=hidden>` con los
 * que la hoja arma sus fórmulas, el `<input>` de la cara de edición, y el
 * `<span>`, que es lo que se lee. Buscar el primero que aparezca devuelve el
 * escondido, que no tiene texto.
 */
const textOf = (root: Element, name: string) =>
  root.querySelector(`span[name="${name}"]`)?.textContent?.trim() ?? null;

const rowsOf = (root: Element, group: string) => [
  ...root.querySelectorAll(`.repcontainer[data-groupname="${group}"] .repitem`),
];

describe("el HTML vendorizado", () => {
  test("es la hoja y no la ventana de roll20", () => {
    expect(html).toContain('class="charactersheet');
    expect(html).toContain('name="attr_version"');
    // La barra de macros y el fondo son del VTT, no de la hoja.
    expect(html).not.toContain('id="macrobar"');
    expect(html).not.toContain("<script");
  });
});

describe("la hoja llena", () => {
  test("las seis puntuaciones y sus modificadores llegan a sus casillas", () => {
    const { root, data } = renderedSheet();

    for (const [id, stem] of [
      ["str", "strength"],
      ["dex", "dexterity"],
      ["con", "constitution"],
      ["int", "intelligence"],
      ["wis", "wisdom"],
      ["cha", "charisma"],
    ] as const) {
      const ability = data.abilities.find((entry) => entry.id === id)!;

      expect(textOf(root, `attr_${stem}`)).toBe(String(ability.score));
      expect(textOf(root, `attr_${stem}_mod`)).toBe(String(ability.modifier));
    }
  });

  test("la CA, los golpes y la competencia son los del build", () => {
    const { root, build } = renderedSheet();

    expect(textOf(root, "attr_ac")).toBe(String(build.derived.ac));
    expect(textOf(root, "attr_hp_max")).toBe(String(build.derived.hp));
    expect(textOf(root, "attr_pb")).toBe(String(build.derived.proficiencyBonus));
  });

  /*
   * En esta hoja las pericias no son filas: cada una tiene su atributo, y la
   * percepción pasiva es una casilla del personaje y no de una fila.
   */
  test("las pericias y la percepción pasiva tienen su propia casilla", () => {
    const { root, data } = renderedSheet();

    const perception = data.abilities
      .flatMap((ability) => ability.skills)
      .find((check) => check.name === "perception")!;

    expect(textOf(root, "attr_perception_bonus")).toBe(String(perception.modifier));
    expect(textOf(root, "attr_passive_wisdom")).toBe(String(data.passivePerception));
  });

  test("el arma de la mochila es una fila de ataque con su bonificador", () => {
    const { root, data } = renderedSheet();
    const sword = data.attacks.find((attack) => /longsword/i.test(attack.name));
    expect(sword).toBeDefined();

    const attack = rowsOf(root, "repeating_attack").find((row) =>
      /longsword/i.test(row.querySelector('[name="attr_atkname"]')?.textContent ?? ""),
    );

    expect(attack).toBeDefined();
    const sign = sword!.attackBonus >= 0 ? "+" : "";
    expect(attack!.querySelector('input[name="attr_atkbonus"]')?.getAttribute("value")).toBe(
      `${sign}${sword!.attackBonus}`,
    );
  });

  test("las listas tienen una fila por cosa nuestra y ninguna de más", () => {
    const { root, data } = renderedSheet();

    // Los grupos aparecen más de una vez — página de personaje, de conjuros y
    // versión imprimible — y todas las copias se llenan igual.
    const containers = [
      ...root.querySelectorAll('.repcontainer[data-groupname="repeating_inventory"]'),
    ];
    expect(containers.length).toBeGreaterThan(1);
    for (const container of containers) {
      expect(container.querySelectorAll(".repitem").length).toBe(data.equipment.length);
    }

    // Los conjuros van por nivel y el nivel 0 tiene nombre propio en la hoja.
    // Las tres copias del grupo se llenan con los trucos del build y con nada
    // de los que traía la captura.
    const cantrips = data.spellsByLevel.find((bucket) => bucket.level === 0)?.spells ?? [];
    const cantripRows = rowsOf(root, "repeating_spell-cantrip");
    expect(cantripRows.length % Math.max(cantrips.length, 1)).toBe(0);
    for (const row of cantripRows) {
      const name = row.querySelector('span[name="attr_spellname"]')?.textContent?.trim() ?? "";
      expect(cantrips.map((spell) => spell.label)).toContain(name);
    }
  });

  /*
   * Lo que la captura traía puesto.
   *
   * Gritko es el personaje con el que se sacó la hoja. Si algo suyo sobrevive,
   * el jugador ve datos de otro personaje presentados como propios, que es peor
   * que ver la casilla vacía.
   */
  test("no queda nada del personaje de la captura", () => {
    const { root } = renderedSheet();
    const visible = root.textContent ?? "";

    for (const rastro of ["Gritko", "Glaive", "Battle Master", "Gladiator"]) {
      expect(visible).not.toContain(rastro);
    }
  });

  /*
   * Esta hoja llega con la traducción hecha, así que el riesgo no es que falte
   * un rótulo: es que el borrado se lleve uno puesto. Por eso la comparación es
   * contra la misma hoja sin llenar y no contra "ninguno vacío" — la captura ya
   * trae un par de rótulos vacíos, los de las acciones legendarias.
   *
   * Se miran sólo los rótulos de afuera de las filas. Adentro no hay nada que
   * comparar: una fila que el personaje no tiene desaparece con sus rótulos, y
   * eso es lo que tiene que pasar.
   */
  test("el borrado no se lleva puesto ningún rótulo", () => {
    // El texto propio del elemento, no el de sus hijos: hay rótulos que
    // envuelven una casilla — `<div data-i18n=...><span name="attr_x">` — y esa
    // casilla se vacía a propósito.
    const propio = (element: Element) =>
      [...element.childNodes]
        .filter((node) => node.nodeType === 3)
        .map((node) => node.textContent ?? "")
        .join("")
        .trim();

    const escritos = (root: ParentNode) =>
      new Set(
        [...root.querySelectorAll("[data-i18n]")]
          .filter((element) => !element.closest(".repitem"))
          .filter((element) => propio(element).length > 0)
          .map((element) => element.getAttribute("data-i18n") ?? ""),
      );

    const virgen = new DOMParser().parseFromString(html, "text/html").body.firstElementChild!;
    const antes = escritos(virgen);
    expect(antes.size).toBeGreaterThan(100);

    const { root } = renderedSheet();
    const despues = escritos(root);

    expect([...antes].filter((key) => !despues.has(key))).toEqual([]);
  });

  test("el nombre del personaje no se le pega a las filas", () => {
    // `attr_name` es el nombre del personaje arriba y el del rasgo en cada
    // fila. Si la pasada global entra en las filas, todos los rasgos se llaman
    // Kaelen.
    const { root } = renderedSheet();

    const named = rowsOf(root, "repeating_traits").map(
      (row) => row.querySelector('[name="attr_name"]')?.getAttribute("value") ?? "",
    );

    expect(named.some((name) => name.includes("Kaelen"))).toBe(false);
  });
});
