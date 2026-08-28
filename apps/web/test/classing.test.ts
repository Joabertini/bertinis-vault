import { describe, expect, test } from "vitest";

import {
  characterLevel,
  classEntriesFor,
  classEntryFor,
  coerceExtraClasses,
  emptyExtraClass,
} from "../src/lib/classing";

const primary = (classId: string, level: number, subclassId = "") => ({
  classId,
  subclassId,
  level,
});

describe("un borrador viejo sigue abriendo", () => {
  test("sin el campo, no hay clases extra", () => {
    expect(coerceExtraClasses(undefined)).toEqual([]);
  });

  test("lo que no es una lista tampoco", () => {
    expect(coerceExtraClasses("wizard")).toEqual([]);
    expect(coerceExtraClasses({ classId: "wizard" })).toEqual([]);
  });

  /*
   * Un borrador es un valor de localStorage: el jugador pudo editarlo. Una
   * entrada a medias que sobreviva hasta el payload falla la validación en el
   * Ritual, lejos de donde el jugador pueda hacer algo. Se descarta acá.
   */
  test("una entrada sin clase se descarta, no se repara", () => {
    expect(coerceExtraClasses([{ level: 3 }, { classId: "" }])).toEqual([]);
  });

  test("el nivel se recorta al rango que las reglas tienen", () => {
    expect(coerceExtraClasses([{ classId: "wizard", level: 99 }])[0]?.level).toBe(20);
    expect(coerceExtraClasses([{ classId: "wizard", level: 0 }])[0]?.level).toBe(1);
    expect(coerceExtraClasses([{ classId: "wizard", level: 2.7 }])[0]?.level).toBe(2);
  });

  test("una entrada buena pasa entera", () => {
    expect(
      coerceExtraClasses([{ classId: "wizard", subclassId: "school-of-evocation", level: 3 }]),
    ).toEqual([{ classId: "wizard", subclassId: "school-of-evocation", level: 3 }]);
  });
});

describe("el nivel del personaje", () => {
  test("una sola clase es su propio nivel", () => {
    expect(characterLevel(5, [])).toBe(5);
  });

  test("multiclase suma", () => {
    expect(characterLevel(5, [{ ...emptyExtraClass(), classId: "wizard", level: 3 }])).toBe(8);
  });

  test("no pasa de 20", () => {
    expect(characterLevel(20, [{ ...emptyExtraClass(), classId: "wizard", level: 5 }])).toBe(20);
  });
});

describe("lo que el índice pone en cada entrada", () => {
  test("el guerrero no lanza y trae su dado", () => {
    const entry = classEntryFor(primary("fighter", 5), "2014");
    expect(entry.hitDie).toBe(10);
    expect(entry.casterProgression).toBeNull();
  });

  /*
   * El caso que separa las ediciones sin que ningún archivo lo sepa: el
   * paladín de 2014 es medio lanzador y el de 2024 redondea hacia arriba como
   * el artificiero, porque 2024 lo hace lanzar desde nivel 1.
   */
  test("el paladín cambia de progresión entre ediciones", () => {
    expect(classEntryFor(primary("paladin", 5), "2014").casterProgression).toBe("1/2");
    expect(classEntryFor(primary("paladin", 5), "2024").casterProgression).toBe("artificer");
  });

  test("una subclase que lanza lo declara aparte de su clase", () => {
    const entry = classEntryFor(primary("fighter", 3, "eldritch-knight"), "2014");
    expect(entry.casterProgression).toBeNull();
    expect(entry.subclassCasterProgression).toBe("1/3");
  });

  test("los requisitos de característica viajan con la clase", () => {
    expect(classEntryFor(primary("rogue", 1), "2024").multiclassRequirements).toEqual([
      { dex: 13 },
    ]);
  });
});

describe("la lista de clases del payload", () => {
  test("la primera clase va primera", () => {
    const entries = classEntriesFor(primary("fighter", 5), [
      { classId: "wizard", subclassId: "", level: 3 },
    ], "2014");

    expect(entries.map((entry) => entry.classId)).toEqual(["fighter", "wizard"]);
  });

  test("una fila a medio elegir no llega al payload", () => {
    const entries = classEntriesFor(primary("fighter", 5), [emptyExtraClass()], "2014");
    expect(entries).toHaveLength(1);
  });

  test("sin clases extra emite exactamente lo de siempre", () => {
    const entries = classEntriesFor(primary("wizard", 3, "school-of-evocation"), [], "2014");
    expect(entries).toHaveLength(1);
    expect(entries[0]?.subclassId).toBe("school-of-evocation");
  });
});
