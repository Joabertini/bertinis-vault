// Packs the Vault's 5e rules into one JavaScript file the desktop app embeds.
//
//   node scripts/build-rules.mjs <path to the bertinis-vault checkout>
//
// The output has no imports and touches no browser or Node API: it has to run
// in an embedded interpreter with nothing but the language. `check-rules.mjs`
// holds it to that.
//
// The bundle is committed, with the Vault commit it was built from beside it.
// Building it in CI would need a token that can read the other private
// repository; a file with a recorded origin needs nothing.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const vault = resolve(process.argv[2] ?? "");
if (!process.argv[2]) {
  console.error("usage: node scripts/build-rules.mjs <path to bertinis-vault>");
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "../apps/forja/rules");

// esbuild comes with the Vault's own Vite, so the bundle is built by the same
// tool, at the same version, that builds the web.
const fromWeb = createRequire(join(vault, "apps/web/package.json"));
const fromVite = createRequire(fromWeb.resolve("vite"));
const esbuild = fromVite("esbuild");

const pkg = (name) => join(vault, "packages", name, "src/index.ts");

// The whole surface the desktop calls. Everything crosses as JSON text, so the
// interpreter boundary carries strings and nothing else.
const entry = `
import { applyAction } from "./actions";
import { coerceBuilderState, freshDraft, initialState, rulesVersionOf } from "./builder-state";
import { allOptions, coreOptions, entryById, subclassesFor, subracesFor } from "./catalog";
import { chamberOrder } from "./chambers";
import { missingPieces, resolveDraft } from "./derive";
import { settleDraft } from "./settle";
import {
  choiceAt,
  featPrerequisiteProblemsFor,
  improvementPlan,
  originAbilityAllowanceFor,
  scoresBefore,
  speciesBonusBudgetFor,
} from "./improvements";
import { featAbilityGrantsFor, optionsFor } from "./index-options";
import { assignOffers, proficiencyPlan, toLines } from "./grants";
import { assignLanguages, languagePlanFor } from "./languages";
import { expertisePlanFor } from "./expertise";
import { startingKitFor } from "./starting-kit";
import { factsFor, nameFor } from "./item-facts";
import { masteryPlanOf } from "./settle";
import { masteryProblemsFor } from "./weapon-mastery";
import { collapseGearLines } from "./gear-lines";
import { carriedLoadFor } from "./carrying";
import { foundrySizeFor } from "./table-numbers";
import { attunementStateFor } from "./attunement";
import { classEntriesFor } from "./classing";
import { attributeSpells, grantedNameSet, spellPlansFor } from "./spells";
import { abilityOptionsOf, grantedSpellChoicesFor, grantedSpellsFor, spellGrantsFor } from "./granted-spells";
import { formatSpellLine, spellNameOf } from "./spells";
import { talentPools } from "./optional-features";
import { exportCodex, mergeCodex, readCodexFile } from "./codex-file";
import { hitPointLevelsFor } from "./hit-points";
import { classesFor, unmetMulticlassRequirementsFor } from "./builder";
import { entryById, hitDieFor } from "./catalog";
import { POINT_BUY_BUDGET, canLower, canRaise, pointBuySpent } from "./stat-methods";

// One derivation per draft. A screen asks for the sheet and then for its own
// chamber, and each of those derived the same draft again. Everything crosses
// as JSON, so the draft's text is the key; the books in play change the answer
// without changing the draft, so they are part of it.
let derivedKey = null;
let derived = null;
function derive(draft) {
  const key = bookLibrary() + "|" + JSON.stringify(draft);
  if (key !== derivedKey) {
    derived = resolveDraft(draft);
    derivedKey = key;
  }
  return derived;
}

// The Mejoras chamber: every slot reached, what it holds, the scores before
// it, and for a feat what it grants and what it still asks for.
function growthView(draft) {
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
        chosenAbilities: featId ? draft.featAbilityChoices[featId] ?? {} : {},
      };
    }),
  };
}

const featOptions = (rulesVersion, search) => optionsFor({ prop: "feat", rulesVersion, search, limit: 60 });

// What the web's route computes for the Dones, Equipo and Conjuros chambers,
// from the same package functions. Composition only: no rule lives here.
const lines = (text) => toLines(text);

function grantsFor(draft, rulesVersion) {
  return {
    sources: spellGrantsFor(draft, rulesVersion).map((source) => ({ ...source, abilityOptions: abilityOptionsOf(source) })),
    choices: grantedSpellChoicesFor(draft, rulesVersion),
    variantChoices: draft.spellVariantChoices,
    abilityChoices: draft.spellAbilityChoices,
    taken: draft.grantedSpellChoices,
  };
}

function giftsView(draft) {
  const rulesVersion = rulesVersionOf(draft);
  const plan = proficiencyPlan(draft, rulesVersion);
  const granted = [...plan.grantedSkills, ...plan.grantedTools];
  const chosen = lines(draft.proficienciesText).filter((entry) => !granted.includes(entry));
  const langPlan = languagePlanFor(draft.raceId, draft.subraceId, draft.backgroundId, rulesVersion, draft.sourceBooks);
  const chosenLanguages = lines(draft.languagesText).filter((entry) => !langPlan.fixed.includes(entry));
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
    grants: grantsFor(draft, rulesVersion),
  };
}

function gearView(draft) {
  const rulesVersion = rulesVersionOf(draft);
  const resolved = derive(draft);
  const snapshot = resolved.status === "ready" ? resolved.snapshot : null;
  const facts = (id, prop) => {
    if (!id) return null;
    const found = factsFor(id, rulesVersion, draft.sourceBooks["item:" + id]);
    return found ? { label: found.row.name, kind: found.kind, weight: found.weight, price: found.price } : { label: id };
  };
  const plan = masteryPlanOf(draft);
  return {
    kit: startingKitFor(draft.classId, draft.backgroundId, rulesVersion, draft.sourceBooks),
    kitChoices: draft.kitChoices,
    weapon: facts(draft.weaponId),
    armor: facts(draft.armorId),
    mastery: { plan, picked: draft.weaponMasteryIds, problems: masteryProblemsFor(draft.weaponMasteryIds, plan) },
    carried: collapseGearLines(lines(draft.extraEquipmentText)).map((line) => ({
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

// What the web's Calling chamber gets besides the class itself: talents,
// multiclass and hit points, built as the route builds them.
function callingView(draft) {
  const rulesVersion = rulesVersionOf(draft);
  const label = (prop, id, book) => (id ? entryById(prop, rulesVersion, id, book)?.label ?? id : "");
  const classLabel = label("class", draft.classId);
  const subclassLabel = label("subclass", draft.subclassId, draft.sourceBooks["subclass:" + draft.subclassId]);
  const pools = [
    ...talentPools(draft, rulesVersion, classLabel, subclassLabel),
    ...draft.extraClasses
      .filter((extra) => extra.classId && extra.level >= 1)
      .flatMap((extra) => {
        const name = label("class", extra.classId);
        const sub = label("subclass", extra.subclassId, draft.sourceBooks["subclass:" + extra.subclassId]);
        return talentPools(draft, rulesVersion, name, sub, extra.level).map((pool) => ({
          ...pool,
          name: pool.name + " (" + name + ")",
        }));
      }),
  ];
  const resolved = derive(draft);
  const con = resolved.status === "ready" ? resolved.snapshot.abilities.final.con : draft.con;
  return {
    pools,
    talents: draft.optionalFeatureIds,
    hitPoints: hitPointLevelsFor(draft),
    firstHitDie: classesFor(draft)[0]?.hitDie ?? hitDieFor(draft.classId, rulesVersion) ?? 8,
    conModifier: Math.floor(con / 2) - 5,
    extraClasses: draft.extraClasses.map((extra) => ({ ...extra, label: label("class", extra.classId) })),
    primaryLevelCeiling: 20 - draft.extraClasses.reduce((total, extra) => total + (extra.classId ? extra.level : 0), 0),
    multiclassProblems: unmetMulticlassRequirementsFor(draft).map((problem) => ({
      ...problem,
      label: label("class", problem.classId),
    })),
  };
}

// The Raw Grimoire of the web Ritual: the payload Foundry imports, as JSON.
function foundryPayload(draft) {
  const resolved = derive(draft);
  return resolved.status === "ready" ? resolved.payload ?? null : null;
}

function pointBuyView(draft) {
  const scores = { str: draft.str, dex: draft.dex, con: draft.con, int: draft.int, wis: draft.wis, cha: draft.cha };
  return {
    budget: POINT_BUY_BUDGET,
    spent: pointBuySpent(scores),
    rows: Object.keys(scores).map((id) => ({
      id,
      score: scores[id],
      canRaise: canRaise(scores, id),
      canLower: canLower(scores, id),
    })),
  };
}

const itemOptions = (rulesVersion, search, kind) =>
  optionsFor({
    prop: "item",
    rulesVersion,
    search,
    limit: 40,
    weaponsOnly: kind === "weapon",
    armorOnly: kind === "armor",
  });

function spellsView(draft) {
  const rulesVersion = rulesVersionOf(draft);
  const resolved = derive(draft);
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
    snapshot: resolved.status === "ready" ? resolved.snapshot : null,
    spellbook: lines(draft.spellbookText),
  });
  const cantrips = lines(draft.cantripsText);
  const spells = lines(draft.spellsText);
  const cantripsByClass = attributeSpells(cantrips, plans, (entry) => entry.cantripOptions);
  const spellsByClass = attributeSpells(spells, plans, (entry) => entry.spellsByLevel);
  // As the web SpellClassSection: lines are "NvN: Name", granted ones are
  // locked and cost nothing.
  const grantedSet = grantedNameSet(grantedSpellsFor(draft, rulesVersion));
  const isGranted = (line) => grantedSet.has(spellNameOf(line));
  const levelLines = (byLevel) =>
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
    book: lines(draft.spellbookText),
    granted: [...grantedNameSet(grantedSpellsFor(draft, rulesVersion))],
    grants: grantsFor(draft, rulesVersion),
  };
}
import { sheetDataFor } from "./sheet-data";
import { bookLibrary, setBookLibrary } from "@bertinis-vault/vetools-ref";

// What a screen needs after every change, in one crossing: whether the draft
// derives, what it is missing and the sheet it makes.
function view(draft) {
  const resolved = derive(draft);
  const ready = resolved.status === "ready";
  return {
    status: resolved.status,
    missing: resolved.missing,
    problems: ready ? resolved.problems : [],
    sheet: ready ? sheetDataFor(draft, resolved.snapshot, rulesVersionOf(draft)) : null,
  };
}

const api = {
  applyAction,
  settleDraft,
  coerceBuilderState,
  resolveDraft: derive,
  freshDraft,
  initialState: () => initialState,
  allOptions,
  coreOptions,
  entryById,
  subracesFor,
  subclassesFor,
  chamberOrder,
  missingPieces,
  setBookLibrary: (library) => (setBookLibrary(library), null),
  view,
  growthView,
  featOptions,
  giftsView,
  gearView,
  itemOptions,
  spellsView,
  pointBuyView,
  callingView,
  foundryPayload,
  exportCodex,
  readCodexFile,
  mergeCodex,
};

globalThis.forge = {
  names: Object.keys(api),
  invoke(name, argsJson) {
    const fn = api[name];
    if (!fn) throw new Error("forge: no function named " + name);
    const result = fn(...JSON.parse(argsJson));
    return JSON.stringify(result === undefined ? null : result);
  },
};
`;

