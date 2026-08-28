import { describe, expect, test } from "vitest";

import { collapseGearLines, formatGearLine, parseGearLine } from "../src/lib/gear-lines";

describe("una linea de la mochila", () => {
  test("un objeto solo no lleva cuenta", () => {
    expect(formatGearLine("rope-hempen-50-feet|xphb", 1)).toBe("rope-hempen-50-feet|xphb");
  });

  test("varios la llevan al final", () => {
    expect(formatGearLine("arrow|xphb", 20)).toBe("arrow|xphb x20");
  });

  test("ida y vuelta", () => {
    expect(parseGearLine(formatGearLine("arrow|xphb", 20))).toEqual({
      id: "arrow|xphb",
      quantity: 20,
    });
  });

  test("sin cuenta es uno", () => {
    expect(parseGearLine("spellbook|xphb")).toEqual({ id: "spellbook|xphb", quantity: 1 });
  });

  /*
   * Lo que el jugador escribe a mano no siempre es una cuenta. `x0` no es una
   * cantidad que una mochila pueda tener, y un objeto que se llame "Poción x2"
   * sin ser dos pociones no existe — pero "x0" sí aparece en nombres, asi que
   * queda como parte del nombre y falla al resolver como lo escribieron.
   */
  test("x0 no es una cuenta", () => {
    expect(parseGearLine("cosa rara x0")).toEqual({ id: "cosa rara x0", quantity: 1 });
  });

  test("mayuscula tambien cuenta", () => {
    expect(parseGearLine("dagger|xphb X2")).toEqual({ id: "dagger|xphb", quantity: 2 });
  });
});

describe("la mochila entera", () => {
  test("tres dagas escritas de las dos formas dan lo mismo", () => {
    const asLines = collapseGearLines(["dagger|xphb", "dagger|xphb", "dagger|xphb"]);
    const asCount = collapseGearLines(["dagger|xphb x3"]);
    expect(asLines).toEqual(asCount);
    expect(asCount).toEqual([{ id: "dagger|xphb", quantity: 3 }]);
  });

  test("suma la cuenta con las repeticiones", () => {
    expect(collapseGearLines(["arrow|xphb x20", "arrow|xphb"])).toEqual([
      { id: "arrow|xphb", quantity: 21 },
    ]);
  });

  test("mantiene el orden de la primera mencion", () => {
    const bag = collapseGearLines(["rope|xphb", "arrow|xphb x20", "rope|xphb"]);
    expect(bag.map((entry) => entry.id)).toEqual(["rope|xphb", "arrow|xphb"]);
  });

  test("ignora lineas vacias", () => {
    expect(collapseGearLines(["", "  ", "rope|xphb"])).toEqual([
      { id: "rope|xphb", quantity: 1 },
    ]);
  });
});
