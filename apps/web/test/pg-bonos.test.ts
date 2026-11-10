/**
 * Puntos de golpe que no salen del dado ni de la Constitucion.
 *
 * El modelo los dejaba afuera ("Tough y Dwarven Toughness todavia no"), y eso
 * es un numero equivocado en la hoja, no uno faltante.
 */

import { describe, expect, test } from "vitest";

import { buildCanonicalSnapshot, initialState, type BuilderState } from "../src/lib/builder";
import { hitPointBonusesFor } from "../src/lib/hit-points";

const pj = (over: Partial<BuilderState>): BuilderState => ({
  ...initialState,
  rulesVersion: "5e-2014",
  abilityBonuses: {},
  levelChoices: {},
  featId: "",
  raceId: "human",
  subraceId: "",
  classId: "fighter",
  subclassId: "",
  backgroundId: "soldier",
  level: 5,
  extraClasses: [],
  con: 10,
  hpMethod: "average",
  hpRolls: {},
  ...over,
});

const hp = (state: BuilderState) => buildCanonicalSnapshot(state).derived.hp;

describe("hitPointBonusesFor", () => {
  test("un enano de las colinas suma uno por nivel", () => {
    expect(hitPointBonusesFor(pj({ raceId: "dwarf", subraceId: "dwarf-hill" }))).toEqual([
      { source: "Dureza enana", amount: 5 },
    ]);
    // El enano de las montanas no tiene el rasgo.
    expect(hitPointBonusesFor(pj({ raceId: "dwarf", subraceId: "dwarf-mountain" }))).toEqual([]);
  });

  test("el enano de 2024 lo trae de serie", () => {
    expect(
      hitPointBonusesFor(pj({ rulesVersion: "5e-2024", raceId: "dwarf", backgroundId: "soldier" })),
    ).toEqual([{ source: "Dureza enana", amount: 5 }]);
  });

  test("Duro suma dos por nivel de personaje, venga de donde venga la dote", () => {
    expect(hitPointBonusesFor(pj({ featId: "tough" }))).toEqual([{ source: "Duro", amount: 10 }]);
    expect(
      hitPointBonusesFor(pj({ levelChoices: { 4: { kind: "feat", featId: "tough" } } })),
    ).toEqual([{ source: "Duro", amount: 10 }]);
  });

  test("la resiliencia draconica cuenta niveles de hechicero, desde que la subclase la da", () => {
    const sorcerer = (level: number, rulesVersion: BuilderState["rulesVersion"], subclassId: string) =>
      hitPointBonusesFor(pj({ classId: "sorcerer", subclassId, level, rulesVersion }));

    expect(sorcerer(3, "5e-2014", "draconic-bloodline")).toEqual([
      { source: "Resiliencia draconica", amount: 3 },
    ]);
    expect(sorcerer(3, "5e-2024", "draconic-sorcery")).toEqual([
      { source: "Resiliencia draconica", amount: 3 },
    ]);
    expect(sorcerer(3, "5e-2014", "wild-magic")).toEqual([]);
  });
});

describe("llegan a la hoja", () => {
  test("los puntos extra se suman al total derivado", () => {
    const plain = hp(pj({}));

    expect(hp(pj({ raceId: "dwarf", subraceId: "dwarf-hill" }))).toBe(plain + 5);
    expect(hp(pj({ featId: "tough" }))).toBe(plain + 10);
    expect(hp(pj({ raceId: "dwarf", subraceId: "dwarf-hill", featId: "tough" }))).toBe(plain + 15);
  });

  test("tambien con dados tirados", () => {
    const rolled = { hpMethod: "rolled" as const, hpRolls: { "2": 1, "3": 1, "4": 1, "5": 1 } };
    expect(hp(pj({ ...rolled, featId: "tough" }))).toBe(hp(pj(rolled)) + 10);
  });
});
