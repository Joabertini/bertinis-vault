/**
 * La competencia de salvacion que Resilient promete.
 *
 * El indice no tiene un campo para "que dote toca las salvaciones" — ability,
 * expertise, skills y tools salen todos de 5etools, y ninguno dice esto
 * porque en la data actual solo Resilient lo hace. `savingThrowFromResilient`
 * lo trata como caso especial por id, como ya hacen playbook.ts y
 * counsel.ts para este mismo dote, y reusa la caracteristica que el jugador
 * ya eligio para el +1 del dote en vez de preguntarla dos veces.
 */

import { describe, expect, it } from "vitest";

import { buildCanonicalSnapshot, initialState, type BuilderState } from "@/lib/builder";

const draft = (over: Partial<BuilderState> = {}): BuilderState => ({
  ...initialState,
  rulesVersion: "5e-2014",
  raceId: "human",
  subraceId: "",
  backgroundId: "soldier",
  classId: "fighter",
  subclassId: "",
  level: 4,
  extraClasses: [],
  weaponId: "",
  armorId: "",
  extraEquipmentText: "",
  abilityBonuses: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
  levelChoices: {},
  featuresText: "",
  str: 10,
  dex: 10,
  con: 14,
  int: 10,
  wis: 10,
  cha: 10,
  ...over,
});

describe("Resilient da la competencia de salvacion que promete", () => {
  it("agrega la salvacion de la caracteristica elegida", () => {
    const state = draft({
      levelChoices: { 4: { kind: "feat", featId: "resilient" } },
      featAbilityChoices: { resilient: { wis: 1 } },
    });
    const entries = buildCanonicalSnapshot(state).choices.normalized?.proficiencies ?? [];

    expect(entries).toContainEqual({ kind: "savingThrow", id: "wis", label: "Sabiduria" });
  });

  it("sin elegir la caracteristica todavia, no concede nada", () => {
    const state = draft({
      levelChoices: { 4: { kind: "feat", featId: "resilient" } },
      featAbilityChoices: {},
    });
    const entries = buildCanonicalSnapshot(state).choices.normalized?.proficiencies ?? [];

    expect(entries.some((entry) => entry.kind === "savingThrow" && entry.id === "wis")).toBe(false);
  });

  it("no duplica una salvacion que la clase ya da", () => {
    // El guerrero ya es competente en Fuerza y Constitucion.
    const state = draft({
      levelChoices: { 4: { kind: "feat", featId: "resilient" } },
      featAbilityChoices: { resilient: { con: 1 } },
    });
    const entries = buildCanonicalSnapshot(state).choices.normalized?.proficiencies ?? [];
    const conEntries = entries.filter((entry) => entry.kind === "savingThrow" && entry.id === "con");

    expect(conEntries).toHaveLength(1);
  });

  it("un dote distinto no dispara nada", () => {
    const state = draft({ levelChoices: { 4: { kind: "feat", featId: "alert" } } });
    const entries = buildCanonicalSnapshot(state).choices.normalized?.proficiencies ?? [];

    expect(entries.some((entry) => entry.kind === "savingThrow" && entry.id === "wis")).toBe(false);
  });
});
