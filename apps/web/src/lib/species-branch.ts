/**
 * Whether a species' branch (2014: subrace) is optional or not.
 *
 * The Forge labelled every branch "Optional" the same way, on the
 * assumption a race row always carries its own ability bonus and the branch
 * only adds flavour on top — true for the ones a table plays every week.
 * It is not true for all 91: a handful (Goblin, Merfolk, the Innistrad
 * human, the shifter) print nothing at the race level at all, so a player
 * who trusted "Optional" and skipped the branch got no ability increase
 * and, for one of them, no species language either. That is not a text bug
 * about one race — it is the label lying about the mechanic for any race
 * shaped this way, present or future, which is why this reads it off the
 * index rather than naming one.
 *
 * Two separate facts, not one comparison: most races (the dwarf among them)
 * add *something* on every branch without that meaning the base race gave
 * nothing — a dwarf's own +2 Constitution stands on its own, and a branch
 * that stacks another point on top is the normal shape, not a sign the base
 * was empty. What actually marks a branch as load-bearing is the base race
 * alone printing zero of a kind of grant that some branch of it does supply.
 */

import { collections, forRulesVersion } from "@bertinis-vault/vetools-index";
import type { RulesVersion } from "@bertinis-vault/vetools-ref";

import { seedSpeciesBonus } from "./improvements";
import { languagePlanFor } from "./languages";
import type { BuilderState } from "./builder-state";
import { slugOf } from "./index-options";

const languageOfferCount = (
  raceId: string,
  subraceId: string,
  rulesVersion: RulesVersion,
  state: BuilderState,
) =>
  languagePlanFor(raceId, subraceId, state.backgroundId, rulesVersion, state.sourceBooks).offers.filter(
    (offer) => offer.from === "especie",
  ).length;

export function branchIsRequiredFor(state: BuilderState, rulesVersion: RulesVersion): boolean {
  if (rulesVersion !== "2014" || !state.raceId) return false;

  const races = forRulesVersion(collections.race ?? [], "2014") as { name: string }[];
  const raceRow = races.find((row) => slugOf(row.name) === state.raceId);
  if (!raceRow) return false;

  // Matched on the subrace's own `raceName`, not a name prefix: "Human
  // (Innistrad)" starts with "Human (" too, and is a separate race entirely
  // — a prefix match would file its branches under plain Human.
  const subraces = (forRulesVersion(collections.subrace ?? [], "2014") as { name: string; raceName: string }[]).filter(
    (row) => row.raceName === raceRow.name,
  );
  if (!subraces.length) return false;

  const baseAbilityPoints = Object.values(
    seedSpeciesBonus({ ...state, subraceId: "" }, rulesVersion),
  ).reduce((sum, amount) => sum + (amount ?? 0), 0);
  if (baseAbilityPoints === 0) return true;

  const baseLanguageOffers = languageOfferCount(state.raceId, "", rulesVersion, state);
  if (baseLanguageOffers > 0) return false;

  return subraces.some(
    (subrace) => languageOfferCount(state.raceId, slugOf(subrace.name), rulesVersion, state) > 0,
  );
}
