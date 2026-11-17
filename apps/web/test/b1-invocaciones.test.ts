/**
 * B1 (plan de reseñas, decidido 2026-11-17): a 2024 warlock built with the
 * supplements sees the supplements' invocations; the 2014 and 2024 Player's
 * Handbooks never cross.
 *
 * This is what `isSourceAllowed` already does with the `all` library. The test
 * fixes it, so a change to the library rules cannot quietly hand a 2024
 * character the 2014 book's invocations, or take Xanathar's and Tasha's away.
 */

import { afterEach, describe, expect, test } from "vitest";

import { setBookLibrary } from "@bertinis-vault/vetools-ref";

import { initialState, type BuilderState } from "../src/lib/builder";
import { talentPools } from "../src/lib/optional-features";

const warlock = (rulesVersion: "5e-2014" | "5e-2024"): BuilderState => ({
  ...initialState,
  abilityBonuses: {},
  levelChoices: {},
  optionalFeatureIds: [],
  rulesVersion,
  classId: "warlock",
  level: 9,
});

const invocationSources = (edition: "2014" | "2024") => {
  const pool = talentPools(warlock(edition === "2014" ? "5e-2014" : "5e-2024"), edition, "Warlock", "", 9).find(
    (entry) => entry.name.toLowerCase().includes("invocation"),
  );
  expect(pool, "the warlock is owed invocations").toBeDefined();
  return new Set(pool!.options.map((option) => option.source));
};

afterEach(() => setBookLibrary("edition"));

describe("B1: warlock invocations and the books a character is built with", () => {
  test("a 2024 warlock built with the supplements sees Xanathar's and Tasha's", () => {
    setBookLibrary("all");
    const sources = invocationSources("2024");

    expect(sources.has("XPHB")).toBe(true);
    expect(sources.has("XGE")).toBe(true);
    expect(sources.has("TCE")).toBe(true);
  });

  test("a 2024 warlock never sees the 2014 Player's Handbook", () => {
    setBookLibrary("all");
    expect(invocationSources("2024").has("PHB")).toBe(false);
  });

  test("a 2014 warlock never sees the 2024 Player's Handbook", () => {
    setBookLibrary("all");
    const sources = invocationSources("2014");

    expect(sources.has("PHB")).toBe(true);
    expect(sources.has("XPHB")).toBe(false);
  });

  test("without the supplements, only the character's own Handbook", () => {
    setBookLibrary("core");
    expect([...invocationSources("2024")]).toEqual(["XPHB"]);
  });
});
