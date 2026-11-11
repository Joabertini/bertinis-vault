/**
 * The Forge — the chambers a character is made in.
 *
 * Ancestry and Calling show the edition's own Player's Handbook as cards and
 * keep the other thirty books behind a search. Origin is search only: 161
 * backgrounds is not a grid. Attributes rolls and binds. Gifts hands out what
 * the class and background grant and asks for what they offer. Gear arms.
 * Spells appears only for casters. Identity names.
 *
 * The chamber list is therefore not fixed, so the current chamber is tracked
 * by key rather than by index — a wizard who becomes a fighter loses a chamber
 * and an index would silently point at a different one.
 *
 * Every pick writes onto the draft in the repo's `BuilderState` shape, so the
 * Living Record on the right is reading the same numbers the export will.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { setBookLibrary } from "@bertinis-vault/vetools-ref";
import { motion, AnimatePresence } from "framer-motion";

import LightfallBackdrop from "@/components/fx/LightfallBackdrop";
import GrainOverlay from "@/components/fx/GrainOverlay";
import StokeEmbers from "@/components/fx/StokeEmbers";
import Sigil from "@/components/sigils/Sigil";
import RuneButton from "@/components/ui/RuneButton";
import RuleNote from "@/components/ui/RuleNote";
import DiceTray from "@/components/forge/DiceTray";
import StatRune from "@/components/forge/StatRune";
import SigilCard from "@/components/forge/SigilCard";
import SigilShelf from "@/components/forge/SigilShelf";
import BackgroundGrant from "@/components/forge/BackgroundGrant";
import ScryPicker from "@/components/forge/ScryPicker";
import RarityScry from "@/components/forge/RarityScry";
import InfoPanel from "@/components/info/InfoPanel";
import { InfoProvider, InfoReset, useInfo } from "@/components/info/info-context";
import PickList from "@/components/forge/PickList";
import LiveSheet from "@/components/forge/LiveSheet";

import { ABILITY_IDS, abilityLabels, type AbilityId } from "@/lib/abilities";
import {
  allOptions,
  entryById,
  hitDieFor,
  searchAll,
  searchBeyondCore,
  subclassesFor,
  subracesFor,
  type CatalogEntry,
} from "@/lib/catalog";
import {
  featChoiceForBackground,
  featGearGrantsFor,
  levellingFor,
  optionsFor,
  slugOf,
  startingEquipmentForClass,
} from "@/lib/index-options";
import { featIdsFor } from "@/lib/feats";
import ItemFacts from "@/components/forge/ItemFacts";
import { collapseGearLines } from "@/lib/gear-lines";
import { factsFor, nameFor } from "@/lib/item-facts";
import { armorWarningFor, weaponWarningFor } from "@/lib/gear-warnings";
import { gearProficienciesFor } from "@/lib/gear-proficiencies";
import { speciesProficienciesFor } from "@/lib/species";
import { assignLanguages, languagePlanFor, languagesSatisfied } from "@/lib/languages";
import { branchIsRequiredFor } from "@/lib/species-branch";
import StartingKit from "@/components/forge/StartingKit";
import { parseKitSignature, rekitBag, startingKitFor, swapKitAnswer } from "@/lib/starting-kit";
import PointBuy from "@/components/forge/PointBuy";
import {
  ROLL_ATTEMPTS,
  STAT_METHODS,
  abilitiesSettled,
  pointBuyFloor,
  scratchForMethod,
  type StatMethodId,
} from "@/lib/stat-methods";
import { tintFor, VAULT_GOLD } from "@/lib/class-tint";
import { resolveDraft } from "@/lib/derive";
import {
  assignOffers,
  fromLines,
  offersAreSatisfied,
  proficiencyPlan,
  toLines,
} from "@/lib/grants";
import { attributeSpells, grantedNameSet, spellPlansFor, strayChoices } from "@/lib/spells";
import SpellClassSection from "@/components/forge/SpellClassSection";
import {
  abilityOptionsOf,
  grantedSpellChoicesFor,
  grantedSpellsFor,
  spellGrantsFor,
  unansweredAbilities,
  unansweredSpellChoices,
  type GrantedSpellChoice,
  type SpellGrantSource,
} from "@/lib/granted-spells";
import BonusEditor from "@/components/forge/BonusEditor";
import OriginBonus from "@/components/forge/OriginBonus";
import Improvements from "@/components/forge/Improvements";
import TalentPools from "@/components/forge/TalentPools";
import GearBag from "@/components/forge/GearBag";
import Multiclass from "@/components/forge/Multiclass";
import WeaponMastery from "@/components/forge/WeaponMastery";
import Expertise from "@/components/forge/Expertise";
import type { ExtraClass } from "@/lib/classing";
import { classEntriesFor, emptyExtraClass } from "@/lib/classing";
import { suggestAppearance, type Appearance } from "@/lib/appearance";
import {
  masteryPlanFor,
  masteryPlanForCarried,
  masteryProblemsFor,
  picksStillCarried,
} from "@/lib/weapon-mastery";
import { expertisePlanFor } from "@/lib/expertise";
import { classesFor, unmetMulticlassRequirementsFor } from "@/lib/builder";
import { talentPools, talentsSatisfied } from "@/lib/optional-features";
import {
  bonusOrigin,
  originAbilityAllowanceFor,
  bonusShape,
  improvementPlan,
  maxPointsPerAbility,
  seedSpeciesBonus,
  speciesBonusBudgetFor,
} from "@/lib/improvements";
import { useVault, releasedByPick, rulesVersionOf, type Pace } from "@/lib/vault-store";
import { chamberOrder, firstChamber, type ChamberKey } from "@/lib/chambers";
import { hitPointLevelsFor } from "@/lib/hit-points";
import { carriedLoadFor } from "@/lib/carrying";
import { attunementStateFor } from "@/lib/attunement";
import { foundrySizeFor, sizeFor, sizeNameOf, sizeOptionsFor } from "@/lib/table-numbers";
import Attunement from "@/components/forge/Attunement";
import CarryingLoad from "@/components/forge/CarryingLoad";
import HitPoints from "@/components/forge/HitPoints";
import CoverPicker from "@/components/codex/CoverPicker";
import { DIVIDER, DIVIDER_TIGHT, HEADING, ITEM_META, ITEM_NAME, LABEL, LABEL_MB2, LABEL_MB4, META, PAGE, WHISPER, WHISPER_MB4 } from "@/styles/recipes";

const CHAMBER_LABEL: Record<ChamberKey, string> = {
  ancestry: "Raza",
  calling: "Camino",
  origin: "Origen",
  attributes: "Aptitudes",
  growth: "Mejora de característica",
  gifts: "Dones",
  gear: "Equipo",
  spells: "Conjuros",
  identity: "Identidad",
};

/*
 * Exported for the smoke test, which walks the rail and has to know what
 * arriving looks like. Reading the same map the page renders is the point: a
 * copy in the test would pass while the page said something else.
 */
export const CHAMBER_TITLE: Record<ChamberKey, string> = {
  ancestry: "Elegi tu raza",
  calling: "Elegi tu camino",
  origin: "Recorda de donde venis",
  attributes: "Liga tus aptitudes",
  growth: "Mejora de puntuación de característica",
  gifts: "Reclama tus dones",
  gear: "Armate",
  spells: "Aprende tus conjuros",
  identity: "Talla tu nombre",
};

const CHAMBER_EPIGRAPH: Partial<Record<ChamberKey, string>> = {
  ancestry: "La sangre recuerda lo que la mente olvida.",
  // Kept keyed as `ancestry` and `calling` on purpose: the chamber keys are
  // stored in progress state, and renaming them would strand anyone mid-forge.
  calling: "Todo camino elegido cierra los que no tomaste.",
  origin: "Nadie llega a la primera puerta sin historia.",
  attributes: "Los huesos no mienten. Ligalos con criterio.",
  growth: "Cada nivel cobra su precio y paga lo suyo.",
  gifts: "Lo que sabes hacer pesa mas que lo que llevas encima.",
  gear: "El acero no pregunta de donde venis.",
  spells: "Cada palabra aprendida ocupa un lugar que otra ya no tendra.",
};

/** What the notice says was changed, per chamber. */
const SHED_SUBJECT: Partial<Record<ChamberKey, string>> = {
  ancestry: "de especie",
  calling: "de clase",
  origin: "de trasfondo",
};

