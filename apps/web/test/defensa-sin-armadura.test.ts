/**
 * La Defensa sin Armadura, y el número que faltaba.
 *
 * `bestArmorClass` sabe resolver esto desde el principio y el índice trae los
 * datos desde el principio. Lo que faltaba era el cable: `builder.ts` mandaba
 * `armorClassOptions: []` siempre, así que un monje de nivel 5 con 18 de
 * Destreza y 15 de Sabiduría mostraba 14 —el 10 + Destreza de estar desnudo— en
 * vez de 16, y no había nada en la ficha que dijera que faltaba algo.
 *
 * Se prueba contra la CA derivada y no contra la lista de opciones, porque la
 * lista puede estar bien y no llegar a ningún lado: el fallo que importa es el
 * número que el jugador lee.
 */

import { describe, expect, it } from "vitest";

import { armorClassOptionsFor } from "@/lib/armor-class-options";
import { buildCanonicalSnapshot, initialState, type BuilderState } from "@/lib/builder";

const draft = (over: Partial<BuilderState> = {}): BuilderState => ({
  ...initialState,
  rulesVersion: "5e-2014",
  raceId: "human",
  subraceId: "",
  backgroundId: "soldier",
  classId: "fighter",
  subclassId: "",
  level: 5,
  extraClasses: [],
  weaponId: "",
  armorId: "",
  extraEquipmentText: "",
  abilityBonuses: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
  levelChoices: {},
  str: 10,
  dex: 18,
  con: 14,
  int: 10,
  wis: 14,
  cha: 10,
  ...over,
});

const acOf = (state: BuilderState) => buildCanonicalSnapshot(state).derived?.ac;

describe("la clase suma lo suyo cuando no hay armadura", () => {
  it("un monje suma Sabiduria, no solo Destreza", () => {
    // 10 + 4 (Destreza 18) + 2 (Sabiduria 14) = 16. Antes de cablearlo: 14.
    expect(acOf(draft({ classId: "monk", subclassId: "way-of-the-open-hand" }))).toBe(16);
  });

  it("un barbaro suma Constitucion", () => {
    // 10 + 4 (Destreza 18) + 2 (Constitucion 14) = 16.
    expect(acOf(draft({ classId: "barbarian", subclassId: "path-of-the-berserker" }))).toBe(16);
  });

  it("un hechicero draconico parte de 13 y no de 10", () => {
    // Las escamas son 13 + Destreza, y las da la subclase, no la clase.
    expect(acOf(draft({ classId: "sorcerer", subclassId: "draconic-bloodline", level: 3 }))).toBe(17);
  });

  it("un guerrero desnudo sigue siendo 10 + Destreza", () => {
    // Nadie le regala nada: la clase no trae ninguna opcion y el resultado es
    // el de siempre. Si esto sube, algo se esta aplicando de mas.
    expect(acOf(draft())).toBe(14);
  });
});

describe("que opciones alcanza el personaje", () => {
  it("una clase sin Defensa sin Armadura no trae ninguna", () => {
    expect(armorClassOptionsFor([{ classId: "wizard", subclassId: "", level: 20 }], "human", "", 20, "2014")).toEqual([]);
  });

  it("se mide contra los niveles de esa clase, no contra el del personaje", () => {
    // Un guerrero 8 / monje 1 es un personaje de nivel 9 con un monje de nivel
    // 1 adentro. Lo que le corresponde es lo del monje 1.
    const opciones = armorClassOptionsFor(
      [
        { classId: "fighter", subclassId: "", level: 8 },
        { classId: "monk", subclassId: "", level: 1 },
      ],
      "human",
      "",
      9,
      "2014",
    );

    expect(opciones).toHaveLength(1);
    expect(opciones[0]?.abilities).toEqual(["dex", "wis"]);
  });

  it("no repite una opcion que aparece dos veces", () => {
    const opciones = armorClassOptionsFor(
      [
        { classId: "monk", subclassId: "way-of-shadow", level: 6 },
        { classId: "monk", subclassId: "way-of-shadow", level: 6 },
      ],
      "human",
      "",
      12,
      "2014",
    );

    expect(opciones).toHaveLength(1);
  });

  it("un barbaro/monje se queda con las dos, que son dos formulas distintas", () => {
    const opciones = armorClassOptionsFor(
      [
        { classId: "barbarian", subclassId: "", level: 3 },
        { classId: "monk", subclassId: "", level: 3 },
      ],
      "human",
      "",
      6,
      "2014",
    );

    expect(opciones.map((option) => option.abilities.join("+")).sort()).toEqual([
      "dex+con",
      "dex+wis",
    ]);
  });
});
