/**
 * What each screen shows, described once.
 *
 * The web and the desktop app draw the same Forge, the same Living Record and
 * the same tome, and until now each assembled what it shows on its own: the
 * web inside its React components, the desktop inside the entry of its rules
 * bundle. Two assemblies of the same screen drift — the desktop's Living
 * Record was three numbers and a table of scores while the web's had twenty
 * sections. This module is the one assembly. A screen asks it for its view
 * and draws what comes back; no rule is decided at the drawing end.
 *
 * Everything here is composition of functions that already exist in this
 * package. A view is plain data — strings, numbers, arrays — because the
 * desktop receives it as JSON.
 */

import type { CharacterBuild } from "@bertinis-vault/contracts";
import { bookLibrary } from "@bertinis-vault/vetools-ref";

import { ABILITY_IDS } from "./abilities";
import { attunementStateFor } from "./attunement";
import {
  characterLevelFor,
  classesFor,
  classingLabelFor,
  unmetMulticlassRequirementsFor,
  type BuilderState,
} from "./builder";
import { rulesVersionOf } from "./builder-state";
import { carriedLoadFor } from "./carrying";
import { allOptions, entryById, hitDieFor } from "./catalog";
import { savingThrowChecksFor, skillChecksFor } from "./checks";
import { tintFor, VAULT_GOLD } from "./class-tint";
import { classEntriesFor } from "./classing";
import { counselFor } from "./counsel";
import { resolveDraft, type ResolvedDraft } from "./derive";
import { expertisePlanFor } from "./expertise";
import { featIdsFor } from "./feats";
import { collapseGearLines } from "./gear-lines";
import { gearProficienciesFor, type ProficiencyLine } from "./gear-proficiencies";
import {
  abilityOptionsOf,
  grantedSpellChoicesFor,
  grantedSpellsFor,
  spellGrantsFor,
} from "./granted-spells";
import { assignOffers, proficiencyPlan, toLines } from "./grants";
import { hitPointLevelsFor } from "./hit-points";
import {
  abilitySources,
  bonusOrigin,
  choiceAt,
  featPrerequisiteProblemsFor,
  improvementPlan,
  originAbilityAllowanceFor,
  scoresBefore,
  speciesBonusBudgetFor,
} from "./improvements";
import { featAbilityGrantsFor, featGearGrantsFor } from "./index-options";
import { factsFor, nameFor } from "./item-facts";
import { assignLanguages, languagePlanFor } from "./languages";
import { talentPools } from "./optional-features";
import { playbookFor } from "./playbook";
import { paletteFor } from "./playbook-palette";
import { masteryPlanOf } from "./settle";
import { sheetDataFor } from "./sheet-data";
import { speciesProficienciesFor, speciesTraitsFor } from "./species";
import {
  actionProfile,
  attributeSpells,
  concentrationAmong,
  formatSpellLine,
  grantedNameSet,
  spellNameOf,
  spellPlansFor,
  type SpellsByLevel,
} from "./spells";
import { coinLabel, startingKitFor } from "./starting-kit";
import { POINT_BUY_BUDGET, canLower, canRaise, pointBuySpent } from "./stat-methods";
import {
  foundrySizeFor,
  initiativeFor,
  passivePerceptionFor,
  sensesFor,
  sizeLabelFor,
  sizeOptionsFor,
  speedFor,
} from "./table-numbers";
import { masteryProblemsFor } from "./weapon-mastery";

/* ---------------- one derivation per draft ---------------- */

let derivedKey: string | null = null;
let derived: ResolvedDraft | null = null;

/**
 * `resolveDraft`, remembered for the last draft asked about.
 *
 * A screen asks for the sheet and then for its own chamber, and each of those
 * used to derive the same draft again. The books in play change the answer
 * without changing the draft, so they are part of the key.
 */
export function derivedOf(draft: BuilderState): ResolvedDraft {
  const key = `${bookLibrary()}|${JSON.stringify(draft)}`;
  if (key !== derivedKey || !derived) {
    derived = resolveDraft(draft);
    derivedKey = key;
  }
  return derived;
}

const snapshotOf = (draft: BuilderState): CharacterBuild | null => {
  const resolved = derivedOf(draft);
  return resolved.status === "ready" ? resolved.snapshot : null;
};

/* ---------------- who the character is ---------------- */

