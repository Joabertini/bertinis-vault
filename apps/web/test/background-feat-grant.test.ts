import { describe, expect, test } from "vitest";

import { collections, forRulesVersion } from "@bertinis-vault/vetools-index";
import { initialState } from "../src/lib/builder";
import {
  backgroundFeatIdsFor,
  featBenefitKey,
  featBenefitsFor,
  featFeatureEntriesFor,
  unansweredFeatBenefits,
} from "../src/lib/feats";
import { featChoiceForBackground } from "../src/lib/index-options";
import { slugOf } from "../src/lib/index-options";

type Background = { name: string; source: string };

const stateFor = (
  backgroundId: string,
  rulesVersion: "5e-2014" | "5e-2024",
  source: string,
  spellVariantChoices: Record<string, string> = {},
) => ({
  ...initialState,
  rulesVersion,
  backgroundId,
  backgroundFeatId: "",
  featId: "",
  levelChoices: {},
  sourceBooks: { [`background:${backgroundId}`]: source },
  spellVariantChoices,
});

describe("a background that names exactly one feat grants it", () => {
  // A review said Giant Foundling does not hand out Strike of the Giants. The
  // index carries the feat, so this measures every background rather than
  // that one: whichever fails names where the grant is lost.
  for (const [edition, rulesVersion] of [
    ["2014", "5e-2014"],
    ["2024", "5e-2024"],
  ] as const) {
    test(`${edition}: every single closed feat choice is granted and printed`, () => {
      const lost: string[] = [];

      for (const row of forRulesVersion(collections.background ?? [], edition) as Background[]) {
        const id = slugOf(row.name);
        const choice = featChoiceForBackground(id, edition, row.source);
        if (!choice || choice.isOpen || choice.options.length !== 1) continue;

        const state = stateFor(id, rulesVersion, row.source);
        const wanted = slugOf((choice.options[0] as { name: string }).name);
        const granted = backgroundFeatIdsFor(state);
        const printed = featFeatureEntriesFor(state, edition).map((entry) => entry.featureId);

        if (!granted.includes(wanted)) lost.push(`${row.name} (${row.source}): not granted`);
        else if (!printed.includes(wanted)) lost.push(`${row.name} (${row.source}): granted, not printed`);
      }

      expect(lost).toEqual([]);
    });
  }

  test("Giant Foundling in particular", () => {
    const state = stateFor("giant-foundling", "5e-2014", "BGG");

    expect(backgroundFeatIdsFor(state)).toContain("strike-of-the-giants");
    expect(featFeatureEntriesFor(state, "2014").map((entry) => entry.featureId)).toContain("strike-of-the-giants");
  });
});

describe("Strike of the Giants asks which strike", () => {
  // The feat says "choose one of the benefits listed below". Granting it
  // without the choice left a feat that does nothing: what the review saw.
  const foundling = (choices: Record<string, string> = {}) => stateFor("giant-foundling", "5e-2014", "BGG", choices);

  test("it offers the six strikes of the book", () => {
    expect(featBenefitsFor("strike-of-the-giants").map((benefit) => benefit.name)).toEqual([
      "Cloud Strike",
      "Fire Strike",
      "Frost Strike",
      "Hill Strike",
      "Stone Strike",
      "Storm Strike",
    ]);
  });

  test("unanswered, it is owed and the sheet prints the bare feat", () => {
    expect(unansweredFeatBenefits(foundling(), backgroundFeatIdsFor(foundling()))).toEqual(["strike-of-the-giants"]);
    expect(featFeatureEntriesFor(foundling(), "2014").map((entry) => entry.label)).toContain("Strike of the Giants");
  });

  test("answered, it is settled and the sheet says which strike", () => {
    const state = foundling({ [featBenefitKey("strike-of-the-giants")]: "Fire Strike" });

    expect(unansweredFeatBenefits(state, backgroundFeatIdsFor(state))).toEqual([]);
    expect(featFeatureEntriesFor(state, "2014").map((entry) => entry.label)).toContain(
      "Strike of the Giants (Fire Strike)",
    );
  });

  test("an answer the feat does not offer is not an answer", () => {
    const state = foundling({ [featBenefitKey("strike-of-the-giants")]: "Lava Strike" });

    expect(unansweredFeatBenefits(state, backgroundFeatIdsFor(state))).toEqual(["strike-of-the-giants"]);
  });

  test("a feat that asks nothing owes nothing", () => {
    expect(unansweredFeatBenefits(foundling(), ["alert"])).toEqual([]);
  });
});
