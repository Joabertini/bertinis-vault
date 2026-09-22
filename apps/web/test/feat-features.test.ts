/**
 * Los dotes en la hoja final.
 *
 * Un dote se elige estructuralmente — un nivel de mejora, el trasfondo — nunca
 * escribiendo su nombre en el cuadro de rasgos. Nada convertía esa elección en
 * una entrada con etiqueta: `featIdsFor` la tenia para los prerrequisitos y el
 * bono de característica, y ahí se quedaba. La hoja lee `normalized.features`
 * filtrando por `source === "feat"`, y esa lista llegaba vacía aunque el
 * personaje tuviera el dote. Ver `apps/web/src/lib/feats.ts`.
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

describe("un dote elegido llega a la hoja", () => {
  it("un dote tomado por nivel aparece como entrada con source feat", () => {
    const state = draft({ levelChoices: { 4: { kind: "feat", featId: "resilient" } } });
    const features = buildCanonicalSnapshot(state).choices.normalized?.features ?? [];

    expect(features).toContainEqual(
      expect.objectContaining({ label: "Resilient", source: "feat" }),
    );
  });

  it("no lo duplica si el jugador tambien lo tipeo a mano", () => {
    const state = draft({
      levelChoices: { 4: { kind: "feat", featId: "resilient" } },
      featuresText: "Resilient",
    });
    const features = buildCanonicalSnapshot(state).choices.normalized?.features ?? [];
    const resilientEntries = features.filter((entry) => entry.label === "Resilient");

    expect(resilientEntries).toHaveLength(1);
  });
});
