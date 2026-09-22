/**
 * Which feats a character has, wherever they came from.
 *
 * Three sources and the rules do not distinguish them: a level bought one, a
 * 2024 background granted one, and the variant human takes one at level 1.
 * Resilient owes its +1 either way.
 *
 * This lives apart from `builder.ts` because two things need it and one of
 * them is read *by* the builder — the spells a feat grants. Left where it was,
 * asking that question imported the module that asks it.
 */

import { featsFromChoices } from "@bertinis-vault/domain";
import { getBackgroundCatalogEntry } from "@bertinis-vault/data-engine";
import { collections, forRulesVersion, type FeatRow } from "@bertinis-vault/vetools-index";
import type { RulesVersion } from "@bertinis-vault/vetools-ref";

import type { BuilderState } from "./builder-state";
import { featChoiceForBackground, slugOf } from "./index-options";

/**
 * The feat a background hands over, if it has settled on one.
 *
 * A background that names exactly one grants it without asking. One that
 * offers several — or allows any feat at all — waits for the player's answer
 * and grants nothing until it arrives, rather than guessing which.
 */
export function backgroundFeatIdsFor(state: BuilderState): string[] {
  if (!state.backgroundId) return [];

  const rulesVersion: RulesVersion = state.rulesVersion === "5e-2024" ? "2024" : "2014";
  const choice = featChoiceForBackground(
    state.backgroundId,
    rulesVersion,
    state.sourceBooks[`background:${state.backgroundId}`],
  );

  if (choice) {
    if (choice.options.length === 1 && !choice.isOpen) {
      return [slugOf((choice.options[0] as { name: string }).name)];
    }

    return state.backgroundFeatId ? [state.backgroundFeatId] : [];
  }

  // Backgrounds the index does not cover fall back to the hand-written
  // catalog, which is still the source for everything but the feat.
  const entry = getBackgroundCatalogEntry(state.backgroundId);
  return [...new Set(entry?.grantedFeatIds ?? [])];
}

/** Every feat the character has, once each, in the order they were taken. */
export function featIdsFor(state: BuilderState): string[] {
  return [
    ...new Set(
      [
        ...backgroundFeatIdsFor(state),
        state.featId,
        ...featsFromChoices(state.levelChoices),
      ].filter(Boolean),
    ),
  ];
}

/**
 * The feats a character has, as feature entries the sheet can print.
 *
 * A feat is chosen structurally — a level's improvement, a background's grant —
 * never by typing its name into the features box. Nothing else turns that
 * choice into a labeled entry, so a taken feat reached `featIdsFor` and
 * stopped there: recorded for prerequisites and ability bonuses, invisible on
 * the sheet. This is the missing conversion, read off the same index row
 * `grants.ts` already matches ids against.
 */
export function featFeatureEntriesFor(
  state: BuilderState,
  rulesVersion: RulesVersion,
): { featureId: string; label: string; source: "feat" }[] {
  const feats = forRulesVersion(collections.feat ?? [], rulesVersion) as FeatRow[];

  return featIdsFor(state).flatMap((featId) => {
    const feat = feats.find((row) => slugOf(row.name) === featId);
    return feat ? [{ featureId: featId, label: feat.name, source: "feat" as const }] : [];
  });
}
