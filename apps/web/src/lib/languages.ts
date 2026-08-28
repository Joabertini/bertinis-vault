/**
 * The languages a character speaks, and the ones they still get to choose.
 *
 * This used to come from a table written by hand: 25 species, against the 160
 * the index carries. Everything outside it — five species out of six, every
 * subspecies, and every background in the game — fell through to "Common", so
 * a deep gnome arrived without Undercommon and an Acolyte arrived without the
 * two languages their background is largely made of.
 *
 * Three sources hand them out and they do not behave the same way. A species
 * grants some outright and sometimes one more to pick. A subspecies **adds** to
 * its species, the way traits do and unlike speed. A background is where 2024
 * put nearly all of them, and where the 2014 books already put most.
 *
 * The fourth shape is the one that cannot be a closed list: "any one language
 * that you and your DM agree is appropriate". Filling it with a dropdown of the
 * standard eight would be inventing a rule the book declined to write, so the
 * offer stays open and the player writes what they agreed on.
 */

import { collections, forRulesVersion } from "@bertinis-vault/vetools-index";
import type { BackgroundRow, LanguageGrant } from "@bertinis-vault/vetools-index";
import type { RulesVersion } from "@bertinis-vault/vetools-ref";

import { slugOf } from "./index-options";
import { speciesLanguagesFor } from "./species";

/** The eight `anyStandard` draws from. `Parser.LANGUAGES_STANDARD`. */
export const STANDARD_LANGUAGES = [
  "Common",
  "Dwarvish",
  "Elvish",
  "Giant",
  "Gnomish",
  "Goblin",
  "Halfling",
  "Orc",
];

/** The marker 5etools writes for the slot the DM settles. */
const OTHER = "other";

export type LanguageOffer = {
  /** The named options. Empty when the book names none at all. */
  options: string[];
  count: number;
  /** Who is asking, for the label. */
  from: "especie" | "trasfondo";
  /**
   * Whether anything outside `options` may pay for it.
   *
   * True for the slots the book leaves to the table. The Boros Legionnaire is
   * the shape that forced this: it offers Celestial, Draconic, Goblin *or* one
   * you and your DM agree on — one pick, an open list, and the three names
   * still worth printing.
   */
  isOpen: boolean;
};

export type LanguagePlan = {
  /** Already spoken. Not choosable. */
  fixed: string[];
  /** Bounded choices still open, in the order they are asked. */
  offers: LanguageOffer[];
};

/** The background row a build points at, or null. */
function backgroundRow(backgroundId: string, rulesVersion: RulesVersion): BackgroundRow | null {
  if (!backgroundId) return null;

  const rows = forRulesVersion(collections.background ?? [], rulesVersion) as BackgroundRow[];
  return rows.find((row) => slugOf(row.name) === backgroundId) ?? null;
}

/**
 * One grant turned into what the player is asked, minus what they already have.
 *
 * An option they already speak is not an option: a half-elf offered Elvish
 * again would be spending their one free pick on nothing.
 */
function offersFrom(
  grant: LanguageGrant | null,
  from: LanguageOffer["from"],
  known: string[],
): LanguageOffer[] {
  if (!grant) return [];

  const offers: LanguageOffer[] = [];

  if (grant.anyStandard > 0) {
    const options = STANDARD_LANGUAGES.filter((name) => !known.includes(name));
    if (options.length) offers.push({ options, count: grant.anyStandard, from, isOpen: false });
  }

  for (const choice of grant.choose) {
    const options = choice.from.filter((name) => name !== OTHER && !known.includes(name));
    const isOpen = choice.from.includes(OTHER);
    if (options.length || isOpen) offers.push({ options, count: choice.count, from, isOpen });
  }

  // "Plus any one language that you and your DM agree is appropriate": an offer
  // with no named options at all, which is exactly what it says.
  if (grant.other > 0) offers.push({ options: [], count: grant.other, from, isOpen: true });

  return offers;
}

/**
 * Everything the character speaks and is still owed.
 *
 * The species is asked before the background because that is the order the
 * chambers run in, and a player who has not chosen a background yet should
 * still see what their species gave them.
 */
export function languagePlanFor(
  raceId: string,
  subraceId: string,
  backgroundId: string,
  rulesVersion: RulesVersion,
): LanguagePlan {
  const species = speciesLanguagesFor(raceId, subraceId, rulesVersion);
  const background = backgroundRow(backgroundId, rulesVersion)?.languages ?? null;

  // Common is the one every character in the game speaks. A 2024 species grants
  // no languages at all — the rule moved to the background — and a character
  // whose background grants none either would otherwise arrive mute.
  const fixed = dedupe(["Common", ...(species?.fixed ?? []), ...(background?.fixed ?? [])]);

  return {
    fixed,
    offers: [...offersFrom(species, "especie", fixed), ...offersFrom(background, "trasfondo", fixed)],
  };
}

/**
 * Which pick paid for which offer.
 *
 * The draft stores languages as one flat list, because speaking Undercommon is
 * one fact however you came by it. The asking is not flat, so the list is
 * distributed the same way the skill offers are.
 *
 * Named offers are settled first. Otherwise an open one standing earlier in the
 * list would swallow a standard language the closed offer below it was the only
 * one that could accept, and the chamber would lock with picks left unpaid.
 */
export function assignLanguages(plan: LanguagePlan, chosen: string[]): string[][] {
  const assigned: string[][] = plan.offers.map(() => []);
  const seen = new Set<string>();
  const leftover: string[] = [];

  const roomAt = (index: number) =>
    (assigned[index] as string[]).length < (plan.offers[index] as LanguageOffer).count;

  for (const language of chosen) {
    if (seen.has(language) || plan.fixed.includes(language)) continue;
    seen.add(language);

    const at = plan.offers.findIndex((offer, index) => offer.options.includes(language) && roomAt(index));
    if (at < 0) leftover.push(language);
    else (assigned[at] as string[]).push(language);
  }

  for (const language of leftover) {
    const at = plan.offers.findIndex((offer, index) => offer.isOpen && roomAt(index));
    if (at >= 0) (assigned[at] as string[]).push(language);
  }

  return assigned;
}

/** Whether every offer has been paid in full. */
export function languagesSatisfied(plan: LanguagePlan, chosen: string[]): boolean {
  const assigned = assignLanguages(plan, chosen);
  return plan.offers.every((offer, at) => (assigned[at] as string[]).length >= offer.count);
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}
