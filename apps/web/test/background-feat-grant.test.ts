import { describe, expect, test } from "vitest";

import { collections, forRulesVersion } from "@bertinis-vault/vetools-index";
import { initialState } from "../src/lib/builder";
import { backgroundFeatIdsFor, featFeatureEntriesFor } from "../src/lib/feats";
import { featChoiceForBackground } from "../src/lib/index-options";
import { slugOf } from "../src/lib/index-options";

type Background = { name: string; source: string };

const stateFor = (backgroundId: string, rulesVersion: "5e-2014" | "5e-2024", source: string) => ({
  ...initialState,
  rulesVersion,
  backgroundId,
  backgroundFeatId: "",
  featId: "",
  levelChoices: {},
  sourceBooks: { [`background:${backgroundId}`]: source },
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

      for (const row of forRulesVersion(collections.background, edition) as Background[]) {
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
