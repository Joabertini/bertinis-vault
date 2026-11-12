/**
 * What the Forge corrects on its own after a change.
 *
 * Seven of the Forge's rules are not choices: they follow from other choices.
 * A new class drops the weapon masteries it no longer grants, a background
 * that names one feat picks it, a 2014 species brings its printed increase.
 * In the web these run as React effects, each keyed on what it depends on.
 *
 * Each one is here as a pure function returning the patch it would write, or
 * null when the draft already agrees. The web's effects call them with their
 * own dependency lists; `settleDraft` runs them for any other interface,
 * checking the same dependencies against the previous draft, so both settle a
 * draft the same way from a single copy of each rule.
 */

import { ABILITY_IDS } from "./abilities";
import type { BuilderState } from "./builder-state";
import { rulesVersionOf } from "./builder-state";
import { classesFor } from "./builder";
import { collapseGearLines } from "./gear-lines";
import { fromLines, proficiencyPlan, toLines } from "./grants";
import { featChoiceForBackground, slugOf } from "./index-options";
import { nameFor } from "./item-facts";
import { languagePlanFor } from "./languages";
import { seedSpeciesBonus } from "./improvements";
import { parseKitSignature, rekitBag, startingKitFor } from "./starting-kit";
import { masteryPlanFor, masteryPlanForCarried, picksStillCarried } from "./weapon-mastery";

type Patch = Partial<BuilderState>;

/** The mastery plan for what the character's classes grant and what they carry. */
export function masteryPlanOf(draft: BuilderState) {
  const rulesVersion = rulesVersionOf(draft);
  return masteryPlanForCarried(
    masteryPlanFor(
      classesFor(draft).map((entry) => ({ classId: entry.classId, level: entry.level })),
      rulesVersion,
    ),
    [
      ...(draft.weaponId ? [nameFor(draft.weaponId, rulesVersion)] : []),
      ...collapseGearLines(toLines(draft.extraEquipmentText)).map((entry) => nameFor(entry.id, rulesVersion)),
    ],
  );
}

/** Masteries the plan no longer allows are let go. */
export function settleMasteries(draft: BuilderState): Patch | null {
  const kept = picksStillCarried(draft.weaponMasteryIds, masteryPlanOf(draft));
  return kept.length !== draft.weaponMasteryIds.length ? { weaponMasteryIds: kept } : null;
}

/** The skills and tools granted outright by species, class, background and feats. */
export function grantedProficienciesOf(draft: BuilderState): string[] {
  const plan = proficiencyPlan(draft, rulesVersionOf(draft));
  return [...plan.grantedSkills, ...plan.grantedTools];
}

/** Granted proficiencies first, then what the player chose. */
export function settleProficiencies(draft: BuilderState): Patch | null {
  const granted = grantedProficienciesOf(draft);
  const chosen = toLines(draft.proficienciesText).filter((entry) => !granted.includes(entry));
  const next = fromLines([...granted, ...chosen]);
  return next !== draft.proficienciesText ? { proficienciesText: next } : null;
}

/** The languages species and background give without asking. */
export function fixedLanguagesOf(draft: BuilderState): string[] {
  return languagePlanFor(draft.raceId, draft.subraceId, draft.backgroundId, rulesVersionOf(draft), draft.sourceBooks)
    .fixed;
}

/** Fixed languages first, then what the player chose. */
export function settleLanguages(draft: BuilderState): Patch | null {
  const fixed = fixedLanguagesOf(draft);
  const chosen = toLines(draft.languagesText).filter((entry) => !fixed.includes(entry));
  const next = fromLines([...fixed, ...chosen]);
  return next !== draft.languagesText ? { languagesText: next } : null;
}

/** The feats the background lets the player take. */
export function backgroundFeatIdsOf(draft: BuilderState): string[] {
  if (!draft.backgroundId) return [];
  const choice = featChoiceForBackground(
    draft.backgroundId,
    rulesVersionOf(draft),
    draft.sourceBooks[`background:${draft.backgroundId}`] ?? draft.sourceBooks.background,
  );
  return (choice?.options ?? []).map((option: { name: string }) => slugOf(option.name));
}

