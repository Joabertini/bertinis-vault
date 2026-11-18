import { describe, expect, test } from "vitest";

import { initialState } from "../src/lib/builder";
import { featIdsFor, ORIGIN_FEAT_IDS, speciesFeatGrantFor } from "../src/lib/feats";
import { releasedByPick } from "../src/lib/actions";

const base = { ...initialState, backgroundId: "", backgroundFeatId: "", levelChoices: {}, featId: "" };

describe("la dote que da la especie", () => {
  test("el humano 2024 toma una dote de origen, además de la del trasfondo", () => {
    const state = { ...base, rulesVersion: "5e-2024" as const, raceId: "human", featId: "alert" };
    expect(speciesFeatGrantFor(state)).toBe("origin");
    expect(featIdsFor(state)).toContain("alert");
    expect(ORIGIN_FEAT_IDS.has("alert")).toBe(true);
    expect(ORIGIN_FEAT_IDS.has("grappler")).toBe(false);
  });

  test("el humano variante de 2014 y el linaje a medida toman cualquier dote", () => {
    expect(speciesFeatGrantFor({ ...base, rulesVersion: "5e-2014" as const, raceId: "human", subraceId: "human-variant" })).toBe("any");
    expect(speciesFeatGrantFor({ ...base, rulesVersion: "5e-2014" as const, raceId: "custom-lineage" })).toBe("any");
  });

  test("las demás especies no dan dote", () => {
    expect(speciesFeatGrantFor({ ...base, rulesVersion: "5e-2014" as const, raceId: "human" })).toBeNull();
    expect(speciesFeatGrantFor({ ...base, rulesVersion: "5e-2024" as const, raceId: "elf" })).toBeNull();
  });

  test("cambiar de especie suelta la dote de la anterior", () => {
    const released = releasedByPick("race", { ...base, rulesVersion: "5e-2024" as const, raceId: "human", featId: "alert" });
    expect(released.patch.featId).toBe("");
    expect(released.shed).toContain("la dote de la especie");
  });
});
