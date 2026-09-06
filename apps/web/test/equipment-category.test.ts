/**
 * Que un arma sea un arma, las 325 y no veinticuatro.
 *
 * El catalogo escrito a mano de `data-engine` lleva veinticuatro armas. Todo lo
 * de afuera se archivaba como `other`: sin linea de ataque en la hoja, y sin
 * llegar a Foundry como arma. El arco largo — el arma a distancia mas comun del
 * juego — era una de las que faltaban.
 *
 * Este test es de conformidad y no de ejemplo: mete el catalogo entero en la
 * mochila de un personaje y exige que salga entero. Escrito asi porque la falla
 * no fue una linea mal puesta sino una lista incompleta, y una lista incompleta
 * solo se ve contra la lista entera.
 */

import { describe, expect, test } from "vitest";

import { initialState } from "../src/lib/builder";
import { resolveDraft } from "../src/lib/derive";
import { optionsFor } from "../src/lib/index-options";
import type { BuilderState } from "../src/lib/builder";

/**
 * Un personaje que deriva, con lo que se le pase en la mochila.
 *
 * Los libros van con los objetos, que es lo que hace la Forja cuando el
 * jugador elige uno (`Forge.tsx`, `sourceBooks["item:<id>"]`). Sin eso, dos
 * filas que se llaman igual en dos libros distintos —el Baston de Aranas de
 * LMoP no es arma y el de PaBTSO si— se resuelven por la primera que aparezca.
 */
function withBag(
  lines: string[],
  rulesVersion: BuilderState["rulesVersion"],
  sourceBooks: Record<string, string> = {},
): BuilderState {
  return {
    ...initialState,
    sourceBooks,
    rulesVersion,
    characterName: "Mula",
    raceId: "human",
    subraceId: "",
    classId: "fighter",
    subclassId: "",
    backgroundId: "soldier",
    weaponId: "",
    armorId: "",
    extraEquipmentText: lines.join("\n"),
  };
}

const VERSIONS = [
  ["5e-2014", "2014"],
  ["5e-2024", "2024"],
] as const;

describe.each(VERSIONS)("bajo %s", (rulesVersion, indexVersion) => {
  /*
   * Las armas mundanas del catalogo. Las magicas quedan afuera a proposito: su
   * fila lleva el nombre del objeto magico y la competencia se chequea contra
   * el arma base, que es una pregunta distinta y tiene su propio lugar.
   */
  const weapons = optionsFor({
    prop: "item",
    rulesVersion: indexVersion,
    search: "",
    weaponsOnly: true,
    limit: 1000,
  });

  test("el indice trae un catalogo de armas para medir", () => {
    expect(weapons.length).toBeGreaterThan(50);
  });

  test("todas las armas del indice entran a la mochila como armas", () => {
    const books = Object.fromEntries(
      weapons.map((option) => [`item:${option.id}`, option.source]),
    );
    const resolved = resolveDraft(
      withBag(weapons.map((option) => option.id), rulesVersion, books),
    );
    expect(resolved.status).toBe("ready");
    if (resolved.status !== "ready") return;

    const equipment = resolved.snapshot.choices.normalized?.equipment ?? [];
    const byId = new Map(equipment.map((entry) => [entry.itemId ?? entry.label, entry.category]));

    const misfiled = weapons
      .map((option) => ({ id: option.id, label: option.label, category: byId.get(option.id) }))
      .filter((entry) => entry.category !== undefined && entry.category !== "weapon");

    expect(misfiled.map((entry) => `${entry.label} -> ${entry.category}`)).toEqual([]);
  });
});

describe("el arco largo, que es el caso que lo destapo", () => {
  test("llega a la mochila como arma y no como 'otro'", () => {
    const resolved = resolveDraft({ ...withBag([], "5e-2014"), weaponId: "longbow" });
    expect(resolved.status).toBe("ready");
    if (resolved.status !== "ready") return;

    const bow = (resolved.snapshot.choices.normalized?.equipment ?? []).find(
      (entry) => entry.itemId === "longbow",
    );

    expect(bow?.category).toBe("weapon");
  });

  test("la espada larga sigue resolviendo por el catalogo a mano", () => {
    const resolved = resolveDraft({ ...withBag([], "5e-2014"), weaponId: "longsword" });
    expect(resolved.status).toBe("ready");
    if (resolved.status !== "ready") return;

    const sword = (resolved.snapshot.choices.normalized?.equipment ?? []).find(
      (entry) => entry.itemId === "longsword",
    );

    expect(sword?.category).toBe("weapon");
  });
});
