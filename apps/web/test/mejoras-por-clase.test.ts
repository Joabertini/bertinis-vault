/**
 * Cada clase da sus propias mejoras, y solo cuentan las que una clase pide.
 *
 * Antes el plan leia solo la primera clase: un guerrero 4 / mago 4 tenia una
 * mejora donde las reglas dan dos. Y la suma tomaba todo el mapa, asi que un
 * guerrero 8 rehecho mago 8 se quedaba con la mejora de nivel 6 del guerrero.
 */

import { describe, expect, test } from "vitest";

import { buildCanonicalSnapshot, coerceBuilderState, initialState } from "../src/lib/builder";
import { improvementPlan, scoresBefore } from "../src/lib/improvements";
import { improvementSlotsFor, levelFeatsFor } from "../src/lib/level-choices";

const base = {
  ...initialState,
  rulesVersion: "5e-2014" as const,
  abilityBonuses: {},
  featId: "",
  subclassId: "",
  levelChoices: {},
  str: 14,
  int: 14,
};

describe("una mejora por clase, en sus propios niveles", () => {
  const fighterWizard = {
    ...base,
    classId: "fighter",
    level: 4,
    extraClasses: [{ classId: "wizard", subclassId: "", level: 4 }],
  };

  test("guerrero 4 / mago 4 tiene dos mejoras, una de cada clase", () => {
    expect(improvementSlotsFor(fighterWizard).map((slot) => slot.key)).toEqual(["4", "wizard:4"]);
    expect(improvementPlan(fighterWizard, "2014").unanswered).toEqual(["4", "wizard:4"]);
  });

  test("las dos suman", () => {
    const snapshot = buildCanonicalSnapshot({
      ...fighterWizard,
      levelChoices: {
        4: { kind: "improvement", bonuses: { str: 2 } },
        "wizard:4": { kind: "improvement", bonuses: { int: 2 } },
      },
    });

    expect(snapshot.abilities.final.str).toBe(16);
    expect(snapshot.abilities.final.int).toBe(16);
  });

  test("una dote tomada en la segunda clase llega a la hoja", () => {
    const state = {
      ...fighterWizard,
      levelChoices: { "wizard:4": { kind: "feat" as const, featId: "alert" } },
    };

    expect(levelFeatsFor(state)).toEqual(["alert"]);
    expect(buildCanonicalSnapshot(state).choices.feats).toContain("alert");
  });

  test("lo que la otra clase ya puso cuenta como 'antes'", () => {
    const state = {
      ...fighterWizard,
      levelChoices: {
        4: { kind: "improvement" as const, bonuses: { str: 2 } },
        "wizard:4": { kind: "improvement" as const, bonuses: { str: 2 } },
      },
    };

    expect(scoresBefore(state, "wizard:4").str).toBe(16);
    expect(scoresBefore(state, 4).str).toBe(16);
  });

  test("una clase que todavia no llega a su nivel 4 no pide nada", () => {
    const state = { ...fighterWizard, extraClasses: [{ classId: "wizard", subclassId: "", level: 3 }] };

    expect(improvementSlotsFor(state).map((slot) => slot.key)).toEqual(["4"]);
  });
});

describe("solo cuentan las respuestas que una clase pide", () => {
  const answers = {
    4: { kind: "improvement" as const, bonuses: { str: 2 } },
    6: { kind: "improvement" as const, bonuses: { str: 2 } },
    8: { kind: "improvement" as const, bonuses: { str: 2 } },
  };

  test("el guerrero 8 tiene tres mejoras", () => {
    const fighter = buildCanonicalSnapshot({ ...base, classId: "fighter", level: 8, levelChoices: answers });
    expect(fighter.abilities.final.str).toBe(20);
  });

  test("rehecho mago 8, la del nivel 6 deja de contar", () => {
    const wizard = buildCanonicalSnapshot({ ...base, classId: "wizard", level: 8, levelChoices: answers });
    expect(wizard.abilities.final.str).toBe(18);
  });

  test("una respuesta por encima del nivel no cuenta aunque siga guardada", () => {
    const low = buildCanonicalSnapshot({ ...base, classId: "fighter", level: 5, levelChoices: answers });
    expect(low.abilities.final.str).toBe(16);
  });

  test("las respuestas de una clase que ya no esta no cuentan", () => {
    const snapshot = buildCanonicalSnapshot({
      ...base,
      classId: "fighter",
      level: 4,
      extraClasses: [],
      levelChoices: { "wizard:4": { kind: "improvement", bonuses: { int: 2 } } },
    });

    expect(snapshot.abilities.final.int).toBe(14);
  });
});

describe("el borrador guarda las respuestas de cada clase", () => {
  test("una clave de otra clase sobrevive a la restauracion", () => {
    const restored = coerceBuilderState({
      ...initialState,
      levelChoices: {
        4: { kind: "improvement", bonuses: { str: 2 } },
        "wizard:4": { kind: "feat", featId: "alert" },
        "mal formada": { kind: "feat", featId: "alert" },
      },
    });

    expect(restored.levelChoices).toEqual({
      4: { kind: "improvement", bonuses: { str: 2 } },
      "wizard:4": { kind: "feat", featId: "alert" },
    });
  });
});