/** The words every screen heads itself with. */
export function identityOf(draft: BuilderState) {
  const rulesVersion = rulesVersionOf(draft);
  const books = draft.sourceBooks;
  const picked = (prop: "race" | "subrace" | "subclass" | "background", id: string) =>
    id ? entryById(prop, rulesVersion, id, books[`${prop}:${id}`]) : null;
  const classLabel = (classId: string) => entryById("class", rulesVersion, classId)?.label ?? classId;

  const race = picked("race", draft.raceId);
  const subrace = picked("subrace", draft.subraceId);
  // "Dwarf (Hill)" reads as "Hill" once the species is already on the line.
  const prefix = race ? `${race.label} (` : "";
  const branch = subrace
    ? prefix && subrace.label.startsWith(prefix)
      ? subrace.label.slice(prefix.length).replace(/\)$/, "")
      : subrace.label
    : "";

  return {
    rulesVersion,
    name: draft.characterName.trim(),
    level: characterLevelFor(draft),
    classId: draft.classId,
    /** The sigil to draw: the class, the species before there is one. */
    sigil: draft.classId || draft.raceId || "fighter",
    tint: draft.classId ? tintFor(draft.classId) : VAULT_GOLD,
    race: race?.label ?? "",
    raceSource: race?.source ?? "",
    branch,
    classLine: draft.classId ? classingLabelFor(draft, classLabel) : "",
    subclass: picked("subclass", draft.subclassId)?.label ?? "",
    background: picked("background", draft.backgroundId)?.label ?? "",
  };
}

/* ---------------- the Forge's own chambers ---------------- */

/** What a screen needs after every change: whether it derives, what is missing, the sheet. */
export function sheetView(draft: BuilderState) {
  const resolved = derivedOf(draft);
  const ready = resolved.status === "ready";
  return {
    status: resolved.status,
    missing: resolved.missing,
    problems: ready ? resolved.problems : [],
    sheet: ready ? sheetDataFor(draft, resolved.snapshot, rulesVersionOf(draft)) : null,
  };
}

/** The Mejoras chamber: every slot reached, what it holds, the scores before it. */
export function growthView(draft: BuilderState) {
  const rulesVersion = rulesVersionOf(draft);
  const plan = improvementPlan(draft, rulesVersion);
  return {
    // The species or background increase: in 2024 the player spends it on the
    // three abilities the background names.
    origin: {
      allowed: originAbilityAllowanceFor(draft, rulesVersion),
      budget: speciesBonusBudgetFor(draft, rulesVersion),
      bonuses: draft.abilityBonuses,
      editable: rulesVersion === "2024" || draft.customOrigin,
    },
    points: 2,
    maxPerAbility: 2,
    unanswered: plan.unanswered,
    slots: plan.slots.map((slot) => {
      const choice = choiceAt(draft, slot.key);
      const featId = choice.kind === "feat" ? choice.featId : "";
      return {
        ...slot,
        choice,
        before: scoresBefore(draft, slot.key),
        problems: featId ? featPrerequisiteProblemsFor(draft, featId) : [],
        grants: featId ? featAbilityGrantsFor(featId, rulesVersion) : [],
        chosenAbilities: featId ? (draft.featAbilityChoices[featId] ?? {}) : {},
      };
    }),
  };
}

function grantsOf(draft: BuilderState, rulesVersion: ReturnType<typeof rulesVersionOf>) {
  return {
    sources: spellGrantsFor(draft, rulesVersion).map((source) => ({
      ...source,
      abilityOptions: abilityOptionsOf(source),
    })),
    choices: grantedSpellChoicesFor(draft, rulesVersion),
    variantChoices: draft.spellVariantChoices,
    abilityChoices: draft.spellAbilityChoices,
    taken: draft.grantedSpellChoices,
  };
}

/** The Dones chamber. */
export function giftsView(draft: BuilderState) {
  const rulesVersion = rulesVersionOf(draft);
  const plan = proficiencyPlan(draft, rulesVersion);
  const granted = [...plan.grantedSkills, ...plan.grantedTools];
  const chosen = toLines(draft.proficienciesText).filter((entry) => !granted.includes(entry));
  const langPlan = languagePlanFor(
    draft.raceId,
    draft.subraceId,
    draft.backgroundId,
    rulesVersion,
    draft.sourceBooks,
  );
  const chosenLanguages = toLines(draft.languagesText).filter((entry) => !langPlan.fixed.includes(entry));
  return {
    granted,
    chosen,
    offers: plan.offers,
    picks: assignOffers(plan.offers, chosen),
    expertise: expertisePlanFor(draft, rulesVersion),
    languages: {
      fixed: langPlan.fixed,
      offers: langPlan.offers,
      chosen: chosenLanguages,
      picks: assignLanguages(langPlan, chosenLanguages),
    },
    grants: grantsOf(draft, rulesVersion),
  };
}

