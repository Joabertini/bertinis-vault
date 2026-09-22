/**
 * Cuando la rama de una especie no es opcional.
 *
 * La solapa de raza etiquetaba "Opcional" a la rama (2014: subraza) de
 * cualquier especie, dando por hecho que la raza siempre trae su propio bono
 * de caracteristica y la rama solo agrega sabor. Un barrido de las 91 razas
 * 2014 (ver el audit en la sesion) encontro que no es asi para todas: un
 * puñado no imprime nada a nivel raza, y saltear la rama deja al personaje
 * sin bono de caracteristica y, para una de ellas, sin idioma de especie.
 * `branchIsRequiredFor` detecta esto leyendo el indice, sin nombrar razas.
 */

import { describe, expect, it } from "vitest";

import { branchIsRequiredFor } from "@/lib/species-branch";
import { initialState, type BuilderState } from "@/lib/builder";

const draft = (over: Partial<BuilderState> = {}): BuilderState => ({
  ...initialState,
  rulesVersion: "5e-2014",
  raceId: "",
  subraceId: "",
  backgroundId: "",
  ...over,
});

describe("branchIsRequiredFor", () => {
  it("una especie sin ramas nunca la exige", () => {
    expect(branchIsRequiredFor(draft({ raceId: "human" }), "2014")).toBe(false);
  });

  it("un enano de montaña ya trae su +2 a Constitucion sin elegir rama: es opcional de verdad", () => {
    expect(branchIsRequiredFor(draft({ raceId: "dwarf" }), "2014")).toBe(false);
  });

  it("una especie que no imprime nada a nivel raza exige elegir rama", () => {
    // Goblin (DMG): 0 puntos de bono y 0 idiomas de especie sin elegir rama.
    expect(branchIsRequiredFor(draft({ raceId: "goblin" }), "2014")).toBe(true);
  });

  it("en 2024 no aplica: el aumento vino del trasfondo, no de la especie", () => {
    expect(branchIsRequiredFor(draft({ rulesVersion: "5e-2024", raceId: "goblin" }), "2024")).toBe(false);
  });

  it("sin raza elegida, no hay nada que exigir", () => {
    expect(branchIsRequiredFor(draft({ raceId: "" }), "2014")).toBe(false);
  });
});
