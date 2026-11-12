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
import SigilCard from "@/components/forge/SigilCard";
import ScryPicker from "@/components/forge/ScryPicker";
import InfoPanel from "@/components/info/InfoPanel";
import { InfoProvider, InfoReset } from "@/components/info/info-context";
import CallingChamber from "@/components/forge/CallingChamber";
import AncestryChamber from "@/components/forge/AncestryChamber";
import GiftsChamber from "@/components/forge/GiftsChamber";
import OriginChamber from "@/components/forge/OriginChamber";
import GrowthChamber from "@/components/forge/GrowthChamber";
import GearChamber from "@/components/forge/GearChamber";
import AttributesChamber from "@/components/forge/AttributesChamber";
import IdentityChamber from "@/components/forge/IdentityChamber";
import ChamberArrows from "@/components/forge/ChamberArrows";
import LiveSheet from "@/components/forge/LiveSheet";

import { ABILITY_IDS, type AbilityId } from "@/lib/abilities";
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
import { collapseGearLines } from "@/lib/gear-lines";
import { factsFor, nameFor } from "@/lib/item-facts";
import { armorWarningFor, weaponWarningFor } from "@/lib/gear-warnings";
import { gearProficienciesFor } from "@/lib/gear-proficiencies";
import { speciesProficienciesFor } from "@/lib/species";
import { assignLanguages, languagePlanFor, languagesSatisfied } from "@/lib/languages";
import { branchIsRequiredFor } from "@/lib/species-branch";
import { startingKitFor } from "@/lib/starting-kit";
import {
  abilitiesSettled,
  type StatMethodId,
} from "@/lib/stat-methods";
import { tintFor, VAULT_GOLD } from "@/lib/class-tint";
import { resolveDraft } from "@/lib/derive";
import type { ForgeAction, PickProp } from "@/lib/actions";
import {
  assignOffers,
  offersAreSatisfied,
  proficiencyPlan,
  toLines,
} from "@/lib/grants";
import { attributeSpells, grantedNameSet, spellPlansFor } from "@/lib/spells";
import SpellClassSection from "@/components/forge/SpellClassSection";
import {
  grantedSpellChoicesFor,
  grantedSpellsFor,
  spellGrantsFor,
  unansweredAbilities,
  unansweredSpellChoices,
  type SpellGrantSource,
} from "@/lib/granted-spells";
import type { ExtraClass } from "@/lib/classing";
import { classEntriesFor } from "@/lib/classing";
import { suggestAppearance, type Appearance } from "@/lib/appearance";
import {
  masteryPlanFor,
  masteryPlanForCarried,
  masteryProblemsFor,
} from "@/lib/weapon-mastery";
import { expertisePlanFor } from "@/lib/expertise";
import { classesFor, unmetMulticlassRequirementsFor } from "@/lib/builder";
import { talentPools, talentsSatisfied } from "@/lib/optional-features";
import {
  originAbilityAllowanceFor,
  bonusShape,
  improvementPlan,
  seedSpeciesBonus,
  speciesBonusBudgetFor,
} from "@/lib/improvements";
import { useVault, rulesVersionOf, type Pace } from "@/lib/vault-store";
import { chamberOrder, firstChamber, type ChamberKey } from "@/lib/chambers";
import {
  settleBackgroundFeat,
  settleKit,
  settleLanguages,
  settleMasteries,
  settlePrintedBonus,
  settleProficiencies,
  settleSpeciesSeed,
} from "@/lib/settle";
import { hitPointLevelsFor } from "@/lib/hit-points";
import { carriedLoadFor } from "@/lib/carrying";
import { attunementStateFor } from "@/lib/attunement";
import { foundrySizeFor, sizeFor, sizeOptionsFor } from "@/lib/table-numbers";
import { PAGE } from "@/styles/recipes";

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
  const { draft, patchDraft, dispatch, scratch, seal, editingId, pace, setPace } = useVault();

  // The opening chamber of whichever order this player asked for. Read once,
  // on mount: after that the rail decides where they are.
  const [chamberKey, setChamberKey] = useState<ChamberKey>(firstChamber(pace ?? "nuevo"));
  const [stokeKey, setStokeKey] = useState(0);
  /** What the last species or class change released, named for the player. */
  const [shedByPick, setShedByPick] = useState<string[]>([]);

  /**
   * Make a choice. What it writes is decided in `forge/actions`; this only
   * sends it and repeats what the change took with it.
   */
  const act = (action: ForgeAction) => {
    const outcome = dispatch(action);
    if (outcome.shed) setShedByPick(outcome.shed);
  };

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
    const patch = settleMasteries(draft);
    if (patch) patchDraft(patch);
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
  const writeLanguage = (value: string) => act({ type: "writeLanguage", value });

  /**
   * Keep what the species and the background grant present in the text.
   *
   * Changing either changes what is granted, and the previous grants would
   * otherwise linger as if the player had chosen them.
   */
  useEffect(() => {
    const patch = settleProficiencies(draft);
    if (patch) patchDraft(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [granted.join("|")]);

  useEffect(() => {
    const patch = settleLanguages(draft);
    if (patch) patchDraft(patch);
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

  const chooseVariant = (key: string, name: string) => act({ type: "chooseVariant", key, name });

  /*
   * Which ability the granted spells are cast with.
   *
   * Not a flavour question. dnd5e keeps the ability on the spell itself, and
   * for a fighter or a rogue it is the only thing that gives a species cantrip
   * a save DC — they have no spellcasting ability of their own.
   */
  const chooseSpellAbility = (key: string, ability: string) => act({ type: "chooseSpellAbility", key, ability });

  /** The filter questions: "two cantrips of your choice from that list". */
  const spellChoices = useMemo(
    () => grantedSpellChoicesFor(draft, rulesVersion),
    [draft, rulesVersion],
  );

  const toggleGrantedSpell = (key: string, name: string) => act({ type: "toggleGrantedSpell", key, name });

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
    const patch = settleBackgroundFeat(draft);
    if (patch) patchDraft(patch);
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
    const patch = settleKit(draft);
    if (patch) patchDraft(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kitSignature, kitRows]);

  /**
   * Answering a row swaps what it put in the bag.
   *
   * The previous option's items are removed one copy at a time rather than by
   * name, so a handaxe the player added themselves survives changing an answer
   * that also granted a handaxe.
   */
  const answerKitRow = (rowKey: string, optionKey: string) => act({ type: "answerKitRow", rowKey, optionKey });

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

  const addGear = (entry: CatalogEntry) => act({ type: "addGear", entry });

  const removeGear = (id: string) => act({ type: "removeGear", id });

  const toggleTalent = (id: string) => act({ type: "toggleTalent", id });

  /**
   * Seed the species increase once the species is known.
   *
   * Only when nothing has been assigned yet, so a player who edited the
   * suggestion does not have it overwritten on every render. In 2024 the seed
   * is empty — the edition moved the increase to the background — and the
   * editor simply starts blank.
   */
  useEffect(() => {
    const patch = settleSpeciesSeed(draft);
    if (patch) patchDraft(patch);
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
    const patch = settlePrintedBonus(draft);
    if (patch) patchDraft(patch);
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

  const pick = (prop: PickProp, entry: CatalogEntry) => act({ type: "pick", prop, entry });

  const setLevel = (level: number) => act({ type: "setLevel", level });

  const toggleProficiency = (value: string) => act({ type: "toggleProficiency", value });

  const toggleLanguage = (value: string) => act({ type: "toggleLanguage", value });

  const toggleCantrip = (value: string) => act({ type: "toggleCantrip", value });

  const toggleSpell = (line: string) => act({ type: "toggleSpell", line });

  const toggleBookSpell = (line: string) => act({ type: "toggleBookSpell", line });

  /* ---------------- multiclass ---------------- */

  const addClass = () => act({ type: "addClass" });

  const changeClass = (index: number, next: ExtraClass) =>
    act({ type: "changeClass", index, next });

  const answerExpertise = (
    key: string,
    setIndex: number,
    of: "skills" | "tools",
    id: string,
  ) => act({ type: "answerExpertise", key, setIndex, of, id });

  const toggleMastery = (id: string) => act({ type: "toggleMastery", id });

  const toggleAttunement = (id: string) => act({ type: "toggleAttunement", id });

  const removeClass = (index: number) => act({ type: "removeClass", index });

  const setHitPointRoll = (level: number, roll: number | null) =>
    act({ type: "setHitPointRoll", level, roll });

  const setLevelChoice = (key: string, choice: (typeof draft.levelChoices)[string]) =>
    act({ type: "setLevelChoice", key, choice });

  const setFeatAbilities = (featId: string, bonuses: Record<string, number>) =>
    act({ type: "setFeatAbilities", featId, bonuses });

  /* ---------------- dice ---------------- */

  function chooseStatMethod(method: StatMethodId) {
    act({ type: "chooseStatMethod", method });
  }

  const handleRoll = (rolled: number[]) => act({ type: "roll", rolled });

  const keepSet = (index: number) => act({ type: "keepSet", index });

  const bindScore = (ability: AbilityId, value: number) =>
    act({ type: "bindScore", ability, value });

  const releaseScore = (ability: AbilityId) => act({ type: "releaseScore", ability });

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
                <AncestryChamber
                  draft={draft}
                  patchDraft={patchDraft}
                  races={allRaces}
                  raceLabel={selectedRace?.label}
                  subraces={subraces}
                  branchIsRequired={branchIsRequired}
                  sizeOptions={sizeOptions}
                  variantSources={spellGrants.filter((source) => source.chamber === "species")}
                  spellChoices={spellChoices}
                  onPickRace={(entry) => pick("race", entry)}
                  onPickSubrace={(entry) => pick("subrace", entry)}
                  onToggleGrantedSpell={toggleGrantedSpell}
                  onChooseVariant={chooseVariant}
                  onChooseSpellAbility={chooseSpellAbility}
                />
              )}

              {/* ---------- Calling ---------- */}
              {chamberKey === "calling" && (
                <CallingChamber
                  draft={draft}
                  patchDraft={patchDraft}
                  rulesVersion={rulesVersion}
                  classes={allClasses}
                  classLabel={selectedClass?.label}
                  groupFor={sidekickHeading}
                  primaryLevelCeiling={primaryLevelCeiling}
                  subclassUnlocked={subclassUnlocked}
                  subclassLevel={subclassLevel}
                  subclasses={subclasses}
                  variantSources={spellGrants.filter((source) => source.chamber === "class")}
                  spellChoices={spellChoices}
                  pools={pools}
                  hitPointLevels={hitPointLevels}
                  firstHitDie={firstHitDie}
                  constitutionModifier={Math.floor((snapshot?.abilities.final.con ?? 10) / 2) - 5}
                  multiclassProblems={multiclassProblems}
                  accent={accent}
                  onPickClass={(entry) => pick("class", entry)}
                  onSetLevel={setLevel}
                  onPickSubclass={(entry) => pick("subclass", entry)}
                  onToggleGrantedSpell={toggleGrantedSpell}
                  onChooseVariant={chooseVariant}
                  onChooseSpellAbility={chooseSpellAbility}
                  onToggleTalent={toggleTalent}
                  onSetHitPointRoll={setHitPointRoll}
                  onChangeClass={changeClass}
                  onRemoveClass={removeClass}
                  onAddClass={addClass}
                />
              )}

              {/* ---------- Origin ---------- */}
              {chamberKey === "origin" && (
                <OriginChamber
                  draft={draft}
                  patchDraft={patchDraft}
                  rulesVersion={rulesVersion}
                  backgrounds={allBackgrounds}
                  selectedBackground={selectedBackground}
                  variantSources={spellGrants.filter((source) => source.chamber === "origin")}
                  spellChoices={spellChoices}
                  accent={accent}
                  onPickBackground={(entry) => pick("background", entry)}
                  onToggleGrantedSpell={toggleGrantedSpell}
                  onChooseVariant={chooseVariant}
                  onChooseSpellAbility={chooseSpellAbility}
                />
              )}

              {/* ---------- Attributes ---------- */}
              {chamberKey === "attributes" && (
                <AttributesChamber
                  statMethod={draft.statMethod}
                  abilityBonuses={draft.abilityBonuses}
                  rawScores={rawScores}
                  scratch={scratch}
                  bound={bound}
                  accent={accent}
                  onChooseMethod={chooseStatMethod}
                  onScore={(ability, score) =>
                    patchDraft({ [ability]: score } as Parameters<typeof patchDraft>[0])
                  }
                  onRoll={handleRoll}
                  onKeep={keepSet}
                  onBind={bindScore}
                  onRelease={releaseScore}
                />
              )}

              {/* ---------- Growth ---------- */}
              {chamberKey === "growth" && (
                <GrowthChamber
                  draft={draft}
                  patchDraft={patchDraft}
                  rulesVersion={rulesVersion}
                  printedBonus={printedBonus}
                  speciesBudget={speciesBudget}
                  originAllowance={originAllowance}
                  slots={growth.slots}
                  variantSources={spellGrants.filter((source) => source.chamber === "growth")}
                  spellChoices={spellChoices}
                  accent={accent}
                  onSetChoice={setLevelChoice}
                  onSetFeatAbilities={setFeatAbilities}
                  onToggleGrantedSpell={toggleGrantedSpell}
                  onChooseVariant={chooseVariant}
                  onChooseSpellAbility={chooseSpellAbility}
                />
              )}

              {/* ---------- Gifts ---------- */}
              {chamberKey === "gifts" && (
                <GiftsChamber
                  draft={draft}
                  raceLabel={selectedRace?.label}
                  backgroundLabel={selectedBackground?.label}
                  speciesGranted={speciesGranted}
                  otherGranted={otherGranted}
                  profPlan={profPlan}
                  offerPicks={offerPicks}
                  granted={granted}
                  chosenProficiencies={chosenProficiencies}
                  expertisePlan={expertisePlan}
                  langPlan={langPlan}
                  languagePicks={languagePicks}
                  chosenLanguages={chosenLanguages}
                  variantSources={spellGrants.filter((source) => source.chamber === "gifts")}
                  spellChoices={spellChoices}
                  accent={accent}
                  onToggleProficiency={toggleProficiency}
                  onAnswerExpertise={answerExpertise}
                  onToggleLanguage={toggleLanguage}
                  onWriteLanguage={writeLanguage}
                  onToggleGrantedSpell={toggleGrantedSpell}
                  onChooseVariant={chooseVariant}
                  onChooseSpellAbility={chooseSpellAbility}
                />
              )}

              {/* ---------- Gear ---------- */}
              {chamberKey === "gear" && (
                <GearChamber
                  kitRows={kitRows}
                  kitChoices={draft.kitChoices}
                  onAnswerKit={answerKitRow}
                  weaponSearch={weaponSearch}
                  armorSearch={armorSearch}
                  weaponId={draft.weaponId}
                  armorId={draft.armorId}
                  onPickWeapon={(entry) => pick("weapon", entry)}
                  onPickArmor={(entry) => pick("armor", entry)}
                  weaponFacts={weaponFacts}
                  armorFacts={armorFacts}
                  weaponWarning={weaponWarning}
                  armorWarning={armorWarning}
                  masteryPlan={masteryPlan}
                  weaponMasteryIds={draft.weaponMasteryIds}
                  masteryProblems={masteryProblems}
                  onToggleMastery={toggleMastery}
                  castsAnything={castsAnything}
                  carried={carried}
                  gearSearch={gearSearch}
                  rulesVersion={rulesVersion}
                  onAddGear={addGear}
                  onRemoveGear={removeGear}
                  load={load}
                  attunement={attunement}
                  onToggleAttunement={toggleAttunement}
                  accent={accent}
                />
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
                <IdentityChamber draft={draft} patchDraft={patchDraft} onSuggestLooks={suggestLooks} />
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