/** The Equipo chamber. */
export function gearView(draft: BuilderState) {
  const rulesVersion = rulesVersionOf(draft);
  const snapshot = snapshotOf(draft);
  const facts = (id: string) => {
    if (!id) return null;
    const found = factsFor(id, rulesVersion, draft.sourceBooks[`item:${id}`]);
    return found
      ? { label: found.row.name, kind: found.kind, weight: found.weight, price: found.price }
      : { label: id };
  };
  const plan = masteryPlanOf(draft);
  return {
    kit: startingKitFor(draft.classId, draft.backgroundId, rulesVersion, draft.sourceBooks),
    kitChoices: draft.kitChoices,
    weapon: facts(draft.weaponId),
    armor: facts(draft.armorId),
    mastery: {
      plan,
      picked: draft.weaponMasteryIds,
      problems: masteryProblemsFor(draft.weaponMasteryIds, plan),
    },
    carried: collapseGearLines(toLines(draft.extraEquipmentText)).map((line) => ({
      ...line,
      label: nameFor(line.id, rulesVersion),
    })),
    load: carriedLoadFor(
      draft,
      rulesVersion,
      snapshot?.abilities.final.str ?? draft.str,
      foundrySizeFor(draft, rulesVersion) ?? undefined,
    ),
    attunement: attunementStateFor(draft, rulesVersion),
  };
}

/** The Camino chamber, besides the class itself: talents, multiclass and hit points. */
export function callingView(draft: BuilderState) {
  const rulesVersion = rulesVersionOf(draft);
  const label = (prop: "class" | "subclass", id: string, book?: string) =>
    id ? (entryById(prop, rulesVersion, id, book)?.label ?? id) : "";
  const classLabel = label("class", draft.classId);
  const subclassLabel = label("subclass", draft.subclassId, draft.sourceBooks[`subclass:${draft.subclassId}`]);
  const pools = [
    ...talentPools(draft, rulesVersion, classLabel, subclassLabel),
    ...draft.extraClasses
      .filter((extra) => extra.classId && extra.level >= 1)
      .flatMap((extra) => {
        const name = label("class", extra.classId);
        const sub = label("subclass", extra.subclassId, draft.sourceBooks[`subclass:${extra.subclassId}`]);
        return talentPools(draft, rulesVersion, name, sub, extra.level).map((pool) => ({
          ...pool,
          name: `${pool.name} (${name})`,
        }));
      }),
  ];
  const snapshot = snapshotOf(draft);
  const con = snapshot ? snapshot.abilities.final.con : draft.con;
  return {
    pools,
    talents: draft.optionalFeatureIds,
    hitPoints: hitPointLevelsFor(draft),
    firstHitDie: classesFor(draft)[0]?.hitDie ?? hitDieFor(draft.classId, rulesVersion) ?? 8,
    conModifier: Math.floor(con / 2) - 5,
    extraClasses: draft.extraClasses.map((extra) => ({ ...extra, label: label("class", extra.classId) })),
    primaryLevelCeiling:
      20 - draft.extraClasses.reduce((total, extra) => total + (extra.classId ? extra.level : 0), 0),
    multiclassProblems: unmetMulticlassRequirementsFor(draft).map((problem) => ({
      ...problem,
      label: label("class", problem.classId),
    })),
  };
}

/** The Raw Grimoire of the Ritual: the payload Foundry imports. */
export function foundryPayloadOf(draft: BuilderState) {
  const resolved = derivedOf(draft);
  return resolved.status === "ready" ? (resolved.payload ?? null) : null;
}

/** The point-buy table of the Aptitudes chamber. */
export function pointBuyView(draft: BuilderState) {
  const scores = { str: draft.str, dex: draft.dex, con: draft.con, int: draft.int, wis: draft.wis, cha: draft.cha };
  return {
    budget: POINT_BUY_BUDGET,
    spent: pointBuySpent(scores),
    rows: ABILITY_IDS.map((id) => ({
      id,
      score: scores[id],
      canRaise: canRaise(scores, id),
      canLower: canLower(scores, id),
    })),
  };
}

