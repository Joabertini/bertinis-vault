/**
 * B2 (plan de reseñas): el trasfondo a medida de la Guía del DM 2024,
 * "Creating a Background": tres características, una dote de Origen, dos
 * habilidades, una herramienta y 50 po de equipo.
 */

import { CUSTOM_BACKGROUND_ID, importPayloadSchema } from "@bertinis-vault/contracts";
import { RefResolver, buildToPayload, collections } from "@bertinis-vault/vetools-index";
import { describe, expect, test } from "vitest";

import { buildCanonicalSnapshot } from "../src/lib/builder";
import { freshDraft, type BuilderState } from "../src/lib/builder-state";
import { proficiencyPlan } from "../src/lib/grants";
import {
  featChoiceForBackground,
  originAbilityChoiceFor,
  proficiencyGrantForBackground,
  startingEquipmentForBackground,
} from "../src/lib/index-options";

const custom = (over: Partial<BuilderState> = {}): BuilderState => ({
  ...freshDraft("5e-2024"),
  classId: "fighter",
  raceId: "human",
  backgroundId: CUSTOM_BACKGROUND_ID,
  ...over,
});

describe("el trasfondo a medida", () => {
  test("ofrece las dotes de Origen que dan los trasfondos impresos", () => {
    const names = featChoiceForBackground(CUSTOM_BACKGROUND_ID, "2024")!.options.map(
      (option) => (option as { name: string }).name,
    );
    for (const feat of ["Alert", "Lucky", "Magic Initiate", "Tough", "Skilled"]) expect(names).toContain(feat);
    // Una vez cada una, aunque Magic Initiate venga con tres clases distintas.
    expect(new Set(names).size).toBe(names.length);
  });

  test("reparte +2/+1 o +1/+1/+1 entre cualquiera de las seis", () => {
    const choice = originAbilityChoiceFor(CUSTOM_BACKGROUND_ID, "2024")!;
    expect(choice.map((option) => option.amounts)).toEqual([[2, 1], [1, 1, 1]]);
    expect(choice[0]!.options).toHaveLength(6);
  });

  test("pide dos habilidades cualesquiera y una herramienta", () => {
    expect(proficiencyGrantForBackground(CUSTOM_BACKGROUND_ID, "2024").skillChoice).toMatchObject({
      count: 2,
      isOpen: true,
    });
    const offers = proficiencyPlan(custom(), "2024").offers.filter((offer) => offer.from === "trasfondo");
    expect(offers.map((offer) => [offer.kind, offer.count])).toEqual(
      expect.arrayContaining([
        ["skill", 2],
        ["tool", 1],
      ]),
    );
  });

  test("da 50 po de equipo", () => {
    expect(startingEquipmentForBackground(CUSTOM_BACKGROUND_ID, "2024").join(" ")).toMatch(/50/);
  });

  test("no existe en 2014", () => {
    expect(featChoiceForBackground(CUSTOM_BACKGROUND_ID, "2014")).toBeNull();
  });

  test("viaja a Foundry por nombre, sin documento, con la dote elegida", () => {
    const snapshot = buildCanonicalSnapshot(custom({ backgroundFeatId: "alert" }));
    const { payload } = buildToPayload(snapshot, new RefResolver("2024", collections));

    expect(payload?.background).toEqual({ custom: { name: "Trasfondo a medida" } });
    expect(payload?.feats.some((feat) => feat.ref.hash.startsWith("alert"))).toBe(true);
    expect(importPayloadSchema.safeParse(payload).success).toBe(true);
  });
});