const result = await esbuild.build({
  stdin: { contents: entry, resolveDir: join(vault, "packages/forge/src"), loader: "ts" },
  bundle: true,
  format: "iife",
  platform: "neutral",
  mainFields: ["module", "main"],
  target: "es2020",
  minify: true,
  legalComments: "none",
  write: false,
  alias: {
    "@bertinis-vault/contracts": pkg("contracts"),
    "@bertinis-vault/data-engine": pkg("data-engine"),
    "@bertinis-vault/domain": pkg("domain"),
    "@bertinis-vault/vetools-index": pkg("vetools-index"),
    "@bertinis-vault/vetools-ref": pkg("vetools-ref"),
  },
});

const git = (...args) => execFileSync("git", args, { cwd: vault, encoding: "utf8" }).trim();
const dirty = git("status", "--porcelain", "--", "packages") !== "";

mkdirSync(out, { recursive: true });
const code = result.outputFiles[0].text;
writeFileSync(join(out, "forge.js"), code);
writeFileSync(
  join(out, "forge.origin.json"),
  JSON.stringify({ repository: "Joabertini/bertinis-vault", commit: git("rev-parse", "HEAD"), dirty }, null, 2) + "\n",
);

console.log(`forge.js: ${(code.length / 1024).toFixed(0)} KB, from ${git("rev-parse", "--short", "HEAD")}${dirty ? " (dirty)" : ""}`);