export default function Forge() {
  const navigate = useNavigate();
  const { draft, patchDraft, scratch, setScratch, seal, editingId, pace, setPace } = useVault();

  // The opening chamber of whichever order this player asked for. Read once,
  // on mount: after that the rail decides where they are.
  const [chamberKey, setChamberKey] = useState<ChamberKey>(firstChamber(pace ?? "nuevo"));
  const [stokeKey, setStokeKey] = useState(0);
  /** What the last species or class change released, named for the player. */
  const [shedByPick, setShedByPick] = useState<string[]>([]);

  // The books the table allows decide what every chamber offers. Set before
  // anything below reads the catalog; leaving the Forge restores every book,
  // so a saved character always finds its picks again.
  setBookLibrary(draft.supplements ? "all" : "core");
  useEffect(() => () => setBookLibrary("all"), []);

  const rulesVersion = rulesVersionOf(draft);
  const accent = draft.classId ? tintFor(draft.classId) : VAULT_GOLD;

  const resolved = useMemo(() => resolveDraft(draft), [draft]);
  const snapshot = resolved.status === "ready" ? resolved.snapshot : null;

  /* ---------------- catalog ---------------- */

  const allRaces = useMemo(() => allOptions("race", rulesVersion), [rulesVersion]);
  const allClasses = useMemo(() => allOptions("class", rulesVersion), [rulesVersion]);
  const allBackgrounds = useMemo(() => allOptions("background", rulesVersion), [rulesVersion]);

  /** A class's name and book, for the spell plans. */
  const classLabelFor = useCallback(
    (classId: string) => {
      const found = allClasses.find((entry) => entry.id === classId);
      return { label: found?.label ?? classId, source: found?.source ?? "" };
    },
    [allClasses],
  );

  const weaponSearch = useMemo(
    () => (query: string, rarities: readonly string[]) =>
      optionsFor({ prop: "item", rulesVersion, search: query, weaponsOnly: true, limit: 30, rarities }),
    [rulesVersion],
  );
  const armorSearch = useMemo(
    () => (query: string, rarities: readonly string[]) =>
      optionsFor({ prop: "item", rulesVersion, search: query, armorOnly: true, limit: 30, rarities }),
    [rulesVersion],
  );
  // The bag searches every item, not only weapons and armour.
  const gearSearch = useMemo(
    () => (query: string, rarities: readonly string[]) =>
      optionsFor({ prop: "item", rulesVersion, search: query, limit: 60, rarities }),
    [rulesVersion],
  );

  const selectedRace = entryById("race", rulesVersion, draft.raceId, draft.sourceBooks[`race:${draft.raceId}`]);
  const selectedClass = entryById("class", rulesVersion, draft.classId);
  const selectedBackground = entryById(
    "background",
    rulesVersion,
    draft.backgroundId,
    draft.sourceBooks[`background:${draft.backgroundId}`],
  );
  const subraces = useMemo(
    () => (selectedRace ? subracesFor(selectedRace.label, rulesVersion) : []),
    [selectedRace, rulesVersion],
  );

  const subclassLevel = levellingFor(draft.classId, rulesVersion).subclassLevel ?? 3;
  const subclassUnlocked = draft.level >= subclassLevel;

  // Read against the final scores, and reported rather than refused.
  const primaryLevelCeiling =
    20 - draft.extraClasses.reduce((total, extra) => total + (extra.classId ? extra.level : 0), 0);

  const expertisePlan = useMemo(
    () => expertisePlanFor(draft, rulesVersion),
    [draft, rulesVersion],
  );

  /*
   * Mastery comes from the weapons the character has: the kit, the weapon they
   * picked and whatever is in the bag. It is not a list to choose from.
   */
  const masteryPlan = useMemo(
    () =>
      masteryPlanForCarried(
        masteryPlanFor(
          classesFor(draft).map((entry) => ({ classId: entry.classId, level: entry.level })),
          rulesVersion,
        ),
        [
          ...(draft.weaponId ? [nameFor(draft.weaponId, rulesVersion)] : []),
          ...collapseGearLines(toLines(draft.extraEquipmentText)).map((entry) =>
            nameFor(entry.id, rulesVersion),
          ),
        ],
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft.weaponId, draft.extraEquipmentText, draft.classId, draft.level, draft.extraClasses, draft.subclassId, rulesVersion],
  );

  // A weapon that left the bag takes its mastery with it.
  useEffect(() => {
    const kept = picksStillCarried(draft.weaponMasteryIds, masteryPlan);
    if (kept.length !== draft.weaponMasteryIds.length) patchDraft({ weaponMasteryIds: kept });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masteryPlan]);

  const masteryProblems = useMemo(
    () => masteryProblemsFor(draft.weaponMasteryIds, masteryPlan),
    [draft.weaponMasteryIds, masteryPlan],
  );

  const multiclassProblems = useMemo(() => unmetMulticlassRequirementsFor(draft), [draft]);

  /*
   * The levels that have a hit point roll to record, and the die the first
   * level is granted at. The first is not asked about — it is the die at
   * maximum — but it is shown, which is what stops the list starting at two
   * looking like a bug.
   */
  const hitPointLevels = useMemo(() => hitPointLevelsFor(draft), [draft]);
  const firstHitDie = useMemo(
    () => classesFor(draft)[0]?.hitDie ?? hitDieFor(draft.classId, rulesVersion) ?? 8,
    [draft, rulesVersion],
  );

  const subclasses = useMemo(
    () => (selectedClass ? subclassesFor(selectedClass.label, rulesVersion) : []),
    [selectedClass, rulesVersion],
  );

  /* ---------------- grants ---------------- */

  const profPlan = useMemo(() => proficiencyPlan(draft, rulesVersion), [draft, rulesVersion]);
  const langPlan = useMemo(
    () =>
      languagePlanFor(
        draft.raceId,
        draft.subraceId,
        draft.backgroundId,
        rulesVersion,
        draft.sourceBooks,
      ),
    [draft.raceId, draft.subraceId, draft.backgroundId, rulesVersion, draft.sourceBooks],
  );

  const granted = useMemo(
    () => [...profPlan.grantedSkills, ...profPlan.grantedTools],
    [profPlan],
  );

  /*
   * The species half of that, so the panel can name who gave what. Read from
   * the same source the plan reads, rather than by subtracting one list from
   * another and hoping the two stay in step.
   */
  const speciesGrant = useMemo(
    () => (draft.raceId ? speciesProficienciesFor(draft.raceId, draft.subraceId, rulesVersion, draft.sourceBooks) : null),
    [draft.raceId, draft.subraceId, rulesVersion],
  );
  const speciesGranted = useMemo(
    () => [...(speciesGrant?.skills.granted ?? []), ...(speciesGrant?.tools.granted ?? [])],
    [speciesGrant],
  );

  /* The sizes this species offers. One for most, two for thirty of them. */
  const sizeOptions = useMemo(
    () => sizeOptionsFor(draft, rulesVersion),
    [draft.raceId, draft.subraceId, rulesVersion],
  );
  const otherGranted = useMemo(
    () => granted.filter((entry) => !speciesGranted.includes(entry)),
    [granted, speciesGranted],
  );

  const chosenProficiencies = useMemo(
    () => toLines(draft.proficienciesText).filter((entry) => !granted.includes(entry)),
    [draft.proficienciesText, granted],
  );

  /** Which offer paid for each pick, so each picker counts only its own. */
  const offerPicks = useMemo(
    () => assignOffers(profPlan.offers, chosenProficiencies),
    [profPlan.offers, chosenProficiencies],
  );

  const chosenLanguages = useMemo(
    () => toLines(draft.languagesText).filter((entry) => !langPlan.fixed.includes(entry)),
    [draft.languagesText, langPlan.fixed],
  );

  /**
   * Which offer paid for each language, and what was written in by hand.
   *
   * Same reason the skills needed it: handed the whole list, the species'
   * picker counted the background's picks against its own limit and locked
   * itself before a single choice was made in it.
   */
  const languagePicks = useMemo(
    () => assignLanguages(langPlan, chosenLanguages),
    [langPlan, chosenLanguages],
  );

  /** A language typed into an open offer, added the way a tick would add it. */
  const writeLanguage = (value: string) => {
    const entry = value.trim();
    if (!entry || chosenLanguages.includes(entry) || langPlan.fixed.includes(entry)) return;
    patchDraft({ languagesText: fromLines([...langPlan.fixed, ...chosenLanguages, entry]) });
  };

  /**
   * Keep what the species and the background grant present in the text.
   *
   * Changing either changes what is granted, and the previous grants would
   * otherwise linger as if the player had chosen them.
   */
  useEffect(() => {
    const next = fromLines([...granted, ...chosenProficiencies]);
    if (next !== draft.proficienciesText) patchDraft({ proficienciesText: next });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [granted.join("|")]);

  useEffect(() => {
    const next = fromLines([...langPlan.fixed, ...chosenLanguages]);
    if (next !== draft.languagesText) patchDraft({ languagesText: next });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [langPlan.fixed.join("|")]);

  /* ---------------- spells ---------------- */

  /*
   * One plan per class the character casts with, not one for the first class.
   *
   * Reading `draft.classId` alone was three of the beta reports at once: a
   * fighter who took a level of wizard got no Spells chamber, because the
   * fighter casts nothing and the wizard was never asked; and a wizard who took
   * cleric got the wizard list and none of the cleric's.
   */
  const spellPlans = useMemo(
    () =>
      spellPlansFor({
        entries: classEntriesFor(
          { classId: draft.classId, subclassId: draft.subclassId, level: draft.level },
          draft.extraClasses,
          rulesVersion,
        ),
        labelFor: classLabelFor,
        rulesVersion,
        snapshot,
        spellbook: toLines(draft.spellbookText),
      }),
    [
      draft.classId,
      draft.subclassId,
      draft.level,
      draft.extraClasses,
      draft.spellbookText,
      allClasses,
      rulesVersion,
      snapshot,
    ],
  );

  const castsAnything = spellPlans.length > 0;

  /**
   * What a change of classes or levels takes with it from the spell lists.
   *
   * Asked of the draft as it will be, against the plans it will have: the
   * spells only a class that is leaving offered, and the ones above the spell
   * level a lower level reaches. Done on the change itself rather than in an
   * effect, so a list brought in from a Foundry actor is never pruned behind
   * the player's back — only what their own change made illegal goes.
   */
  const releaseStraySpells = (
    next: typeof draft,
  ): { patch: Partial<typeof draft>; shed: string[] } => {
    const plans = spellPlansFor({
      entries: classEntriesFor(
        { classId: next.classId, subclassId: next.subclassId, level: next.level },
        next.extraClasses,
        rulesVersion,
      ),
      labelFor: classLabelFor,
      rulesVersion,
      snapshot,
      spellbook: toLines(next.spellbookText),
    });
    const stray = strayChoices(plans, {
      cantrips: toLines(next.cantripsText),
      spells: toLines(next.spellsText),
      book: toLines(next.spellbookText),
    });
    const count = stray.cantrips.length + stray.spells.length + stray.book.length;
    if (count === 0) return { patch: {}, shed: [] };

    const without = (text: string, drop: string[]) =>
      fromLines(toLines(text).filter((line) => !drop.includes(line)));

    return {
      patch: {
        cantripsText: without(next.cantripsText, stray.cantrips),
        spellsText: without(next.spellsText, [...stray.spells, ...stray.book]),
        spellbookText: without(next.spellbookText, stray.book),
      },
      shed: [count === 1 ? "un conjuro que ya no te ofrece ninguna clase" : `${count} conjuros que ya no te ofrece ninguna clase`],
    };
  };

  const chosenCantrips = useMemo(() => toLines(draft.cantripsText), [draft.cantripsText]);
  const chosenSpells = useMemo(() => toLines(draft.spellsText), [draft.spellsText]);
  const chosenBook = useMemo(() => toLines(draft.spellbookText), [draft.spellbookText]);

  /*
   * Which class each chosen spell counts against.
   *
   * Storage stays one flat list, because that is what the export reads and what
   * every saved draft already holds — nothing has to be migrated for a second
   * class to work. Only the counters need an owner, and the rule is the first
   * class whose list has the spell: Cure Wounds is on four lists, and counting
   * it against all of them would show a wizard/cleric over the limit on both
   * sides at once.
   */
  const spellsByClass = useMemo(
    () => attributeSpells(chosenSpells, spellPlans, (entry) => entry.spellsByLevel),
    [chosenSpells, spellPlans],
  );

  const cantripsByClass = useMemo(
    () => attributeSpells(chosenCantrips, spellPlans, (entry) => entry.cantripOptions),
    [chosenCantrips, spellPlans],
  );

  /*
   * The named alternatives a species or a subclass offers.
   *
   * In 2024 this is the lineage itself and not a spell detail: XPHB ships no
   * subraces at all, so an elf's Drow, High Elf and Wood Elf exist nowhere in
   * the data but as the names on its spell blocks. The question is asked in
   * the chamber that raised it — a species question next to the species —
   * because a fighter elf never opens the spell chamber and still has one.
   */
  const spellGrants = useMemo(() => spellGrantsFor(draft, rulesVersion), [draft, rulesVersion]);
  /** Spells handed over outright: locked in the pickers and free of the class's count. */
  const grantedNames = useMemo(
    () => grantedNameSet(grantedSpellsFor(draft, rulesVersion)),
    [draft, rulesVersion],
  );

  const chooseVariant = (key: string, name: string) => {
    patchDraft({ spellVariantChoices: { ...draft.spellVariantChoices, [key]: name } });
  };

  /*
   * Which ability the granted spells are cast with.
   *
   * Not a flavour question. dnd5e keeps the ability on the spell itself, and
   * for a fighter or a rogue it is the only thing that gives a species cantrip
   * a save DC — they have no spellcasting ability of their own.
   */
  const chooseSpellAbility = (key: string, ability: string) => {
    patchDraft({ spellAbilityChoices: { ...draft.spellAbilityChoices, [key]: ability } });
  };

  /** The filter questions: "two cantrips of your choice from that list". */
  const spellChoices = useMemo(
    () => grantedSpellChoicesFor(draft, rulesVersion),
    [draft, rulesVersion],
  );

  const toggleGrantedSpell = (key: string, name: string) => {
    const taken = draft.grantedSpellChoices[key] ?? [];
    const next = taken.includes(name)
      ? taken.filter((entry) => entry !== name)
      : [...taken, name];
    patchDraft({ grantedSpellChoices: { ...draft.grantedSpellChoices, [key]: next } });
  };

  /* ---------------- growth ---------------- */

  const growth = useMemo(() => improvementPlan(draft, rulesVersion), [draft, rulesVersion]);

  /** In 2014 the species grants a fixed amount; in 2024 the background gives three. */
  /**
   * The feat the background hands over.
   *
   * 59 of the 60 backgrounds in 2024 grant an origin feat, and 15 of the 101 in
   * 2014 do. The panel below has always *shown* it; nothing ever recorded it,
   * so every character built here left without the feat their background gives
   * them and it never reached Foundry. The only writer of `backgroundFeatId`
   * was the Foundry importer.
   */
  const backgroundFeat = useMemo(
    () =>
      draft.backgroundId
        ? featChoiceForBackground(
            draft.backgroundId,
            rulesVersion,
            draft.sourceBooks[`background:${draft.backgroundId}`] ?? draft.sourceBooks.background,
          )
        : null,
    [draft.backgroundId, rulesVersion, draft.sourceBooks],
  );

  const backgroundFeatIds = useMemo(
    () => (backgroundFeat?.options ?? []).map((option: { name: string }) => slugOf(option.name)),
    [backgroundFeat],
  );

  /**
   * A single option is a grant, not a question: record it rather than asking a
   * player to confirm the only answer. Several are a real choice and stay for
   * them to make. Either way a feat the current background no longer offers is
   * dropped, so changing background does not leave the old one behind.
   */
  useEffect(() => {
    const only = backgroundFeatIds.length === 1 ? backgroundFeatIds[0]! : "";
    if (only && draft.backgroundFeatId !== only) {
      patchDraft({ backgroundFeatId: only });
      return;
    }
    if (draft.backgroundFeatId && !backgroundFeatIds.includes(draft.backgroundFeatId)) {
      patchDraft({ backgroundFeatId: "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backgroundFeatIds.join("|")]);

  /** The three abilities a 2024 background names. Null in 2014. */
  const originAllowance = useMemo(
    () => originAbilityAllowanceFor(draft, rulesVersion),
    [draft, rulesVersion],
  );

  const speciesBudget = useMemo(
    () => speciesBonusBudgetFor(draft, rulesVersion),
    [draft, rulesVersion],
  );

  /**
   * The spread the species is printed with, kept alongside the edited one.
   *
   * Tasha's Cauldron let a player move a species increase wherever they like,
   * and the editor has always allowed it — but once the numbers were moved
   * there was no way back short of remembering what a mountain dwarf gets.
   * Holding the seed makes "restore" a button instead of a research task.
   */
  const printedBonus = useMemo(
    () => seedSpeciesBonus(draft, rulesVersion),
    // Only the species decides it. Recomputing on every draft change would
    // rebuild an identical object each keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft.raceId, draft.subraceId, rulesVersion],
  );

  /**
   * Whether skipping the branch leaves nothing at all.
   *
   * Every 2014 species with branches was labelled "Optional" the same way,
   * on the assumption that the race row always carries its own bonus and the
   * branch only adds flavour on top — true for the ones a table plays every
   * week. It is not true for all 91: a handful print nothing at the race
   * level at all, so a player who trusted "Optional" and skipped the branch
   * got no ability increase and, for some, no species language either. See
   * `species-branch.ts` for the check, which reads the index rather than
   * naming a race.
   */
  const branchIsRequired = useMemo(
    () => branchIsRequiredFor(draft, rulesVersion),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft.raceId, draft.backgroundId, draft.sourceBooks, rulesVersion],
  );

  /** Whether the increase has been moved off what the book prints. */
  const bonusMoved = useMemo(() => {
    const printed = Object.keys(printedBonus).length > 0;
    if (!printed) return false;

    return ABILITY_IDS.some(
      (ability) => (draft.abilityBonuses[ability] ?? 0) !== (printedBonus[ability] ?? 0),
    );
  }, [draft.abilityBonuses, printedBonus]);

  const selectedSubclass = entryById(
    "subclass",
    rulesVersion,
    draft.subclassId,
    draft.sourceBooks[`subclass:${draft.subclassId}`],
  );

  /**
   * Styles, invocations, metamagic, maneuvers — whatever every class asks.
   *
   * Every class, not the first one: a fighter who took two levels of warlock
   * has two invocations, and asking only the fighter left them with none on
   * the sheet. Another class's pools are counted at its own level and named
   * after it, so the two "Fighting Style" questions of a fighter/paladin read
   * as two.
   */
  const pools = useMemo(
    () => [
      ...talentPools(draft, rulesVersion, selectedClass?.label ?? "", selectedSubclass?.label ?? ""),
      ...draft.extraClasses
        .filter((extra) => extra.classId && extra.level >= 1)
        .flatMap((extra) => {
          const taken = entryById("class", rulesVersion, extra.classId);
          const sub = extra.subclassId
            ? entryById(
                "subclass",
                rulesVersion,
                extra.subclassId,
                draft.sourceBooks[`subclass:${extra.subclassId}`],
              )
            : null;
          const label = taken?.label ?? extra.classId;
          return talentPools(draft, rulesVersion, label, sub?.label ?? "", extra.level).map(
            (pool) => ({ ...pool, name: `${pool.name} (${label})` }),
          );
        }),
    ],
    [draft, rulesVersion, selectedClass, selectedSubclass],
  );

  const carried = useMemo(() => toLines(draft.extraEquipmentText), [draft.extraEquipmentText]);

  /*
   * What all of it weighs, against what this character can carry. Read from
   * the derived Strength rather than the typed one: a half-orc's +2 and a
   * feat that raises Strength both change what they can carry.
   */
  const load = useMemo(
    () =>
      carriedLoadFor(
        draft,
        rulesVersion,
        snapshot?.abilities.final.str ?? draft.str,
        foundrySizeFor(draft, rulesVersion) ?? undefined,
      ),
    [draft, rulesVersion, snapshot],
  );

  /**
   * What the character is attuned to, out of what asks for it.
   *
   * Nothing for most characters: the panel renders nothing at all when the bag
   * holds no magic item, rather than reading "0 de 3" on every level one.
   */
  const attunement = useMemo(
    () => attunementStateFor(draft, rulesVersion),
    [draft, rulesVersion],
  );

  /* ---------------- gear ---------------- */

  /**
   * The starting equipment, as questions rather than as lines.
   *
   * Measured: 2024 prints a kit for all 13 of its classes, 2014 for 14 of 18.
   * The four without are the three Tasha's sidekicks and a UA prestige class —
   * none is a class anyone builds a character from.
   */
  const kitRows = useMemo(
    () => startingKitFor(draft.classId, draft.backgroundId, rulesVersion, draft.sourceBooks),
    [draft.classId, draft.backgroundId, rulesVersion, draft.sourceBooks],
  );

  /** Changing class, background or edition is what makes the kit a new kit. */
  const kitSignature = `${draft.classId}|${draft.backgroundId}|${draft.rulesVersion}`;

  /**
   * Granted rows land in the bag once per kit, not on every render.
   *
   * Applying them continuously would put back anything the player deliberately
   * removed, and a builder that argues with someone about their own bag is one
   * they stop trusting. Answers are cleared at the same time: the letters of one
   * class's rows mean nothing under another's.
   */
  useEffect(() => {
    if (draft.kitAppliedFor === kitSignature) return;

    // The old kit comes out before the new one goes in. Only adding is what
    // put a second rogue's kit in the bag the moment a background was picked.
    const previous = parseKitSignature(draft.kitAppliedFor);
    const previousRows = previous
      ? startingKitFor(previous.classId, previous.backgroundId, previous.rulesVersion, draft.sourceBooks)
      : [];
    patchDraft({
      kitChoices: {},
      kitAppliedFor: kitSignature,
      extraEquipmentText: fromLines(
        rekitBag(toLines(draft.extraEquipmentText), previousRows, draft.kitChoices, kitRows),
      ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kitSignature, kitRows]);

  /**
   * Answering a row swaps what it put in the bag.
   *
   * The previous option's items are removed one copy at a time rather than by
   * name, so a handaxe the player added themselves survives changing an answer
   * that also granted a handaxe.
   */
  const answerKitRow = (rowKey: string, optionKey: string) => {
    const row = kitRows.find((entry) => entry.key === rowKey);
    if (!row) return;

    const previous = row.options.find((option) => option.key === draft.kitChoices[rowKey]);
    const next = row.options.find((option) => option.key === optionKey);

    patchDraft({
      kitChoices: { ...draft.kitChoices, [rowKey]: optionKey },
      extraEquipmentText: fromLines(
        swapKitAnswer(toLines(draft.extraEquipmentText), previous, next),
      ),
    });
  };

  const weaponFacts = useMemo(
    () =>
      draft.weaponId
        ? factsFor(draft.weaponId, rulesVersion, draft.sourceBooks[`item:${draft.weaponId}`])
        : null,
    [draft.weaponId, draft.sourceBooks, rulesVersion],
  );

  const armorFacts = useMemo(
    () =>
      draft.armorId
        ? factsFor(draft.armorId, rulesVersion, draft.sourceBooks[`item:${draft.armorId}`])
        : null,
    [draft.armorId, draft.sourceBooks, rulesVersion],
  );

  /*
   * What this character is trained to wear and swing.
   *
   * The same answer the live sheet shows, computed here for a different
   * question: the sheet lists what you have, this chamber has to say what
   * happens when you pick something outside it. A player found the gap by
   * putting a wizard in armour and getting no word about it — in Foundry that
   * is disadvantage on half their rolls and no spells at all.
   */
  const gearProficiencies = useMemo(() => {
    const classEntries = draft.classId ? classesFor(draft) : [];
    if (!classEntries.length) return null;

    return gearProficienciesFor(
      classEntries,
      rulesVersion,
      speciesGrant ? { id: draft.raceId, ...speciesGrant } : null,
      // A feat counts here too, and this is the warning that used to be wrong
      // about it: the wizard who spent a level on Lightly Armored was still
      // being told the leather they just bought would cost them their spells.
      featGearGrantsFor(featIdsFor(draft), rulesVersion),
    );
  }, [draft, rulesVersion, speciesGrant]);

  const weaponWarning = weaponFacts && weaponWarningFor(weaponFacts.row, gearProficiencies);
  const armorWarning = armorFacts && armorWarningFor(armorFacts.row, gearProficiencies);

  const addGear = (entry: CatalogEntry) => {
    if (carried.includes(entry.id)) return;
    patchDraft({
      extraEquipmentText: fromLines([...carried, entry.id]),
      sourceBooks: { ...draft.sourceBooks, [`item:${entry.id}`]: entry.source },
    });
  };

  const removeGear = (id: string) => {
    patchDraft({ extraEquipmentText: fromLines(carried.filter((entry) => entry !== id)) });
  };

  const toggleTalent = (id: string) => {
    const next = draft.optionalFeatureIds.includes(id)
      ? draft.optionalFeatureIds.filter((entry) => entry !== id)
      : [...draft.optionalFeatureIds, id];
    patchDraft({ optionalFeatureIds: next });
  };

  /**
   * Seed the species increase once the species is known.
   *
   * Only when nothing has been assigned yet, so a player who edited the
   * suggestion does not have it overwritten on every render. In 2024 the seed
   * is empty — the edition moved the increase to the background — and the
   * editor simply starts blank.
   */
  useEffect(() => {
    if (!draft.raceId) return;
    if (Object.keys(draft.abilityBonuses).length > 0) return;

    const seed = seedSpeciesBonus(draft, rulesVersion);
    if (Object.keys(seed).length > 0) patchDraft({ abilityBonuses: seed });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.raceId, draft.subraceId, rulesVersion]);

  /**
   * Without Customizing Your Origin the increase is not a choice.
   *
   * So it follows the species instead of the player: changing from a dwarf to
   * an elf moves the +2 with it. Left alone, a switched-off character kept the
   * previous species' spread — the one thing the switch being off is meant to
   * make impossible.
   */
  useEffect(() => {
    if (rulesVersion !== "2014" || draft.customOrigin) return;
    if (Object.keys(printedBonus).length === 0) return;

    const already = ABILITY_IDS.every(
      (ability) => (draft.abilityBonuses[ability] ?? 0) === (printedBonus[ability] ?? 0),
    );
    if (!already) patchDraft({ abilityBonuses: printedBonus });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.customOrigin, rulesVersion, printedBonus]);

  /* ---------------- chambers ---------------- */

  const chambers = useMemo<ChamberKey[]>(
    () => chamberOrder(pace ?? "nuevo", castsAnything),
    [castsAnything, pace],
  );

  /*
   * Never stand in a chamber that is no longer on the list.
   *
   * A player reading Conjuros who changes their mind and picks a fighter drops
   * the spells chamber out from under themselves; without this the page keeps
   * rendering a chamber the rail no longer shows, with `position` pinned at 0.
   */
  useEffect(() => {
    if (!chambers.includes(chamberKey)) setChamberKey(chambers[0]!);
  }, [chambers, chamberKey]);

  const bound = useMemo(() => new Set(scratch.bound as AbilityId[]), [scratch.bound]);

  /** The six as the player made them, before any bonus is added on top. */
  const rawScores = {
    str: draft.str,
    dex: draft.dex,
    con: draft.con,
    int: draft.int,
    wis: draft.wis,
    cha: draft.cha,
  };

  /**
   * Whether every bounded skill offer has been answered.
   *
   * Counted per offer against that offer's own option list, because the class
   * and the background can both be asking at once and a pick that satisfies
   * one does not satisfy the other.
   */
  const offersSatisfied = offersAreSatisfied(profPlan.offers, chosenProficiencies);

  /**
   * Whether a chamber's granted-spell questions are all answered.
   *
   * A lineage nobody chose grants nothing, and a Magic Initiate with no
   * cantrips picked is a feat that did nothing. Neither is an error the export
   * can report — the payload is perfectly valid and simply poorer — so the
   * chamber that asked holds the player until they answer.
   */
  const grantsSettled = (chamber: SpellGrantSource["chamber"]) => {
    const here = spellGrants.filter((source) => source.chamber === chamber);
    if (here.some((source) => source.variants.length > 0 && !draft.spellVariantChoices[source.key])) {
      return false;
    }
    if (
      unansweredAbilities(draft, rulesVersion).some((source) => source.chamber === chamber)
    ) {
      return false;
    }

    return !unansweredSpellChoices(draft, rulesVersion).some(
      (question) => question.chamber === chamber,
    );
  };

  const answered: Record<ChamberKey, boolean> = {
    ancestry: Boolean(draft.raceId) && grantsSettled("species"),
    // The pools moved here with the picker that fills them. A fighting style
    // is a level 1 class feature, so the chamber that owes it is the one that
    // chose the class.
    calling:
      Boolean(draft.classId) &&
      talentsSatisfied(pools, draft.optionalFeatureIds) &&
      grantsSettled("class"),
    // A background that offers several feats owes an answer; one that grants a
    // single one has already been recorded above.
    origin:
      Boolean(draft.backgroundId) &&
      (backgroundFeatIds.length < 2 || Boolean(draft.backgroundFeatId)) &&
      grantsSettled("origin"),
    // Asked of the method the player chose. Point buy binds nothing — its
    // steppers write straight onto the draft — so the old one-question-for-all
    // left the button dead for the whole method.
    attributes: abilitiesSettled({
      method: draft.statMethod,
      scores: rawScores,
      boundCount: bound.size,
    }),
    // Every reached improvement must be answered: an unspent one exports a
    // character weaker than the rules make them. The class's own pools are
    // asked in Clase now, not here.
    growth: growth.unanswered.length === 0 && grantsSettled("growth"),
    gifts: offersSatisfied && languagesSatisfied(langPlan, chosenLanguages) && grantsSettled("gifts"),
    // Optional: an unarmoured wizard is a legal character.
    gear: true,
    spells: true,
    identity: Boolean(draft.characterName.trim()),
  };

  const position = Math.max(chambers.indexOf(chamberKey), 0);
  const isLast = position === chambers.length - 1;

  /** The furthest chamber reached, so the rail can gate what is ahead. */
  const reachable = (index: number) =>
    index <= position || chambers.slice(0, index).every((key) => answered[key]);

  const go = (index: number) => {
    const next = chambers[Math.min(Math.max(index, 0), chambers.length - 1)];
    if (!next) return;
    // The notice belongs to the chamber that caused it; leaving is reading it.
    setShedByPick([]);
    setStokeKey((key) => key + 1);
    // Short, and no longer a curtain: the torch wipe used to cover the swap
    // for 350ms, but a burst of sparks hides nothing. The chamber's own
    // cross-fade carries the change, and this beat only lets the surge start
    // first so the two read as one event rather than as two.
    setTimeout(() => {
      setChamberKey(next);
      /*
       * Back to the top, with the new chamber.
       *
       * The button that moves you is at the bottom, so leaving the scroll
       * where it was dropped every player into the middle of the next
       * chamber — past its heading, past its first question.
       *
       * Instant rather than smooth: the cross-fade above is already carrying
       * the change, and a 500ms scroll racing a 500ms fade reads as two
       * events. It also means nothing to undo when the player has asked for
       * reduced motion.
       */
      window.scrollTo({ top: 0 });
    }, 160);
  };

  /* ---------------- picks ---------------- */

  /*
   * The classes a character is not built from, kept apart from the ones they
   * are.
   *
   * Tasha's three sidekicks - Expert, Spellcaster, Warrior - are simplified
   * companion classes, and a UA prestige class sits with them. In the flat
   * list they read as ordinary classes beside the wizard.
   *
   * What tells them apart is data rather than a list of names written here:
   * every class a character is built from prints starting equipment, and these
   * four are the only ones that do not.
   */
  const sidekickHeading = useCallback(
    (entry: CatalogEntry) =>
      startingEquipmentForClass(entry.id, rulesVersion).length === 0
        ? "Auxiliares y prestigio"
        : undefined,
    [rulesVersion],
  );

  /*
   * Fills the empty appearance boxes with something the species makes likely.
   *
   * A player asked for this and gave the right reason: the species is what
   * guides the visual, and six blank boxes make every character start as the
   * same nobody. Only the empty ones are touched — pressing this must never
   * discard something the player already wrote, and pressing it twice on a
   * half-filled sheet fills the rest rather than rerolling the lot.
   */
  const suggestLooks = () => {
    const suggestion = suggestAppearance(
      draft.raceId,
      draft.subraceId,
      rulesVersion,
      // A Small human and a Medium one are a metre apart, so the suggestion
      // follows the answer rather than the species' first letter.
      sizeFor(draft, rulesVersion),
    );
    if (!suggestion) return;

    const patch: Partial<typeof draft> = {};
    for (const [field, value] of Object.entries(suggestion)) {
      const key = field as keyof Appearance;
      if (value && !draft[key].trim()) patch[key] = value;
    }

    if (Object.keys(patch).length > 0) patchDraft(patch);
  };

  const pick = (
    prop: "race" | "class" | "background" | "subrace" | "subclass" | "weapon" | "armor",
    entry: CatalogEntry,
  ) => {
    const field = {
      race: "raceId",
      class: "classId",
      background: "backgroundId",
      subrace: "subraceId",
      subclass: "subclassId",
      weapon: "weaponId",
      armor: "armorId",
    }[prop];

    // Weapons and armour are both items, so their book is recorded under the
    // prop the resolver will use to look them up.
    const bookProp = prop === "weapon" || prop === "armor" ? "item" : prop;
    const current = draft[field as keyof typeof draft];

    // Changing species or class releases what belonged to the old one; see
    // `releasedByPick` for why keeping it would export a wrong character.
    const released =
      prop === "race" || prop === "class" || prop === "background"
        ? releasedByPick(prop, draft)
        : { patch: {}, shed: [] };

    const value = current === entry.id ? "" : entry.id;
    // A subclass widens the spell list — a patron's, a domain's — and its
    // spells leave with it.
    const strays =
      prop === "subclass" ? releaseStraySpells({ ...draft, subclassId: value }) : { patch: {}, shed: [] };

    setShedByPick([...released.shed, ...strays.shed]);

    patchDraft({
      // Picking the same entry twice clears it, which is the only way to
      // un-choose an optional pick once one is set.
      [field]: value,
      sourceBooks: { ...draft.sourceBooks, [`${bookProp}:${entry.id}`]: entry.source },
      ...released.patch,
      ...strays.patch,
    } as Parameters<typeof patchDraft>[0]);
  };

  const setLevel = (level: number) => {
    const stillEntitled = level >= (levellingFor(draft.classId, rulesVersion).subclassLevel ?? 3);

    // Improvements recorded above the new level are dropped. `bonusesFromChoices`
    // sums the whole map without consulting the level, so a character reforged
    // down from 8 to 4 would keep the points they earned at 6 and 8 — the sheet
    // would show scores the rules never granted, and the Growth chamber would
    // report nothing pending because those levels are answered.
    // Only the first class's own keys are levels of this class. Another
    // class's answers (`wizard:4`) belong to that class's level, not this one.
    const levelChoices = Object.fromEntries(
      Object.entries(draft.levelChoices).filter(([at]) => at.includes(":") || Number(at) <= level),
    );

    const patch = {
      level,
      levelChoices,
      ...(stillEntitled ? {} : { subclassId: "" }),
    };
    const released = releaseStraySpells({ ...draft, ...patch });
    if (released.shed.length) setShedByPick(released.shed);

    patchDraft({ ...patch, ...released.patch });
  };

  const toggleProficiency = (value: string) => {
    const next = chosenProficiencies.includes(value)
      ? chosenProficiencies.filter((entry) => entry !== value)
      : [...chosenProficiencies, value];
    patchDraft({ proficienciesText: fromLines([...granted, ...next]) });
  };

  const toggleLanguage = (value: string) => {
    const next = chosenLanguages.includes(value)
      ? chosenLanguages.filter((entry) => entry !== value)
      : [...chosenLanguages, value];
    patchDraft({ languagesText: fromLines([...langPlan.fixed, ...next]) });
  };

  const toggleCantrip = (value: string) => {
    const next = chosenCantrips.includes(value)
      ? chosenCantrips.filter((entry) => entry !== value)
      : [...chosenCantrips, value];
    patchDraft({ cantripsText: fromLines(next) });
  };

  const toggleSpell = (line: string) => {
    const next = chosenSpells.includes(line)
      ? chosenSpells.filter((entry) => entry !== line)
      : [...chosenSpells, line];
    patchDraft({ spellsText: fromLines(next) });
  };

  /**
   * Erasing a spell from the book unprepares it too.
   *
   * A wizard cannot prepare what is not written down, so leaving the prepared
   * list alone would leave a spell selected that the picker no longer offers —
   * invisible on the page and still in the export.
   */
  const toggleBookSpell = (line: string) => {
    if (!chosenBook.includes(line)) {
      patchDraft({ spellbookText: fromLines([...chosenBook, line]) });
      return;
    }

    patchDraft({
      spellbookText: fromLines(chosenBook.filter((entry) => entry !== line)),
      spellsText: fromLines(chosenSpells.filter((entry) => entry !== line)),
    });
  };

  /* ---------------- multiclass ---------------- */

  const addClass = () => {
    patchDraft({ extraClasses: [...draft.extraClasses, emptyExtraClass()] });
  };

  const changeClass = (index: number, next: ExtraClass) => {
    const extraClasses = draft.extraClasses.map((extra, at) => (at === index ? next : extra));
    const released = releaseStraySpells({ ...draft, extraClasses });
    if (released.shed.length) setShedByPick(released.shed);

    patchDraft({ extraClasses, ...released.patch });
  };

  /**
   * One pick on one grant.
   *
   * A pick already taken is dropped rather than re-added, so the same button
   * both chooses and unchooses. Changing which set the grant is spent on
   * clears the picks with it: the 2014 rogue's two-skill answer is not half of
   * its one-skill-and-tools answer.
   */
  const answerExpertise = (
    key: string,
    setIndex: number,
    of: "skills" | "tools",
    id: string,
  ) => {
    const current = draft.expertiseChoices[key] ?? { setIndex, skills: [], tools: [] };
    const base =
      current.setIndex === setIndex ? current : { setIndex, skills: [], tools: [] };

    const picked = base[of];
    const next = id
      ? picked.includes(id)
        ? picked.filter((entry) => entry !== id)
        : [...picked, id]
      : picked;

    patchDraft({
      expertiseChoices: { ...draft.expertiseChoices, [key]: { ...base, [of]: next } },
    });
  };

  const toggleMastery = (id: string) => {
    const chosen = draft.weaponMasteryIds.includes(id)
      ? draft.weaponMasteryIds.filter((entry) => entry !== id)
      : [...draft.weaponMasteryIds, id];
    patchDraft({ weaponMasteryIds: chosen });
  };

  /** Attuning to a fourth is allowed and named, not refused. */
  const toggleAttunement = (id: string) => {
    const attuned = draft.attunedItemIds.includes(id)
      ? draft.attunedItemIds.filter((entry) => entry !== id)
      : [...draft.attunedItemIds, id];
    patchDraft({ attunedItemIds: attuned });
  };

  const removeClass = (index: number) => {
    const extraClasses = draft.extraClasses.filter((_, at) => at !== index);
    const released = releaseStraySpells({ ...draft, extraClasses });
    if (released.shed.length) setShedByPick(released.shed);

    patchDraft({ extraClasses, ...released.patch });
  };

  /**
   * What the player rolled for one level.
   *
   * Null clears it, and clearing is not the same as writing a zero: a level
   * with no roll takes the average, which is what a level nobody has rolled
   * yet honestly is. So the entry is removed rather than stored as a number.
   */
  const setHitPointRoll = (level: number, roll: number | null) => {
    const hpRolls = { ...draft.hpRolls };
    if (roll === null) delete hpRolls[String(level)];
    else hpRolls[String(level)] = roll;

    patchDraft({ hpRolls });
  };

  const setLevelChoice = (key: string, choice: (typeof draft.levelChoices)[string]) => {
    patchDraft({ levelChoices: { ...draft.levelChoices, [key]: choice } });
  };

  const setFeatAbilities = (featId: string, bonuses: Record<string, number>) => {
    patchDraft({ featAbilityChoices: { ...draft.featAbilityChoices, [featId]: bonuses } });
  };

  /* ---------------- dice ---------------- */

  /** Every ability back to unbound, and nothing loose. */
  const clearScores = () =>
    patchDraft({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 });

  /*
   * Switching method clears what the last one produced, and keeps the dice.
   *
   * Carrying a rolled 17 into point buy would show a spread that point buy
   * cannot sell, with a budget it never paid — the numbers on screen would
   * stop meaning what the panel says they mean. So the pool and the bindings
   * go.
   *
   * The throws do not. `sets` is the record of what the dice actually did, and
   * a player looking at the point buy panel to compare it against their roll
   * came back to find the roll gone — three throws they cannot make again,
   * destroyed by reading another screen. Rolling is the one method whose
   * result cannot be reproduced, which is exactly why it is the one worth
   * keeping through a look elsewhere.
   */
  function chooseStatMethod(method: StatMethodId) {
    if (method === draft.statMethod) return;

    patchDraft({ statMethod: method });
    // The array is a pool like any other: six numbers, assigned freely.
    setScratch(scratchForMethod(method, scratch.sets));

    if (method === "pointbuy") {
      patchDraft(pointBuyFloor());
      return;
    }
    clearScores();
  }

  /** One throw. Kept alongside the others until the player picks. */
  const handleRoll = (rolled: number[]) => {
    setScratch({
      pool: [],
      bound: [],
      sets: [...scratch.sets, rolled].slice(-ROLL_ATTEMPTS),
    });
    clearScores();
    patchDraft({ statMethod: "roll" });
  };

  /** The set the player kept becomes the pool; the rest are forgotten. */
  const keepSet = (index: number) => {
    const chosen = scratch.sets[index];
    if (!chosen) return;
    setScratch({ pool: [...chosen], bound: [], sets: scratch.sets });
    clearScores();
  };

  const bindScore = (ability: AbilityId, value: number) => {
    const index = scratch.pool.indexOf(value);
    if (index < 0) return;

    const pool = [...scratch.pool];
    pool.splice(index, 1);
    setScratch({ ...scratch, pool, bound: [...scratch.bound, ability] });
    patchDraft({ [ability]: value } as Parameters<typeof patchDraft>[0]);
  };

  const releaseScore = (ability: AbilityId) => {
    if (!bound.has(ability)) return;
    setScratch({
      ...scratch,
      pool: [...scratch.pool, draft[ability]],
      bound: scratch.bound.filter((entry) => entry !== ability),
    });
    patchDraft({ [ability]: 10 } as Parameters<typeof patchDraft>[0]);
  };

  const sealCharacter = () => {
    if (seal()) navigate("/codex");
  };

  /** Answer the opening question and start at the top of the chosen order. */
  const choosePace = (chosen: Pace) => {
    setPace(chosen);
    setChamberKey(firstChamber(chosen));
  };

  /*
   * The one question asked before the Forge opens.
   *
   * Asked once ever, not once per character, and answerable again from the
   * rail — a wrong tap here should not decide the order of every character
   * this player ever builds.
   */
  if (pace === null) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-void px-6">
        <GrainOverlay />
        <LightfallBackdrop variant="page" fallbackDensity={22} />
        <div className="relative z-10 w-full max-w-2xl">
          <p className="font-mono text-[13px] uppercase tracking-[0.1em] text-gold">
            Antes de encender la fragua
          </p>
          <h1 className="mt-5 font-display text-3xl font-black tracking-wide text-bone md:text-4xl">
            ¿Cuantos personajes armaste?
          </h1>
          <p className="mt-4 font-body leading-relaxed text-bone">
            Podes cambiarlo cuando quieras.
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {(
              [
                {
                  id: "nuevo",
                  label: "Es de mis primeros",
                  blurb:
                    "Empezamos por la raza y el camino: lo que podes imaginarte. Los numeros vienen despues, cuando ya sabes quien es.",
                },
                {
                  id: "veterano",
                  label: "Ya perdi la cuenta",
                  blurb:
                    "Empezamos por las aptitudes. El reparto primero, y despues las elecciones que se juzgan contra el.",
                },
              ] as Array<{ id: Pace; label: string; blurb: string }>
            ).map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => choosePace(option.id)}
                className="group border border-iron/60 bg-void/40 p-6 text-left transition-colors hover:border-gold/60"
              >
                <span className="font-display text-lg font-bold text-bone transition-colors group-hover:text-gold">
                  {option.label}
                </span>
                <span className="mt-3 block font-body text-[15px] leading-relaxed text-bone">
                  {option.blurb}
                </span>
              </button>
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <InfoProvider edition={rulesVersion}>
    <main className={PAGE}>
      <GrainOverlay />
      <LightfallBackdrop variant="page" fallbackDensity={36} />
      <StokeEmbers trigger={stokeKey} />

      <ChamberArrows
        onBack={() => go(position - 1)}
        onNext={() => go(position + 1)}
        canGoBack={position > 0}
        canGoNext={!isLast && answered[chamberKey]}
        accent={accent}
      />

      <div className="relative z-10 mx-auto max-w-6xl px-6 py-14 md:px-10">
        <header className="mb-12 flex items-end justify-between gap-6">
          <div>
            <p className="font-mono text-[13px] tracking-[0.1em] uppercase text-gold">
              Camara {position + 1} de {chambers.length}
            </p>
            <h1 className="mt-3 font-display text-4xl font-black tracking-wide text-bone md:text-5xl">
              LA FRAGUA
            </h1>
            {editingId && (
              // Said plainly: sealing again replaces the tome instead of adding
              // one, and that is not something to discover after the fact.
              <p className="mt-3 font-body text-[15px] text-bone">
                Reforjando a{" "}
                <span className="not-italic" style={{ color: accent }}>
                  {draft.characterName || "un tomo sin nombre"}
                </span>
                . Al sellar se reescribe su tomo.
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="font-mono text-[13px] uppercase tracking-[0.1em] text-bone">
              {rulesVersion === "2024" ? "Reglas 2024" : "Reglas 2014"}
            </p>
            {/*
              The way out of the opening question.
              It decides the order of every chamber, so it cannot be a choice
              made once by accident and never revisited.
            */}
            <button
              type="button"
              onClick={() => setPace(null)}
              className="mt-2 font-mono text-[13px] uppercase tracking-[0.1em] text-bone transition-colors hover:text-gold"
            >
              {pace === "veterano" ? "Aptitudes primero" : "Raza primero"} · cambiar
            </button>
          </div>
        </header>

        {/* progress rail */}
        <nav className="mb-14 flex flex-wrap items-center gap-y-4">
          {chambers.map((key, index) => (
            <div key={key} className="flex flex-1 items-center last:flex-none">
              <button
                onClick={() => reachable(index) && go(index)}
                disabled={!reachable(index)}
                className="group flex w-full flex-col items-start"
                // The rail's own text is a tick and a label inside two spans;
                // read aloud it is a row of unnamed buttons. Named here so the
                // nav is usable without seeing it.
                aria-label={`Camara: ${CHAMBER_LABEL[key]}`}
                data-chamber={key}
              >
                <span
                  className={`h-px w-full transition-all duration-500 ${
                    index <= position ? "bg-gold" : "bg-iron"
                  }`}
                />
                <span
                  className={`mt-3 whitespace-nowrap font-mono text-[13px] uppercase tracking-[0.1em] transition-colors ${
                    index === position
                      ? "text-gold"
                      : answered[key]
                        ? "text-bone"
                        : "text-bone"
                  }`}
                >
                  {answered[key] && index !== position ? "✓ " : ""}
                  {CHAMBER_LABEL[key]}
                </span>
              </button>
              {index < chambers.length - 1 && <span className="mx-3 h-px flex-1 bg-iron/50" />}
            </div>
          ))}
        </nav>

        {/* La ficha se ensancha en `xl` para poder ir en dos columnas. Debajo
            de ese ancho la camara no puede ceder 460px sin que la estanteria
            de tarjetas quede en una sola, asi que se queda en 340 y la ficha
            en una columna. */}
        <div className="grid gap-12 lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_460px]">
          <AnimatePresence mode="wait">
            <motion.section
              key={chamberKey}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <h2 className="mb-2 font-display text-2xl font-bold" style={{ color: accent }}>
                {CHAMBER_TITLE[chamberKey]}
              </h2>
              {CHAMBER_EPIGRAPH[chamberKey] ? (
                <p className="mb-8 font-body text-bone">
                  {CHAMBER_EPIGRAPH[chamberKey]}
                </p>
              ) : (
                <div className="mb-8" />
              )}

              {/* What the last pick released. Keeping it would export a
                  character carrying another species' or class's choices. */}
              {shedByPick.length > 0 &&
                (chamberKey === "ancestry" ||
                  chamberKey === "calling" ||
                  chamberKey === "origin") && (
                  <motion.p
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8 border-l-2 border-ember/60 pl-4 font-body text-[15px] leading-relaxed text-bone"
                  >
                    Al cambiar {SHED_SUBJECT[chamberKey]} se solto {shedByPick.join(" y ")}. Eleg
                    {shedByPick.length > 1 ? "ilos" : "ilo"} de nuevo mas adelante.
                  </motion.p>
                )}

              {/* ---------- Ancestry ---------- */}
              {chamberKey === "ancestry" && (
                <div className="space-y-10">
                  <SigilShelf
                    entries={allRaces}
                    selectedId={draft.raceId}
                    selectedSource={draft.sourceBooks[`race:${draft.raceId}`]}
                    onPick={(entry) => pick("race", entry)}
                    accent={VAULT_GOLD}
                    infoKind="race"
                    label="Buscar raza"
                    placeholder="Buscar entre todas las razas…"
                    // The book is what tells two same-named species apart, and
                    // a build stores it, so it belongs on the card.
                    noteFor={(entry) => entry.source}
                  />

                  <VariantChoices
                    sources={spellGrants.filter((source) => source.chamber === "species")}
                    chosen={draft.spellVariantChoices}
                    chosenAbilities={draft.spellAbilityChoices}
                    questions={spellChoices}
                    answers={draft.grantedSpellChoices}
                    onToggleSpell={toggleGrantedSpell}
                    accent={VAULT_GOLD}
                    onPick={chooseVariant}
                    onPickAbility={chooseSpellAbility}
                  />

                  {/* Only 2014 has these; 2024 folded them into the species. */}
                  {subraces.length > 0 && (
                    <SubChoice
                      title="Rama"
                      hint={
                        branchIsRequired
                          ? `${selectedRace?.label} se divide en ${subraces.length}. Sin elegir una no hay bono de caracteristica ni idioma de especie — no es opcional.`
                          : `${selectedRace?.label} se divide en ${subraces.length}. Opcional.`
                      }
                      options={subraces}
                      selectedId={draft.subraceId}
                      onPick={(entry) => pick("subrace", entry)}
                      accent={VAULT_GOLD}
                      note="La subraza queda guardada, pero todavia no cruza a Foundry."
                    />
                  )}

                  {/* Thirty species offer two sizes and the books hand the
                      choice to the player. Until this existed the first letter
                      won, and every one of them exported as Small.

                      Below the branch because the offer is read off the merged
                      row: no subrace states a size today, and the day one does
                      the question has to be asked about the merged species. */}
                  {sizeOptions.length > 1 && (
                    <SizeChoice
                      options={sizeOptions}
                      value={draft.sizeChoice}
                      accent={VAULT_GOLD}
                      onPick={(letter) => patchDraft({ sizeChoice: letter })}
                    />
                  )}
                </div>
              )}

              {/* ---------- Calling ---------- */}
              {chamberKey === "calling" && (
                <div className="space-y-10">
                  <SigilShelf
                    entries={allClasses}
                    selectedId={draft.classId}
                    selectedSource={draft.sourceBooks[`class:${draft.classId}`]}
                    groupFor={sidekickHeading}
                    onPick={(entry) => pick("class", entry)}
                    accent={accent}
                    infoKind="class"
                    label="Buscar clase"
                    placeholder="Buscar entre todas las clases…"
                    noteFor={(entry) => {
                      const die = hitDieFor(entry.id, rulesVersion);
                      // The die is the shortest true thing that separates one
                      // class from another before you have read either.
                      return die ? `d${die} · ${entry.source}` : entry.source;
                    }}
                  />

                  {draft.classId && (
                    <div className={DIVIDER}>
                      <label className="mb-4 block font-mono text-[13px] tracking-[0.1em] uppercase text-bone">
                        Nivel de poder — <span style={{ color: accent }}>{draft.level}</span>
                      </label>
                      <input
                        type="range"
                        min={1}
                        // Twenty levels between every class. Letting this reach
                        // 20 with levels already spent elsewhere would show a
                        // level the sheet then silently clamps back down.
                        max={primaryLevelCeiling}
                        value={draft.level}
                        onChange={(event) => setLevel(Number(event.target.value))}
                        className="w-full accent-gold"
                        aria-label="Nivel"
                      />
                    </div>
                  )}

                  {draft.classId &&
                    (subclassUnlocked ? (
                      subclasses.length > 0 && (
                        <SubChoice
                          infoClass={selectedClass?.label ?? ""}
                          title="Senda"
                          hint={`${selectedClass?.label} elige a nivel ${subclassLevel}. ${subclasses.length} disponibles.`}
                          options={subclasses}
                          selectedId={draft.subclassId}
                          onPick={(entry) => pick("subclass", entry)}
                          accent={accent}
                        />
                      )
                    ) : (
                      <div className={DIVIDER_TIGHT}>
                        <p className="font-mono text-[13px] uppercase tracking-[0.1em] text-bone">
                          Senda
                        </p>
                        <p className="mt-3 font-body text-bone">
                          {selectedClass?.label} no elige senda hasta el nivel {subclassLevel}.
                        </p>
                      </div>
                    ))}

                  <VariantChoices
                    sources={spellGrants.filter((source) => source.chamber === "class")}
                    chosen={draft.spellVariantChoices}
                    chosenAbilities={draft.spellAbilityChoices}
                    questions={spellChoices}
                    answers={draft.grantedSpellChoices}
                    onToggleSpell={toggleGrantedSpell}
                    accent={accent}
                    onPick={chooseVariant}
                    onPickAbility={chooseSpellAbility}
                  />

                  {/*
                    A fighting style is a level 1 class feature, and it used to
                    be asked in Mejoras — the chamber a player opens at level 4
                    to spend an improvement. So the builder answered a question
                    about the level they had just reached with a question about
                    the level they started at, and refused to move on until
                    they settled it. Players read that as a bug in the
                    improvement, which is a fair reading of where it appeared.

                    It belongs with the rest of what the class hands over:
                    after the subclass and its variants, before the hit points.
                  */}
                  {pools.length > 0 && (
                    <div className={DIVIDER}>
                      <p className="mb-6 font-body text-[15px] leading-relaxed text-bone">
                        Lo que {selectedClass?.label} te deja elegir a nivel {draft.level}.
                      </p>
                      <TalentPools
                        pools={pools}
                        chosen={draft.optionalFeatureIds}
                        accent={accent}
                        onToggle={toggleTalent}
                      />
                    </div>
                  )}

                  {draft.classId && (
                    <HitPoints
                      method={draft.hpMethod}
                      levels={hitPointLevels}
                      firstDie={firstHitDie}
                      constitutionModifier={Math.floor((snapshot?.abilities.final.con ?? 10) / 2) - 5}
                      classLabel={(id) => allClasses.find((entry) => entry.id === id)?.label ?? id}
                      accent={accent}
                      onPickMethod={(hpMethod) => patchDraft({ hpMethod })}
                      onRoll={setHitPointRoll}
                    />
                  )}

                  {draft.classId && (
                    <Multiclass
                      extras={draft.extraClasses}
                      classes={allClasses}
                      primaryClassId={draft.classId}
                      primaryLevel={draft.level}
                      rulesVersion={rulesVersion}
                      accent={accent}
                      problems={multiclassProblems}
                      onChange={changeClass}
                      onRemove={removeClass}
                      onAdd={addClass}
                    />
                  )}
                </div>
              )}

              {/* ---------- Origin ---------- */}
              {chamberKey === "origin" && (
                <div className="space-y-10">
                  <SigilShelf
                    entries={allBackgrounds}
                    selectedId={draft.backgroundId}
                    selectedSource={draft.sourceBooks[`background:${draft.backgroundId}`]}
                    onPick={(entry) => pick("background", entry)}
                    accent={accent}
                    infoKind="background"
                    label="Buscar trasfondo"
                    placeholder="Buscar entre todos los trasfondos…"
                    noteFor={(entry) => entry.source}
                  />

                  {/* What it hands you. Everything on this panel is read off
                      the index; the prose that 5etools prints alongside is not
                      in there at all. See BackgroundGrant.tsx. */}
                  {selectedBackground && (
                    <div className={DIVIDER}>
                      <p className="font-display text-lg font-bold" style={{ color: accent }}>
                        {selectedBackground.label}
                        <span className="ml-3 font-mono text-[13px] font-normal uppercase tracking-[0.1em] text-bone">
                          {selectedBackground.source}
                        </span>
                      </p>
                      <div className="mt-5">
                        <BackgroundGrant
                          backgroundId={draft.backgroundId}
                          rulesVersion={rulesVersion}
                          sourceBook={draft.sourceBooks[`background:${draft.backgroundId}`]}
                          accent={accent}
                          featId={draft.backgroundFeatId}
                          onPickFeat={(backgroundFeatId) => patchDraft({ backgroundFeatId })}
                        />
                      </div>
                    </div>
                  )}
                  <VariantChoices
                    sources={spellGrants.filter((source) => source.chamber === "origin")}
                    chosen={draft.spellVariantChoices}
                    chosenAbilities={draft.spellAbilityChoices}
                    questions={spellChoices}
                    answers={draft.grantedSpellChoices}
                    onToggleSpell={toggleGrantedSpell}
                    accent={accent}
                    onPick={chooseVariant}
                    onPickAbility={chooseSpellAbility}
                  />

                </div>
              )}

              {/* ---------- Attributes ---------- */}
              {chamberKey === "attributes" && (
                <div className="space-y-10">
                  {/* Which way the six numbers get made. All four already
                      existed in the model and mapped to the payload; only
                      rolling was ever wired to a screen. */}
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {STAT_METHODS.map((method) => {
                      const active = draft.statMethod === method.id;
                      return (
                        <button
                          key={method.id}
                          onClick={() => chooseStatMethod(method.id)}
                          className="border p-4 text-left transition-colors"
                          style={{
                            borderColor: active ? `${accent}88` : "rgba(74,70,64,0.4)",
                            background: active ? `${accent}0f` : "transparent",
                          }}
                        >
                          <p
                            className={HEADING}
                            style={{ color: active ? accent : "#FFFFFF" }}
                          >
                            {method.label}
                          </p>
                          <p className="mt-1 font-body text-[15px] leading-snug text-bone">
                            {method.blurb}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  {draft.statMethod === "pointbuy" || draft.statMethod === "manual" ? (
                    <PointBuy
                      mode={draft.statMethod === "manual" ? "manual" : "pointbuy"}
                      scores={rawScores}
                      bonuses={draft.abilityBonuses}
                      accent={accent}
                      onChange={(ability, score) =>
                        patchDraft({ [ability]: score } as Parameters<typeof patchDraft>[0])
                      }
                    />
                  ) : (
                    <>
                      {/* Three throws, and the player keeps one. The sum of
                          modifiers is shown because it is the one number that
                          compares two spreads without reading six. */}
                      {draft.statMethod === "roll" && (
                        <DiceTray
                          onRoll={handleRoll}
                          sets={scratch.sets}
                          onKeep={keepSet}
                          accent={accent}
                        />
                      )}

                      <StatRune
                        pool={scratch.pool}
                        bound={bound}
                        scores={rawScores}
                        accent={accent}
                        onBind={bindScore}
                        onRelease={releaseScore}
                      />
                    </>
                  )}
                </div>
              )}

              {/* ---------- Growth ---------- */}
              {chamberKey === "growth" && (
                <div className="space-y-12">
                  <div>
                    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-3">
                      <span className={LABEL}>
                        Aumento de {bonusOrigin(rulesVersion)}
                      </span>
                      <span className={WHISPER}>
                        {rulesVersion === "2024"
                          ? "En 2024 el aumento lo da el trasfondo: repartilo vos."
                          : "Sembrado desde el indice. Podes cambiarlo."}
                      </span>
                    </div>
                    <p className="mb-3 font-body text-[15px] leading-relaxed text-bone">
                      Se suma a los puntajes ligados. Sin esto un enano exporta sin su +2 a
                      Constitucion.
                    </p>

                    {/*
                      2014 hands out blocks and Tasha's moves them whole; 2024
                      moved the increase to the background, where it really is
                      a small budget the player spends. Two rules, two editors —
                      one editor for both was what let a gnome be +1/+1/+1.
                    */}
                    {rulesVersion === "2014" ? (
                      <OriginBonus
                        printed={printedBonus}
                        bonuses={draft.abilityBonuses}
                        custom={draft.customOrigin}
                        accent={accent}
                        onToggleCustom={(customOrigin) =>
                          patchDraft({
                            customOrigin,
                            // Turning it off puts the increase back where the
                            // book prints it, which is the whole meaning of
                            // turning it off.
                            ...(customOrigin ? {} : { abilityBonuses: printedBonus }),
                          })
                        }
                        onChange={(abilityBonuses) => patchDraft({ abilityBonuses })}
                      />
                    ) : (
                      <BonusEditor
                        bonuses={draft.abilityBonuses}
                        scoresBefore={{
                          str: draft.str,
                          dex: draft.dex,
                          con: draft.con,
                          int: draft.int,
                          wis: draft.wis,
                          cha: draft.cha,
                        }}
                        budget={speciesBudget}
                        maxPerAbility={maxPointsPerAbility}
                        allowed={originAllowance}
                        accent={accent}
                        onChange={(abilityBonuses) => patchDraft({ abilityBonuses })}
                      />
                    )}
                  </div>

                  <Improvements
                    state={draft}
                    slots={growth.slots}
                    rulesVersion={rulesVersion}
                    accent={accent}
                    onSetChoice={setLevelChoice}
                    onSetFeatAbilities={setFeatAbilities}
                  />
                  <VariantChoices
                    sources={spellGrants.filter((source) => source.chamber === "growth")}
                    chosen={draft.spellVariantChoices}
                    chosenAbilities={draft.spellAbilityChoices}
                    questions={spellChoices}
                    answers={draft.grantedSpellChoices}
                    onToggleSpell={toggleGrantedSpell}
                    accent={accent}
                    onPick={chooseVariant}
                    onPickAbility={chooseSpellAbility}
                  />

                </div>
              )}

              {/* ---------- Gifts ---------- */}
              {chamberKey === "gifts" && (
                <div className="space-y-10">
                  {/*
                    * Who gave it, and not one heap.
                    *
                    * The species and the background both hand things over, and
                    * they are not interchangeable: a player checking whether
                    * they wrote their elf's Perception down needs to see it
                    * under the elf. Naming the background over a species grant
                    * was worse than saying nothing.
                    */}
                  {speciesGranted.length > 0 && (
                    <div>
                      <p className={LABEL_MB4}>
                        Otorgado por {selectedRace?.label ?? "la especie"}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {speciesGranted.map((entry) => (
                          <span
                            key={entry}
                            className="border px-3 py-1.5 font-body text-[15px]"
                            style={{ borderColor: `${accent}55`, color: accent }}
                          >
                            {entry}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {otherGranted.length > 0 && (
                    <div>
                      <p className={LABEL_MB4}>
                        Otorgado por {selectedBackground?.label ?? "el trasfondo"}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {otherGranted.map((entry) => (
                          <span
                            key={entry}
                            className="border px-3 py-1.5 font-body text-[15px]"
                            style={{ borderColor: `${accent}55`, color: accent }}
                          >
                            {entry}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {profPlan.offers.map((offer, index) =>
                    /*
                     * An offer the data states as a kind — "any artisan's
                     * tools", "any musical instrument" — has no list to pick
                     * from, and inventing one would be inventing a rule. It is
                     * said instead, next to the field the player writes in.
                     */
                    offer.scope ? (
                      <div key={`${offer.from}-${index}`}>
                        <p className={LABEL_MB2}>Herramientas — {offer.label ?? offer.from}</p>
                        <p className="font-body text-bone">
                          {/* Named rather than assumed: this used to say "tu
                              especie" for every one of them, and feats offer
                              these too. */}
                          {offer.label ?? `Tu ${offer.from}`} te da {offer.count}{" "}
                          {offer.scope === "artisan"
                            ? offer.count === 1
                              ? "herramienta de artesano"
                              : "herramientas de artesano"
                            : offer.count === 1
                              ? "instrumento musical"
                              : "instrumentos musicales"}{" "}
                          a eleccion. Escribi cual abajo.
                        </p>
                      </div>
                    ) : (
                      <PickList
                        infoKind={offer.kind === "tool" ? "item" : "skill"}
                        key={`${offer.from}-${index}`}
                        title={`${offer.kind === "tool" ? "Herramientas" : "Competencias"} — ${offer.label ?? offer.from}`}
                        hint={
                          offer.note ??
                          (offer.isOpen
                            ? "Cualquier habilidad."
                            : `Elegi ${offer.count} de esta lista.`)
                        }
                        options={offer.options}
                        // Only what this offer paid for. Handed the whole list,
                        // each picker counted the other's picks against its own
                        // limit and locked itself before a single choice was
                        // made in it.
                        selected={offerPicks[index] ?? []}
                        // Already proficient, from the background or from
                        // another offer: shown as had, never as choosable twice.
                        locked={[
                          ...granted,
                          ...chosenProficiencies.filter(
                            (entry) => !(offerPicks[index] ?? []).includes(entry),
                          ),
                        ]}
                        limit={offer.count}
                        accent={accent}
                        onToggle={toggleProficiency}
                      />
                    ),
                  )}

                  {profPlan.offers.length === 0 && (
                    <p className={WHISPER}>
                      Ni la clase, ni el trasfondo, ni la especie, ni tus dotes ofrecen nada a
                      elección.
                    </p>
                  )}

                  {/* After the skills, not before: you double what you have
                      already picked, so asking first would offer an empty pool. */}
                  {expertisePlan.slots.length > 0 && (
                    <div className={DIVIDER}>
                      <Expertise
                        slots={expertisePlan.slots}
                        proficientSkills={expertisePlan.proficientSkills}
                        proficientTools={expertisePlan.proficientTools}
                        accent={accent}
                        onAnswer={answerExpertise}
                      />
                    </div>
                  )}

                  <div className={DIVIDER}>
                    <p className={LABEL_MB4}>
                      Idiomas
                    </p>
                    <div className="mb-5 flex flex-wrap gap-2">
                      {langPlan.fixed.map((entry) => (
                        <span
                          key={entry}
                          className="border px-3 py-1.5 font-body text-[15px]"
                          style={{ borderColor: `${accent}55`, color: accent }}
                        >
                          {entry}
                        </span>
                      ))}
                    </div>

                    {langPlan.offers.map((offer, index) => (
                      <div key={`${offer.from}-${index}`} className="mb-6">
                        {offer.options.length > 0 && (
                          <PickList
                            infoKind="language"
                            title={
                              offer.from === "especie"
                                ? "Idiomas de tu especie"
                                : "Idiomas de tu trasfondo"
                            }
                            hint={`Elegi ${offer.count} de esta lista.`}
                            options={offer.options}
                            // Only what this offer paid for. Handed the whole
                            // list, each picker counted the other's picks
                            // against its own limit and locked itself before a
                            // single choice was made in it.
                            selected={languagePicks[index] ?? []}
                            locked={[
                              ...langPlan.fixed,
                              ...chosenLanguages.filter(
                                (entry) => !(languagePicks[index] ?? []).includes(entry),
                              ),
                            ]}
                            limit={offer.count}
                            accent={accent}
                            onToggle={toggleLanguage}
                          />
                        )}

                        {/*
                          The slot the book refuses to turn into a list: "any
                          language that you and your DM agree is appropriate".
                          Offering the standard eight for it would be inventing
                          a rule, so it is written by hand.
                        */}
                        {offer.isOpen && (
                          <div className={offer.options.length > 0 ? "mt-4" : ""}>
                            <p className={LABEL_MB2}>
                              {offer.options.length > 0
                                ? "O uno que acuerdes con tu DM"
                                : offer.count === 1
                                  ? "Un idioma a convenir con tu DM"
                                  : `${offer.count} idiomas a convenir con tu DM`}
                            </p>
                            <p className={WHISPER_MB4}>
                              {offer.from === "especie" ? "Tu especie" : "Tu trasfondo"} no dice
                              cual. Escribilo.
                            </p>
                            <div className="mb-3 flex flex-wrap gap-2">
                              {(languagePicks[index] ?? [])
                                .filter((entry) => !offer.options.includes(entry))
                                .map((entry) => (
                                  <button
                                    key={entry}
                                    type="button"
                                    onClick={() => toggleLanguage(entry)}
                                    className="border px-3 py-1.5 font-body text-[15px]"
                                    style={{ borderColor: `${accent}55`, color: accent }}
                                  >
                                    {entry} ×
                                  </button>
                                ))}
                            </div>
                            <input
                              type="text"
                              placeholder="Escribilo y presiona Enter"
                              onKeyDown={(event) => {
                                if (event.key !== "Enter") return;
                                event.preventDefault();
                                writeLanguage(event.currentTarget.value);
                                event.currentTarget.value = "";
                              }}
                              className="w-full border bg-transparent px-3 py-2 font-body text-[15px] text-bone outline-none"
                              style={{ borderColor: `${accent}33` }}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <VariantChoices
                    sources={spellGrants.filter((source) => source.chamber === "gifts")}
                    chosen={draft.spellVariantChoices}
                    chosenAbilities={draft.spellAbilityChoices}
                    questions={spellChoices}
                    answers={draft.grantedSpellChoices}
                    onToggleSpell={toggleGrantedSpell}
                    accent={accent}
                    onPick={chooseVariant}
                    onPickAbility={chooseSpellAbility}
                  />

                </div>
              )}

              {/* ---------- Gear ---------- */}
              {chamberKey === "gear" && (
                <div className="max-w-xl space-y-10">
                  {/*
                    What the class hands you at level 1.
                    Printed in the class entry and, until now, nowhere in this
                    front: a fighter arrived at this chamber with three empty
                    search boxes and no idea that the book already gave them
                    chain mail, a martial weapon and a shield.
                  */}
                  <StartingKit
                    rows={kitRows}
                    choices={draft.kitChoices}
                    accent={accent}
                    onAnswer={answerKitRow}
                  />

                  <div className={kitRows.length > 0 ? DIVIDER : ""}>
                    <p className={LABEL_MB4}>
                      Arma
                    </p>
                    <RarityScry
                      infoKind="item"
                      label="Buscar arma"
                      placeholder="Buscar arma…"
                      search={weaponSearch}
                      selectedId={draft.weaponId}
                      onPick={(entry) => pick("weapon", entry)}
                      accent={accent}
                    />
                    {weaponFacts && <ItemFacts facts={weaponFacts} accent={accent} />}
                    {weaponWarning && (
                      <p className="mt-3 font-body text-[15px] text-ember">{weaponWarning}</p>
                    )}
                  </div>

                  <div className={DIVIDER}>
                    <p className={LABEL_MB2}>
                      Armadura
                    </p>
                    <p className={WHISPER_MB4}>Dejala vacia para ir sin armadura.</p>
                    <RarityScry
                      infoKind="item"
                      label="Buscar armadura"
                      placeholder="Buscar armadura o escudo…"
                      search={armorSearch}
                      selectedId={draft.armorId}
                      onPick={(entry) => pick("armor", entry)}
                      accent={accent}
                    />
                    {armorFacts && <ItemFacts facts={armorFacts} accent={accent} />}
                    {armorWarning && (
                      <p className="mt-3 font-body text-[15px] text-ember">{armorWarning}</p>
                    )}
                  </div>

                  {masteryPlan.count > 0 && (
                    <div className={DIVIDER}>
                      <WeaponMastery
                        options={masteryPlan.options}
                        chosen={draft.weaponMasteryIds}
                        count={masteryPlan.count}
                        meleeOnly={masteryPlan.meleeOnly}
                        problems={masteryProblems}
                        accent={accent}
                        onToggle={toggleMastery}
                      />
                    </div>
                  )}

                  <div className={DIVIDER}>
                    <p className={LABEL_MB2}>
                      Equipo adicional
                    </p>
                    <p className={WHISPER_MB4}>
                      {castsAnything
                        ? "El libro de conjuros va aca."
                        : "Mochila, cuerda, raciones, herramientas."}
                    </p>
                    <GearBag
                      carried={carried}
                      search={gearSearch}
                      rulesVersion={rulesVersion}
                      accent={accent}
                      onAdd={addGear}
                      onRemove={removeGear}
                    />

                    <div className={DIVIDER}>
                      <CarryingLoad load={load} accent={accent} />
                    </div>

                    {attunement.offered.length > 0 && (
                      <div className={DIVIDER}>
                        <Attunement
                          state={attunement}
                          accent={accent}
                          onToggle={toggleAttunement}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ---------- Spells ---------- */}
              {chamberKey === "spells" && spellPlans.length > 0 && (
                <div className="space-y-16">
                  {spellPlans.map((classPlan) => (
                    <SpellClassSection
                      key={classPlan.classId}
                      plan={classPlan}
                      cantrips={cantripsByClass.get(classPlan.classId) ?? []}
                      spells={spellsByClass.get(classPlan.classId) ?? []}
                      book={chosenBook}
                      characterLevel={draft.level}
                      accent={accent}
                      showName={spellPlans.length > 1}
                      granted={grantedNames}
                      onToggleCantrip={toggleCantrip}
                      onToggleSpell={toggleSpell}
                      onToggleBookSpell={toggleBookSpell}
                    />
                  ))}
                </div>
              )}

              {/* ---------- Identity ---------- */}
              {chamberKey === "identity" && (
                <div className="max-w-lg space-y-8">
                  <Field label="Nombre verdadero">
                    <input
                      value={draft.characterName}
                      onChange={(event) => patchDraft({ characterName: event.target.value })}
                      placeholder="Decilo en la oscuridad…"
                      className="w-full border-b border-iron bg-transparent pb-3 font-display text-3xl text-bone outline-none transition-colors placeholder:text-bone focus:border-gold"
                    />
                  </Field>

                  <Field label="Nombre del jugador">
                    <input
                      value={draft.playerName}
                      onChange={(event) => patchDraft({ playerName: event.target.value })}
                      placeholder="Quien sostiene la pluma"
                      className="w-full border-b border-iron bg-transparent pb-2 font-body text-lg text-bone outline-none transition-colors placeholder:text-bone focus:border-gold"
                    />
                  </Field>

                  <Field label="Alineamiento">
                    <input
                      value={draft.alignment}
                      onChange={(event) => patchDraft({ alignment: event.target.value })}
                      placeholder="Neutral bueno…"
                      className="w-full border-b border-iron bg-transparent pb-2 font-body text-lg text-bone outline-none transition-colors placeholder:text-bone focus:border-gold"
                    />
                  </Field>

                  <CoverPicker
                    value={draft.coverImage}
                    classId={draft.classId}
                    name={draft.characterName}
                    onChange={(coverImage) => patchDraft({ coverImage })}
                  />

                  {/* These travel in the payload's `identity.biography` and
                      were being dropped entirely. */}
                  <div className="space-y-6 border-t border-iron/40 pt-8">
                    <p className={LABEL}>
                      Lo que te hace vos
                    </p>

                    {(
                      [
                        ["trait", "Rasgo", "Siempre toma notas, incluso en el peligro."],
                        ["ideal", "Ideal", "El conocimiento es la mejor defensa."],
                        ["bond", "Vinculo", "Su mentor desaparecido dejo pistas."],
                        ["flaw", "Defecto", "No abandona una pista, aunque arriesgue al grupo."],
                      ] as const
                    ).map(([field, label, placeholder]) => (
                      <Field key={field} label={label}>
                        <input
                          value={draft[field]}
                          onChange={(event) => patchDraft({ [field]: event.target.value })}
                          placeholder={placeholder}
                          className="w-full border-b border-iron bg-transparent pb-2 font-body text-base text-bone outline-none transition-colors placeholder:text-bone focus:border-gold"
                        />
                      </Field>
                    ))}

                    <Field label="Notas">
                      <textarea
                        value={draft.notes}
                        onChange={(event) => patchDraft({ notes: event.target.value })}
                        rows={3}
                        placeholder="Lo que no entra en ninguna casilla."
                        className="w-full resize-none border border-iron bg-transparent p-3 font-body text-base text-bone outline-none transition-colors placeholder:text-bone focus:border-gold"
                      />
                    </Field>
                  </div>

                  {/* The nine boxes the dnd5e sheet already draws. They are
                      fields of `system.details`, so what is written here lands
                      in the boxes rather than as prose in the biography blob —
                      which is where the description used to go, when it went
                      anywhere at all. */}
                  <div className="space-y-6 border-t border-iron/40 pt-8">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className={LABEL}>Como te ven</p>
                      {draft.raceId && (
                        <button
                          type="button"
                          onClick={suggestLooks}
                          className="border border-iron/70 px-3 py-1.5 font-mono text-[13px] uppercase tracking-[0.1em] text-bone transition-colors hover:border-gold hover:text-gold"
                        >
                          Sugerir por especie
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3">
                      {(
                        [
                          ["age", "Edad", "27"],
                          ["height", "Altura", "1,75 m"],
                          ["weight", "Peso", "70 kg"],
                          ["eyes", "Ojos", "Grises"],
                          ["hair", "Pelo", "Negro, corto"],
                          ["skin", "Piel", "Palida"],
                          ["gender", "Genero", ""],
                          ["faith", "Fe", "Ninguna"],
                        ] as const
                      ).map(([field, label, placeholder]) => (
                        <Field key={field} label={label}>
                          <input
                            value={draft[field]}
                            onChange={(event) => patchDraft({ [field]: event.target.value })}
                            placeholder={placeholder}
                            className="w-full border-b border-iron bg-transparent pb-2 font-body text-base text-bone outline-none transition-colors placeholder:text-bone focus:border-gold"
                          />
                        </Field>
                      ))}
                    </div>

                    <Field label="Aspecto">
                      <textarea
                        value={draft.appearance}
                        onChange={(event) => patchDraft({ appearance: event.target.value })}
                        rows={3}
                        placeholder="Lo primero que nota alguien que te cruza."
                        className="w-full resize-none border border-iron bg-transparent p-3 font-body text-base text-bone outline-none transition-colors placeholder:text-bone focus:border-gold"
                      />
                    </Field>
                  </div>
                </div>
              )}
            </motion.section>
          </AnimatePresence>

          <LiveSheet state={draft} resolved={resolved} accent={accent} />
        </div>

        <footer className="mt-16 flex items-center justify-between border-t border-iron/40 pt-8">
          <button
            onClick={() => go(position - 1)}
            disabled={position === 0}
            className="font-mono text-[14px] uppercase tracking-[0.1em] text-bone transition-colors hover:text-bone disabled:opacity-20"
          >
            ← Retroceder
          </button>

          {!isLast ? (
            <RuneButton
              onClick={() => answered[chamberKey] && go(position + 1)}
              variant="gold"
              className={answered[chamberKey] ? "" : "pointer-events-none opacity-30"}
            >
              Siguiente →
            </RuneButton>
          ) : (
            <RuneButton
              variant="blood"
              onClick={sealCharacter}
              className={answered.identity ? "" : "pointer-events-none opacity-30"}
            >
              {editingId ? "Volver a sellar" : "Sellar en el Codice"}
            </RuneButton>
          )}
        </footer>
      </div>
    </main>
      <InfoReset scope={chamberKey} />
      <InfoPanel accent={accent} />
    </InfoProvider>
  );
}

/*
 * `Beyond` used to live here: the fold under a grid of core-book cards, where
 * the rest of the catalog waited behind a second search box. It went with the
 * grids. One shelf holds the whole catalog now, so there is no "rest".
 */

/**
 * A sub-pick under something already chosen: a subrace, a subclass.
 *
 * Shown as a list rather than cards because the counts are unpredictable —
 * one class offers four sendas and the 2014 cleric offers nineteen — and a
 * grid that is sometimes two tiles and sometimes twenty reads as a mistake.
 */
/**
 * The named alternatives something offers, one question each.
 *
 * Six subclasses ask this — Circle of the Land's terrain, the Genie's four
 * patrons — and in 2024 two species do, which is not a spell question at all:
 * XPHB has no subraces, so an elf's Drow, High Elf and Wood Elf live only as
 * the names on its spell blocks. Until it is answered the character has none
 * of them, which is the honest reading: three lineages at once is three
 * characters.
 */
function VariantChoices({
  sources,
  chosen,
  chosenAbilities,
  questions,
  answers,
  accent,
  onPick,
  onPickAbility,
  onToggleSpell,
}: {
  sources: SpellGrantSource[];
  chosen: Record<string, string>;
  chosenAbilities: Record<string, string>;
  questions: GrantedSpellChoice[];
  answers: Record<string, string[]>;
  accent: string;
  onPick: (key: string, name: string) => void;
  onPickAbility: (key: string, ability: string) => void;
  onToggleSpell: (key: string, name: string) => void;
}) {
  const chambers = new Set(sources.map((source) => source.chamber));
  const asking = sources.filter((source) => source.variants.length > 0);
  const asary = sources.filter((source) => abilityOptionsOf(source).length > 0);
  const asked = questions.filter((question) => chambers.has(question.chamber));
  if (!asking.length && !asary.length && !asked.length) return null;

  return (
    <>
      {asking.map((source) => (
        <SubChoice
          key={source.key}
          title="Linaje"
          hint={`${source.label} se divide en ${source.variants.length}. Decide que conjuros trae.`}
          options={source.variants.map((name) => ({
            id: name,
            label: name,
            source: "",
            shared: false,
          }))}
          selectedId={chosen[source.key] ?? ""}
          onPick={(entry) => onPick(source.key, entry.id)}
          accent={accent}
        />
      ))}

      {asary.map((source) => (
        <SubChoice
          key={`${source.key}:ability`}
          title="Con que lanza esos conjuros"
          hint={`${source.label} deja elegir. Decide la CD de salvacion y el bonificador de ataque.`}
          options={abilityOptionsOf(source).map((ability) => ({
            id: ability,
            label: abilityLabels[ability as AbilityId] ?? ability,
            source: "",
            shared: false,
          }))}
          selectedId={chosenAbilities[source.key] ?? ""}
          onPick={(entry) => onPickAbility(source.key, entry.id)}
          accent={accent}
        />
      ))}

      {asked.map((question) => (
        <PickList
          infoKind="spell"
          key={question.key}
          title={`${question.label} — elegi ${question.count}`}
          options={question.options}
          selected={answers[question.key] ?? []}
          limit={question.count}
          accent={accent}
          onToggle={(name) => onToggleSpell(question.key, name)}
        />
      ))}
    </>
  );
}

/**
 * Back and forward, pinned to the edges of the screen.
 *
 * The footer already carries both, and the footer is at the bottom: a player
 * in the middle of a long chamber has to scroll past everything to move on.
 * These do not scroll, so the way out is always where the player last saw it.
 *
 * Only from `xl` up. The page is `max-w-6xl` (1152px) centred, so above
 * 1280px there is real margin either side to sit in; below it these would
 * float over the chamber itself, and an arrow covering the question it is
 * asking about is worse than an arrow you scroll to. The footer stays as it
 * is at every width, so nothing is lost when they are absent.
 *
 * Disabled rather than removed at the ends of the rail — an arrow that
 * vanishes on the last chamber moves the other one, and a control that moves
 * is a control you have to find again.
 */
function ChamberArrows({
  onBack,
  onNext,
  canGoBack,
  canGoNext,
  accent,
}: {
  onBack: () => void;
  onNext: () => void;
  canGoBack: boolean;
  canGoNext: boolean;
  accent: string;
}) {
  const base =
    "fixed top-1/2 z-20 hidden h-14 w-11 -translate-y-1/2 items-center justify-center border border-iron/60 bg-void font-display text-2xl text-bone transition-colors enabled:hover:text-bone disabled:opacity-25 xl:flex";

  return (
    <>
      <button
        type="button"
        onClick={onBack}
        disabled={!canGoBack}
        aria-label="Camara anterior"
        className={`${base} left-2`}
      >
        ‹
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={!canGoNext}
        aria-label="Camara siguiente"
        className={`${base} right-2`}
        style={canGoNext ? { borderColor: `${accent}66` } : undefined}
      >
        ›
      </button>
    </>
  );
}

/**
 * The size question, for the thirty species that ask it.
 *
 * Drawn as buttons and not as a fact, because it is a question: the 2024
 * human, aasimar and tiefling and twenty-seven more print `["S","M"]` and
 * leave the choice to the player. Reading that as Small — which is what
 * taking the first letter did — sent every one of them to the table in a
 * Small square carrying half the weight.
 *
 * Pressing the chosen one again clears it, and unanswered is a legal state:
 * the field simply does not travel, and Foundry reads an absent size as
 * Medium. So the note says what silence will mean rather than barring the way.
 */
function SizeChoice({
  options,
  value,
  accent,
  onPick,
}: {
  options: string[];
  value: string;
  accent: string;
  onPick: (letter: string) => void;
}) {
  return (
    <div className={DIVIDER_TIGHT}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <span className={LABEL}>Tamano</span>
        <span className={WHISPER}>Esta especie se juega en dos tamanos.</span>
      </div>

      <div className="mt-5 flex flex-wrap gap-1.5">
        {options.map((letter) => {
          const chosen = letter === value;

          return (
            <button
              key={letter}
              type="button"
              aria-pressed={chosen}
              onClick={() => onPick(chosen ? "" : letter)}
              className="border px-3 py-1.5 font-body text-[15px] transition-colors"
              style={
                chosen
                  ? { borderColor: accent, background: `${accent}1f`, color: accent }
                  : { borderColor: "rgba(74,70,64,0.7)", color: "#FFFFFF" }
              }
            >
              {sizeNameOf(letter)}
            </button>
          );
        })}
      </div>

      {!value && (
        <p className={`mt-4 ${WHISPER}`}>
          Sin elegir sale como Mediano, que es lo que Foundry entiende cuando no se dice nada.
        </p>
      )}
    </div>
  );
}

function SubChoice({
  title,
  hint,
  options,
  selectedId,
  onPick,
  accent,
  note,
  infoClass,
}: {
  /** The class's name, which is what tells two same-named subclasses apart in the books. */
  infoClass?: string;
  title: string;
  hint: string;
  options: CatalogEntry[];
  selectedId: string;
  onPick: (entry: CatalogEntry) => void;
  accent: string;
  /** An honest caveat, when the pick does not yet travel the whole way. */
  note?: string;
}) {
  const info = useInfo();
  return (
    <div className={DIVIDER_TIGHT}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <span className={LABEL}>
          {title}
        </span>
        <span className={WHISPER}>{hint}</span>
      </div>

      <div className="mt-5 grid max-h-64 gap-1 overflow-y-auto pr-1 sm:grid-cols-2">
        {options.map((entry) => {
          const active = entry.id === selectedId;

          return (
            <button
              key={`${entry.id}:${entry.source}`}
              onClick={() => {
                onPick(entry);
                info.show({ kind: "subclass", name: entry.label, source: entry.source, extra: [infoClass ?? ""] });
              }}
              className="flex items-baseline justify-between gap-3 border-l-2 px-4 py-2.5 text-left transition-colors"
              style={{
                borderLeftColor: active ? accent : "transparent",
                background: active ? `${accent}12` : "transparent",
              }}
            >
              <span
                className={ITEM_NAME}
                style={{ color: active ? accent : "#FFFFFF" }}
              >
                {entry.label}
              </span>
              <span className={ITEM_META}>
                {entry.source}
              </span>
            </button>
          );
        })}
      </div>

      {note && (
        <p className="mt-4 border-l-2 border-ember/50 pl-3 font-body text-[15px] leading-relaxed text-bone">
          {note}
        </p>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-3 block font-mono text-[13px] tracking-[0.1em] uppercase text-bone">
        {label}
      </label>
      {children}
    </div>
  );
}