/** A background that names one feat picks it; one that no longer offers the chosen feat drops it. */
export function settleBackgroundFeat(draft: BuilderState): Patch | null {
  const ids = backgroundFeatIdsOf(draft);
  const only = ids.length === 1 ? ids[0]! : "";
  if (only && draft.backgroundFeatId !== only) return { backgroundFeatId: only };
  if (draft.backgroundFeatId && !ids.includes(draft.backgroundFeatId)) return { backgroundFeatId: "" };
  return null;
}

/** What `kitAppliedFor` records for the draft as it is. */
export function kitSignatureOf(draft: BuilderState): string {
  return `${draft.classId}|${draft.backgroundId}|${draft.rulesVersion}`;
}

/** When class, background or edition changed, the old kit leaves the bag and the new one goes in. */
export function settleKit(draft: BuilderState): Patch | null {
  const signature = kitSignatureOf(draft);
  if (draft.kitAppliedFor === signature) return null;

  const rulesVersion = rulesVersionOf(draft);
  const nextRows = startingKitFor(draft.classId, draft.backgroundId, rulesVersion, draft.sourceBooks);
  const previous = parseKitSignature(draft.kitAppliedFor);
  const previousRows = previous
    ? startingKitFor(previous.classId, previous.backgroundId, previous.rulesVersion, draft.sourceBooks)
    : [];
  return {
    kitChoices: {},
    kitAppliedFor: signature,
    extraEquipmentText: fromLines(
      rekitBag(toLines(draft.extraEquipmentText), previousRows, draft.kitChoices, nextRows),
    ),
  };
}

/** A species with no increase assigned yet gets the one it is printed with. */
export function settleSpeciesSeed(draft: BuilderState): Patch | null {
  if (!draft.raceId) return null;
  if (Object.keys(draft.abilityBonuses).length > 0) return null;
  const seed = seedSpeciesBonus(draft, rulesVersionOf(draft));
  return Object.keys(seed).length > 0 ? { abilityBonuses: seed } : null;
}

/** In 2014, without Customizing Your Origin, the increase follows the species. */
export function settlePrintedBonus(draft: BuilderState): Patch | null {
  const rulesVersion = rulesVersionOf(draft);
  if (rulesVersion !== "2014" || draft.customOrigin) return null;
  const printed = seedSpeciesBonus(draft, rulesVersion);
  if (Object.keys(printed).length === 0) return null;
  const already = ABILITY_IDS.every(
    (ability) => (draft.abilityBonuses[ability] ?? 0) === (printed[ability] ?? 0),
  );
  return already ? null : { abilityBonuses: printed };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * One rule, with what has to change for it to run — the dependency list its
 * effect has in the web. A rule with no `when` runs every time and guards
 * itself, as the kit does with its signature.
 */
const RULES: Array<{ settle: (draft: BuilderState) => Patch | null; when?: (draft: BuilderState) => unknown }> = [
  {
    settle: settleMasteries,
    when: (d) => [d.weaponId, d.extraEquipmentText, d.classId, d.level, d.extraClasses, d.subclassId, d.rulesVersion],
  },
  { settle: settleProficiencies, when: grantedProficienciesOf },
  { settle: settleLanguages, when: fixedLanguagesOf },
  { settle: settleBackgroundFeat, when: backgroundFeatIdsOf },
  { settle: settleKit },
  { settle: settleSpeciesSeed, when: (d) => [d.raceId, d.subraceId, d.rulesVersion] },
  {
    settle: settlePrintedBonus,
    when: (d) => [d.customOrigin, d.rulesVersion, seedSpeciesBonus(d, rulesVersionOf(d))],
  },
];

/**
 * The draft after every rule above has had its say.
 *
 * `previous` is the draft before the change. Without it every rule runs, as
 * every effect does when the Forge first opens. Patches computed from the same
 * draft are merged in order, as the effects' writes are; a patch that changes
 * what another rule depends on runs another round, as a re-render would.
 */
export function settleDraft(next: BuilderState, previous?: BuilderState): BuilderState {
  let before = previous;
  let current = next;

  for (let round = 0; round < 6; round++) {
    let patch: Patch = {};
    for (const rule of RULES) {
      const due = !before || !rule.when || !same(rule.when(current), rule.when(before));
      if (!due) continue;
      const found = rule.settle(current);
      if (found) patch = { ...patch, ...found };
    }
    if (Object.keys(patch).length === 0) return current;
    before = current;
    current = { ...current, ...patch };
  }
  return current;
}
