/**
 * La hoja de roll20, llenada con la hoja de roll20 de verdad.
 *
 * Este test lee el HTML vendorizado y lo llena igual que la app. Es la unica
 * forma de saber que un nombre de atributo sigue existiendo: si `attr_AC` fuera
 * `attr_ac`, nada falla en ningun lado — la hoja se dibuja entera con la casilla
 * vacia. Un test que arme su propio HTML no vería eso nunca.
 *
 * Por eso las afirmaciones son sobre el documento renderizado, no sobre el mapa:
 * "la caja de la CA dice 16", no "el mapa tiene una clave attr_AC".
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, test } from "vitest";

import { initialState, type BuilderState } from "../src/lib/builder";
import { resolveDraft } from "../src/lib/derive";
import { sheetDataFor } from "../src/lib/sheet-data";
import { shapedDataFor } from "../src/lib/shaped-attrs";
import { renderShaped } from "../src/lib/shaped-render";

const hoja = join(process.cwd(), "public", "hoja");

let html = "";
let labels: Record<string, string> = {};

beforeAll(() => {
  // Lo genera `pretest`. Si falta, el mensaje tiene que decir eso y no
  // "ENOENT" a secas.
  try {
    html = readFileSync(join(hoja, "sheet.html"), "utf8");
    labels = JSON.parse(readFileSync(join(hoja, "labels.json"), "utf8"));
  } catch {
    throw new Error("Falta public/hoja: corre `node scripts/build-shaped-sheet.mjs`");
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
  if (resolved.status !== "ready") throw new Error(`no derivo: ${resolved.missing.join(", ")}`);

  const data = sheetDataFor(state, resolved.snapshot, "2014");
  const parsed = new DOMParser().parseFromString(
    `<div class="charsheet">${html}</div>`,
    "text/html",
  );
  const root = parsed.body.firstElementChild!;

  renderShaped(root, shapedDataFor(data, labels), labels);
  return { root, data, build: resolved.snapshot };
}

/**
 * Lo que la hoja *muestra* de un atributo.
 *
 * Un mismo `attr_` esta en varios elementos: un `<input type=hidden>` que la
 * hoja usa para sus formulas, el `<input>` de la cara de edicion, y el `<span>`
 * que es lo que se lee. El span es el que importa, y buscar el primero que
 * aparezca devuelve el input escondido, que no tiene texto.
 */
const textOf = (root: Element, name: string) =>
  root.querySelector(`span[name="${name}"]`)?.textContent?.trim() ?? null;

describe("el HTML vendorizado", () => {
  test("sale del build con las clases prefijadas y sin los workers", () => {
    // Las dos cosas que hace roll20 al subir la hoja. Sin el prefijo la hoja se
    // dibuja sin una sola regla de estilo aplicada.
    expect(html).toContain('class="sheet-wrapper');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("getAttrs(");
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
      const sign = ability.modifier >= 0 ? "+" : "";

      expect(textOf(root, `attr_${stem}_calculated`)).toBe(String(ability.score));
      expect(textOf(root, `attr_${stem}_mod_with_sign`)).toBe(`${sign}${ability.modifier}`);
    }
  });

  test("la CA, los golpes y la competencia son los del build", () => {
    const { root, build, data } = renderedSheet();

    expect(textOf(root, "attr_AC")).toBe(String(build.derived.ac));
    expect(textOf(root, "attr_HP_max")).toBe(String(build.derived.hp));
    expect(textOf(root, "attr_pb_display")).toBe(String(build.derived.proficiencyBonus));
  });

  /*
   * La percepcion pasiva de esta hoja no es una caja aparte: vive en la fila de
   * Percepcion, que es donde un jugador la mira. `attr_passive` es un campo de
   * fila, no del personaje.
   */
  test("la percepcion pasiva vive en la fila de Percepcion", () => {
    const { root, data } = renderedSheet();

    const perception = [...root.querySelectorAll(".repitem")].find(
      (row) =>
        row.querySelector('[name="attr_name"]')?.textContent?.trim() ===
        (labels.PERCEPTION ?? "PERCEPTION"),
    );

    expect(perception?.querySelector('span[name="attr_passive"]')?.textContent).toBe(
      String(data.passivePerception),
    );
  });

  test("las dieciocho pericias salen como filas, no como plantilla", () => {
    const { root } = renderedSheet();

    // `fieldset.repeating_skill` es la plantilla; una hoja llena no tiene
    // ninguna, tiene un `.repcontainer` con una fila por pericia.
    expect(root.querySelector("fieldset[class^='repeating_']")).toBeNull();

    const rows = [...root.querySelectorAll(".repitem")];
    const names = rows
      .map((row) => row.querySelector('[name="attr_name"]')?.textContent?.trim())
      .filter(Boolean);

    expect(names).toContain(labels.ACROBATICS ?? "ACROBATICS");
    expect(names).toContain(labels.PERCEPTION ?? "PERCEPTION");
  });

  test("el arma de la mochila es una fila de ataque con su bonificador", () => {
    const { root, data } = renderedSheet();
    const sword = data.attacks.find((attack) => /longsword/i.test(attack.name));
    expect(sword).toBeDefined();

    const rows = [...root.querySelectorAll(".repitem")];
    const attack = rows.find((row) =>
      /longsword/i.test(row.querySelector('[name="attr_name"]')?.textContent ?? ""),
    );

    expect(attack).toBeDefined();
    const sign = sword!.attackBonus >= 0 ? "+" : "";
    expect(attack!.querySelector('[name="attr_attack_string"]')?.textContent).toBe(
      `${sign}${sword!.attackBonus}`,
    );
  });

  /*
   * Los rotulos de la hoja vienen vacios: roll20 los escribe al vuelo desde su
   * archivo de traduccion. Sin esta pasada la hoja se dibuja entera y sin una
   * sola palabra.
   */
  test("los rotulos dejan de estar vacios", () => {
    const { root } = renderedSheet();

    const labelled = [...root.querySelectorAll("[data-i18n]")];
    expect(labelled.length).toBeGreaterThan(100);
    expect(labelled.every((element) => (element.textContent ?? "").length > 0)).toBe(true);
  });

  test("el nombre del personaje no se le pega a las filas", () => {
    // `attr_name` es el nombre del personaje arriba y el del arma en cada fila.
    // Si la pasada global entra en las filas, todas las armas se llaman Kaelen.
    const { root } = renderedSheet();

    const rows = [...root.querySelectorAll(".repitem")];
    const named = rows.map((row) => row.querySelector('[name="attr_name"]')?.textContent ?? "");

    expect(named.some((name) => name.includes("Kaelen"))).toBe(false);
  });
});