/** The Conjuros chamber: lines are "NvN: Name", granted ones are locked and cost nothing. */
export function spellsView(draft: BuilderState) {
  const rulesVersion = rulesVersionOf(draft);
  const classes = allOptions("class", rulesVersion);
  const plans = spellPlansFor({
    entries: classEntriesFor(
      { classId: draft.classId, subclassId: draft.subclassId, level: draft.level },
      draft.extraClasses,
      rulesVersion,
    ),
    labelFor: (classId) => {
      const found = classes.find((entry) => entry.id === classId);
      return { label: found?.label ?? classId, source: found?.source ?? "" };
    },
    rulesVersion,
    snapshot: snapshotOf(draft),
    spellbook: toLines(draft.spellbookText),
  });
  const cantrips = toLines(draft.cantripsText);
  const spells = toLines(draft.spellsText);
  const cantripsByClass = attributeSpells(cantrips, plans, (entry) => entry.cantripOptions);
  const spellsByClass = attributeSpells(spells, plans, (entry) => entry.spellsByLevel);
  const grantedSet = grantedNameSet(grantedSpellsFor(draft, rulesVersion));
  const isGranted = (line: string) => grantedSet.has(spellNameOf(line));
  const levelLines = (byLevel: SpellsByLevel) =>
    byLevel.map(({ level, names }) => ({ level, lines: names.map((name) => formatSpellLine(level, name)) }));

  return {
    plans: plans.map((plan) => {
      const chosenSpells = spellsByClass.get(plan.classId) ?? [];
      const spellLevels = levelLines(plan.spellsByLevel);
      const lockedSpells = spellLevels.flatMap((entry) => entry.lines).filter(isGranted);
      return {
        classId: plan.classId,
        label: plan.label,
        picker: plan.picker,
        cantripOptions: plan.cantripOptions,
        lockedCantrips: plan.cantripOptions.filter(isGranted),
        chosenCantrips: cantripsByClass.get(plan.classId) ?? [],
        book: plan.book ? { limit: plan.book.limit, levels: levelLines(plan.book.options) } : null,
        spellLevels,
        lockedSpells,
        chosenSpells,
        spent: chosenSpells.filter((line) => !lockedSpells.includes(line)).length,
      };
    }),
    book: toLines(draft.spellbookText),
    granted: [...grantedSet],
    grants: grantsOf(draft, rulesVersion),
  };
}

/* ---------------- the Living Record ---------------- */

/**
 * The panel that watches the anvil, as the web's `LiveSheet` draws it.
 *
 * What does not wait for the draft to derive — speed, size, the scores with
 * where each point came from, armour and weapons from the class alone — is
 * filled in from the first pick. What does wait is null until it can be
 * computed, and the screen shows a dash, never a stand-in.
 */
export function recordView(draft: BuilderState) {
  const who = identityOf(draft);
  const rulesVersion = who.rulesVersion;
  const books = draft.sourceBooks;

  const classEntries = draft.classId ? classesFor(draft) : [];
  const classIds = classEntries.map((entry) => entry.classId);
  const speciesGrant = draft.raceId
    ? speciesProficienciesFor(draft.raceId, draft.subraceId, rulesVersion, books)
    : null;
  const featGrants = featGearGrantsFor(featIdsFor(draft), rulesVersion);
  const gear = classEntries.length
    ? gearProficienciesFor(
        classEntries,
        rulesVersion,
        speciesGrant ? { id: draft.raceId, ...speciesGrant } : null,
        featGrants,
      )
    : null;

  const sourceLabels: Record<string, string> = {};
  for (const classId of classIds) {
    sourceLabels[classId] = entryById("class", rulesVersion, classId)?.label ?? classId;
  }
  if (draft.raceId) sourceLabels[draft.raceId] = who.race || draft.raceId;
  for (const grant of featGrants) sourceLabels[grant.id] = grant.label;

  // On a single-class sheet the class is the assumption, and naming it on
  // every line is noise; a species or a feat is the whole answer to "where did
  // this come from". Multiclassed, every line is worth crediting.
  const multiclass = classIds.length > 1;
  const gearLines = (list: ProficiencyLine[]) =>
    list.map((line) => ({
      label: line.label,
      detail: line.detail ?? "",
      from: line.from
        .filter((id) => multiclass || !classIds.includes(id))
        .map((id) => sourceLabels[id] ?? id),
    }));

  const resolved = derivedOf(draft);
  const ready = resolved.status === "ready";
  const snapshot = ready ? resolved.snapshot : null;
  const numbers = snapshot ? snapshot.derived : null;
  const senses = sensesFor(draft, rulesVersion);
  const size = sizeLabelFor(draft, rulesVersion);
  const sources = abilitySources(draft);

  const spellLines = [...toLines(draft.spellsText), ...toLines(draft.cantripsText)];
  const counsel = snapshot
    ? counselFor(
        snapshot,
        draft,
        rulesVersion,
        concentrationAmong(spellLines, rulesVersion),
        spellLines.length > 0 ? actionProfile(spellLines, rulesVersion) : null,
      )
    : [];

  return {
    name: who.name,
    level: who.level,
    race: who.race,
    branch: who.branch,
    classLine: who.classLine,
    subclass: who.subclass,
    background: who.background,
    sigil: who.sigil,
    tint: who.tint,
    ready,
    hp: numbers ? numbers.hp : null,
    ac: numbers ? numbers.ac : null,
    proficiencyBonus: numbers ? numbers.proficiencyBonus : null,
    initiative: snapshot ? initiativeFor(snapshot) : null,
    passivePerception: snapshot ? passivePerceptionFor(snapshot) : null,
    speed: speedFor(draft, rulesVersion),
    darkvision: senses ? senses.darkvision : null,
    otherSpeeds: senses ? senses.otherSpeeds : [],
    size,
    sizePending: !size && sizeOptionsFor(draft, rulesVersion).length > 1,
    spellcasting:
      numbers && numbers.spellcasting
        ? { saveDC: numbers.spellcasting.saveDC, attackBonus: numbers.spellcasting.attackBonus }
        : null,
    abilities: ABILITY_IDS.map((ability) => {
      const source = sources[ability];
      return {
        id: ability,
        score: source.final,
        modifier: Math.floor((source.final - 10) / 2),
        base: source.base,
        species: source.species,
        improvements: source.improvements,
        feats: source.feats,
        capped: Boolean(source.capped),
      };
    }),
    bonusOrigin: bonusOrigin(rulesVersion),
    purse: snapshot && snapshot.choices.startingCopper ? coinLabel(snapshot.choices.startingCopper) : "",
    gear: gear ? { armor: gearLines(gear.armor), weapons: gearLines(gear.weapons) } : null,
    traits: draft.raceId ? speciesTraitsFor(draft.raceId, draft.subraceId, rulesVersion, books) : [],
    grantedSpells: grantedSpellsFor(draft, rulesVersion).map((granted) => ({
      label: granted.label,
      grantedBy: granted.grantedBy,
      uses: granted.uses ?? null,
    })),
    hitDie: draft.classId ? hitDieFor(draft.classId, rulesVersion) : null,
    saves: snapshot ? savingThrowChecksFor(snapshot) : [],
    skills: snapshot ? skillChecksFor(snapshot) : [],
    sealed: ready && resolved.missing.length === 0 && resolved.payload !== null,
    missing: resolved.missing,
    counsel,
    problems: ready ? resolved.problems : [],
  };
}

/* ---------------- the tome ---------------- */

/** The cover of a sealed tome on the shelf. Nothing is derived for it. */
export function coverView(draft: BuilderState) {
  const who = identityOf(draft);
  return { name: who.name, level: who.level, classLine: who.classLine, sigil: who.sigil, tint: who.tint };
}

/**
 * What a tome opens onto: the header both of its views share and the cheat
 * sheet narrowed to this character (`Tome.tsx`, `Vision.tsx`).
 */
export function tomeView(draft: BuilderState) {
  const who = identityOf(draft);
  const snapshot = snapshotOf(draft);
  return {
    name: who.name,
    level: who.level,
    race: who.race,
    classLine: who.classLine,
    subclass: who.subclass,
    background: who.background,
    sigil: who.sigil,
    tint: who.tint,
    rulesVersion: who.rulesVersion,
    hitDie: draft.classId ? hitDieFor(draft.classId, who.rulesVersion) : null,
    derives: snapshot !== null,
    palette: paletteFor(draft.classId),
    playbook: playbookFor(draft, snapshot, who.rulesVersion),
  };
}
