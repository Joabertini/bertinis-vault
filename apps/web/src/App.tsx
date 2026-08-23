import { buildFoundryExportResult } from "@bertinis-vault/foundry-exporter";
import {
  RefResolver,
  buildToPayload,
  collections,
  describeFailure,
  rulesVersionOfBuild,
  type ResolutionFailure,
} from "@bertinis-vault/vetools-index";
import { VaultRequestError, publishBuild } from "./vault-client";
import {
  getBackgroundGrantedProficiencies,
  getClassArmorOptionIds,
  getClassFallbackMeta,
  getClassSkillOptions,
  getClassSkillPickCount,
  getClassWeaponOptionIds,
  getRaceLanguageRule,
  getSubracesForRace,
} from "@bertinis-vault/data-engine";
import {
  buildSpellPickerState,
  formatSpellChoiceLabel,
  getSpellProgressionForClass,
  getSpellSelectionProfileForClassLevel,
  sanitizeSpellSelections,
} from "@bertinis-vault/domain";
import { useEffect, useMemo, useState } from "react";
import {
  type BuilderState,
  appendUniqueLine,
  builderDraftStorageKey,
  buildCanonicalSnapshot,
  coerceBuilderState,
  initialState,
  isCharacterNameMissing,
  removeLine,
} from "./builder";
import {
  fallbackBuilderOptions,
  loadBuilderOptions,
  type BuilderOptionsPayload,
} from "./builder-options";
import { getFeatureSuggestions } from "./feature-suggestions";

const numericDraftKeys = ["str", "dex", "con", "int", "wis", "cha"] as const;
type NumericDraftKey = (typeof numericDraftKeys)[number];
type StatMethod = "manual" | "array" | "pointbuy" | "roll";

const steps = [
  { id: "basic", title: "Datos Basicos", desc: "Lo primero es lo primero: identifica a tu aventurero." },
  { id: "class", title: "Clase y Subclase", desc: "Tu clase define la mayoria de tus capacidades." },
  { id: "race", title: "Raza / Especie", desc: "Tu raza otorga rasgos, idiomas y parte del tono del personaje." },
  { id: "background", title: "Trasfondo", desc: "El origen del personaje afecta skills, flavor y feat sugerida." },
  { id: "stats", title: "Atributos", desc: "Elige como generar los atributos y asignalos antes de seguir." },
  { id: "training", title: "Skills e Idiomas", desc: "Las opciones responden a clase, raza y trasfondo." },
  { id: "equipment", title: "Equipo", desc: "Arma, armadura y loadout inicial guiados por la clase." },
  { id: "magic", title: "Magia y Rasgos", desc: "Cantrips, spells y features sin texto libre como eje." },
  { id: "review", title: "Revision y Export", desc: "Chequea el resultado y descarga el actor para Foundry." },
];

const standardArray = [15, 14, 13, 12, 10, 8];
const pointBuyCost: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };

function abilityModifier(score = 10) {
  return Math.floor((score - 10) / 2);
}

function createNumericDrafts(source: BuilderState) {
  return {
    str: String(source.str),
    dex: String(source.dex),
    con: String(source.con),
    int: String(source.int),
    wis: String(source.wis),
    cha: String(source.cha),
  };
}

function uniqueLines(value: string) {
  return Array.from(new Set(value.split("\n").map((entry) => entry.trim()).filter(Boolean)));
}

function joinLines(values: string[]) {
  return Array.from(new Set(values.map((entry) => entry.trim()).filter(Boolean))).join("\n");
}

function slugForFoundryFile(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function randomFoundryId(length = 16) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

type SpellInfo = {
  id: string;
  label: string;
  level: number;
  summary?: string;
  school?: string | null;
  classes?: string[];
  castingTimeLabel?: string;
  rangeLabel?: string;
  durationLabel?: string;
  componentsLabel?: string;
};

function mergeSpellInfo(...entries: Array<Partial<SpellInfo> | null | undefined>): SpellInfo | null {
  const definedEntries = entries.filter(Boolean) as Partial<SpellInfo>[];
  if (!definedEntries.length) return null;

  return definedEntries.reduce<SpellInfo>(
    (current, entry) => ({
      ...current,
      ...entry,
      id: entry.id || current.id,
      label: entry.label || current.label,
      level: entry.level ?? current.level,
      school: entry.school || current.school || null,
      classes: entry.classes?.length ? entry.classes : current.classes ?? [],
      summary: entry.summary?.trim() ? entry.summary : current.summary ?? "",
      castingTimeLabel: entry.castingTimeLabel || current.castingTimeLabel || "",
      rangeLabel: entry.rangeLabel || current.rangeLabel || "",
      durationLabel: entry.durationLabel || current.durationLabel || "",
      componentsLabel: entry.componentsLabel || current.componentsLabel || "",
    }),
    {
      id: "",
      label: "",
      level: 0,
      school: null,
      classes: [],
      summary: "",
      castingTimeLabel: "",
      rangeLabel: "",
      durationLabel: "",
      componentsLabel: "",
    },
  );
}

function hasRichSpellInfo(entry: SpellInfo | null) {
  if (!entry) return false;
  return Boolean(
    entry.school ||
      entry.summary?.trim() ||
      entry.castingTimeLabel ||
      entry.rangeLabel ||
      entry.durationLabel ||
      entry.componentsLabel ||
      entry.classes?.length,
  );
}

function roll4d6DropLowest() {
  const dice = [...Array(4)].map(() => Math.ceil(Math.random() * 6)).sort((a, b) => b - a) as [number, number, number, number];
  return { total: dice[0] + dice[1] + dice[2], dice };
}

export function App() {
  const [stepIndex, setStepIndex] = useState(0);
  const [builderOptions, setBuilderOptions] = useState<BuilderOptionsPayload>(fallbackBuilderOptions);
  const [datasetState, setDatasetState] = useState("Usando catalogo local");
  const [state, setState] = useState<BuilderState>(() => {
    if (typeof window === "undefined") return initialState;
    const storedDraft = window.localStorage.getItem(builderDraftStorageKey);
    if (!storedDraft) return initialState;
    try {
      return coerceBuilderState(JSON.parse(storedDraft));
    } catch {
      return initialState;
    }
  });
  const [numericDrafts, setNumericDrafts] = useState(() => createNumericDrafts(state));
  const [statMethod, setStatMethod] = useState<StatMethod>("manual");
  const [arrayPool, setArrayPool] = useState(standardArray);
  const [selectedArrayValue, setSelectedArrayValue] = useState<number | null>(null);
  const [pointBuy, setPointBuy] = useState<Record<NumericDraftKey, number>>({
    str: 8,
    dex: 8,
    con: 8,
    int: 8,
    wis: 8,
    cha: 8,
  });
  const [rolledValues, setRolledValues] = useState<Array<{ total: number; dice: number[]; assigned?: NumericDraftKey }>>([]);
  const [selectedRollIndex, setSelectedRollIndex] = useState<number | null>(null);
  const [saveState, setSaveState] = useState("Borrador local activo");
  const [copyState, setCopyState] = useState("Listo para exportar");
  const [activeSpellInfo, setActiveSpellInfo] = useState<SpellInfo | null>(null);
  const [publishState, setPublishState] = useState<
    { status: "idle" | "publishing" } | { status: "done"; code: string } | { status: "error"; message: string }
  >({ status: "idle" });

  const canonicalSnapshot = buildCanonicalSnapshot(state);
  const nameMissing = isCharacterNameMissing(state);

  // One resolver per ruleset, rebuilt only when the ruleset changes: indexing
  // 4336 rows on every keystroke would be wasteful.
  const rulesVersion = rulesVersionOfBuild(canonicalSnapshot);
  const refResolver = useMemo(
    () =>
      new RefResolver(rulesVersion, collections),
    [rulesVersion],
  );

  const conversion = useMemo(
    () => buildToPayload(canonicalSnapshot, refResolver),
    [canonicalSnapshot, refResolver],
  );

  const foundryExport = buildFoundryExportResult(canonicalSnapshot);
  const foundryPreview = foundryExport.payload;
  const foundryPreflight = foundryExport.preflight;

  const classOptions = builderOptions.classes;
  const subclassOptions = builderOptions.subclasses[state.classId] ?? [];
  const raceOptions = builderOptions.races;
  const backgroundOptions = builderOptions.backgrounds;
  const featOptions = builderOptions.feats;
  const weaponOptions = builderOptions.equipment.weapons;
  const armorOptions = builderOptions.equipment.armor;

  const selectedClassMetaRemote = builderOptions.classes.find((entry) => entry.id === state.classId);
  const selectedClassMetaFallback = getClassFallbackMeta(state.classId) ?? {
    hitDie: 8,
    spellcastingAbility: null,
    casterProgression: "none",
    startingEquipment: [],
    primaryAbilities: [],
  };
  const selectedClassMeta = {
    ...selectedClassMetaFallback,
    ...(selectedClassMetaRemote ?? {}),
    hitDie: selectedClassMetaRemote?.hitDie ?? selectedClassMetaFallback.hitDie ?? 8,
    spellcastingAbility:
      selectedClassMetaRemote?.spellcastingAbility ?? selectedClassMetaFallback.spellcastingAbility ?? null,
    casterProgression:
      selectedClassMetaRemote?.casterProgression ?? selectedClassMetaFallback.casterProgression ?? "none",
    startingEquipment:
      selectedClassMetaRemote?.startingEquipment?.length
        ? selectedClassMetaRemote.startingEquipment
        : selectedClassMetaFallback.startingEquipment ?? [],
    primaryAbilities:
      selectedClassMetaRemote?.primaryAbilities?.length
        ? selectedClassMetaRemote.primaryAbilities
        : selectedClassMetaFallback.primaryAbilities ?? [],
  };
  const selectedBackgroundMeta = builderOptions.backgrounds.find((entry) => entry.id === state.backgroundId);
  const selectedBackgroundGrantedFeats = selectedBackgroundMeta?.grantedFeatIds ?? [];
  const filteredCantrips = builderOptions.spells.cantrips.filter(
    (entry) => !entry.classes?.length || entry.classes.includes(state.classId),
  );
  const filteredSpells = builderOptions.spells.spells.filter(
    (entry) => !entry.classes?.length || entry.classes.includes(state.classId),
  );
  const raceSubraceOptions = getSubracesForRace(state.raceId);
  const raceLanguageRule = getRaceLanguageRule(state.raceId);
  const lockedLanguages = raceLanguageRule.fixed;
  const optionalLanguageChoices = raceLanguageRule.choiceOptions ?? [];
  const optionalLanguageCount = raceLanguageRule.choiceCount ?? 0;
  const classSkillChoices = getClassSkillOptions(state.classId);
  const lockedProficiencies = getBackgroundGrantedProficiencies(state.backgroundId);
  const classSkillSelectionLimit = getClassSkillPickCount(state.classId);
  const skillChoices = useMemo(
    () => Array.from(new Set([...lockedProficiencies, ...classSkillChoices])),
    [classSkillChoices, lockedProficiencies],
  );
  const languageChoices = useMemo(() => Array.from(new Set([...lockedLanguages, ...optionalLanguageChoices])), [lockedLanguages, optionalLanguageChoices]);
  const gearChoices = useMemo(
    () =>
      Array.from(
        new Set(
          (selectedClassMeta?.startingEquipment ?? [])
            .map((itemId) => builderOptions.equipment.gear.find((entry) => entry.id === itemId)?.label)
            .filter(Boolean) as string[],
        ),
      ),
    [builderOptions.equipment.gear, selectedClassMeta?.startingEquipment],
  );
  const featureSuggestions = getFeatureSuggestions(state);

  const selectedProficiencies = uniqueLines(state.proficienciesText);
  const selectedLanguages = uniqueLines(state.languagesText);
  const selectedOptionalLanguages = selectedLanguages.filter((entry) => optionalLanguageChoices.includes(entry));
  const selectedClassSkills = selectedProficiencies.filter(
    (entry) => classSkillChoices.includes(entry) && !lockedProficiencies.includes(entry),
  );
  const selectedCantrips = uniqueLines(state.cantripsText);
  const selectedSpells = uniqueLines(state.spellsText);
  const selectedFeatures = uniqueLines(state.featuresText);
  const selectedEquipment = uniqueLines(state.extraEquipmentText);
  const apiBaseUrl = import.meta.env.VITE_BERTINIS_API_URL?.trim() || "http://127.0.0.1:3001";
  const allowedWeaponIds = getClassWeaponOptionIds(state.classId).length
    ? getClassWeaponOptionIds(state.classId)
    : weaponOptions.slice(0, 6).map((entry) => entry.id);
  const allowedArmorIds = getClassArmorOptionIds(state.classId).length
    ? getClassArmorOptionIds(state.classId)
    : armorOptions.map((entry) => entry.id);
  const filteredWeaponOptions = weaponOptions.filter((entry) => allowedWeaponIds.includes(entry.id));
  const filteredArmorOptions = armorOptions.filter((entry) => allowedArmorIds.includes(entry.id));
  const selectedWeaponMeta = weaponOptions.find((entry) => entry.id === state.weaponId);
  const isSpellcaster = Boolean(selectedClassMeta?.spellcastingAbility);
  const derivedSpellcasting = canonicalSnapshot.derived.spellcasting;
  const spellProgression = derivedSpellcasting ? getSpellProgressionForClass(state.classId) : "none";
  const spellcastingAbilityId = derivedSpellcasting?.ability ?? selectedClassMeta?.spellcastingAbility ?? null;
  const spellcastingAbilityModifier =
    spellcastingAbilityId && numericDraftKeys.includes(spellcastingAbilityId as NumericDraftKey)
      ? abilityModifier(state[spellcastingAbilityId as NumericDraftKey])
      : 0;
  const spellSelectionProfile = derivedSpellcasting
    ? getSpellSelectionProfileForClassLevel(state.classId, state.level, spellcastingAbilityModifier)
    : { mode: "none" as const, cantripLimit: 0, spellLimit: 0 };
  const spellPickerState = derivedSpellcasting
    ? buildSpellPickerState({
        slots: derivedSpellcasting.slots,
        profile: spellSelectionProfile,
        cantripOptionCount: filteredCantrips.length,
        spellOptions: filteredSpells.map((entry) => ({ level: entry.level, label: entry.label })),
      })
    : {
        mode: "none" as const,
        modeLabel: "spells",
        sectionTitle: "Spells",
        maxSpellLevel: 0,
        spellLimit: 0,
        availableCantripCount: 0,
        availableSpellCount: 0,
        filteredSpellOptions: [],
      };
  const spellSelectionMode = spellPickerState.mode;
  const spellSelectionModeLabel = spellPickerState.modeLabel;
  const maxSpellLevel = spellPickerState.maxSpellLevel;
  const filteredSpellsByLevel = filteredSpells.filter((entry) =>
    spellPickerState.filteredSpellOptions.some((option) => option.level === entry.level && option.label === entry.label),
  );
  const cantripSelectionLimit = spellSelectionProfile.cantripLimit;
  const spellSelectionLimit = spellPickerState.spellLimit;
  const availableCantripCount = spellPickerState.availableCantripCount;
  const availableSpellCount = spellPickerState.availableSpellCount;

  function updateField<K extends keyof BuilderState>(key: K, value: BuilderState[K]) {
    setState((current) => ({ ...current, [key]: value }));
  }

  function toggleLineField(key: keyof Pick<BuilderState, "proficienciesText" | "languagesText" | "cantripsText" | "spellsText" | "featuresText" | "extraEquipmentText">, value: string) {
    const current = state[key];
    updateField(key, (current.includes(value) ? removeLine(current, value) : appendUniqueLine(current, value)) as BuilderState[typeof key]);
  }

  async function showSpellInfo(entry: SpellInfo) {
    const localFallback = mergeSpellInfo(
      fallbackBuilderOptions.spells.cantrips.find((spell) => spell.id === entry.id),
      fallbackBuilderOptions.spells.spells.find((spell) => spell.id === entry.id),
      builderOptions.spells.cantrips.find((spell) => spell.id === entry.id),
      builderOptions.spells.spells.find((spell) => spell.id === entry.id),
      entry,
    );

    setActiveSpellInfo(localFallback);

    if (hasRichSpellInfo(localFallback)) {
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/spells/${encodeURIComponent(entry.id)}`);
      if (!response.ok) {
        return;
      }

      const detail = (await response.json()) as Partial<SpellInfo>;
      setActiveSpellInfo((current) =>
        mergeSpellInfo(current, detail),
      );
    } catch {
      // Keep the best local spell metadata we already resolved.
    }
  }

  function handleNumericChange(key: NumericDraftKey, rawValue: string) {
    setNumericDrafts((current) => ({ ...current, [key]: rawValue }));
    const parsed = Number.parseInt(rawValue, 10);
    if (!Number.isNaN(parsed)) {
      updateField(key, Math.max(1, Math.min(30, parsed)) as BuilderState[typeof key]);
    }
  }

  function syncArrayAssignment(key: NumericDraftKey) {
    if (selectedArrayValue === null) return;
    updateField(key, selectedArrayValue as BuilderState[typeof key]);
    setNumericDrafts((current) => ({ ...current, [key]: String(selectedArrayValue) }));
    setArrayPool((current) => current.filter((value, index) => index !== current.indexOf(selectedArrayValue)));
    setSelectedArrayValue(null);
  }

  function adjustPointBuy(key: NumericDraftKey, delta: number) {
    const nextValue = pointBuy[key] + delta;
    if (nextValue < 8 || nextValue > 15) return;
    const nextPointBuy = { ...pointBuy, [key]: nextValue };
    const spent = Object.values(nextPointBuy).reduce((acc, value) => acc + (pointBuyCost[value] ?? 0), 0);
    if (spent > 27) return;
    setPointBuy(nextPointBuy);
    updateField(key, nextValue as BuilderState[typeof key]);
    setNumericDrafts((current) => ({ ...current, [key]: String(nextValue) }));
  }

  function rerollStats() {
    if (rolledValues.length > 0) return;
    setRolledValues([...Array(6)].map(() => roll4d6DropLowest()));
    setSelectedRollIndex(null);
  }

  function assignRolledValue(key: NumericDraftKey) {
    if (selectedRollIndex === null || !rolledValues[selectedRollIndex] || rolledValues[selectedRollIndex]?.assigned) return;
    const next = [...rolledValues];
    const previous = next.findIndex((entry) => entry.assigned === key);
    const previousEntry = previous >= 0 ? next[previous] : undefined;
    if (previousEntry) delete previousEntry.assigned;
    const selectedEntry = next[selectedRollIndex];
    if (!selectedEntry) return;
    selectedEntry.assigned = key;
    updateField(key, selectedEntry.total as BuilderState[typeof key]);
    setNumericDrafts((current) => ({ ...current, [key]: String(selectedEntry.total) }));
    setRolledValues(next);
    setSelectedRollIndex(null);
  }

  async function copyActorJson() {
    if (!foundryPreview || typeof window === "undefined" || !window.navigator?.clipboard) return;
    await window.navigator.clipboard.writeText(JSON.stringify(foundryPreview, null, 2));
    setCopyState("Actor Foundry copiado");
  }

  async function publishForFoundry() {
    if (nameMissing) {
      setPublishState({
        status: "error",
        message: "Falta el nombre del personaje.",
      });
      return;
    }

    if (!conversion.payload) {
      setPublishState({
        status: "error",
        message: "Faltan datos obligatorios: raza, clase o trasfondo no se pudieron resolver.",
      });
      return;
    }

    setPublishState({ status: "publishing" });
    try {
      const result = await publishBuild(conversion.payload);
      setPublishState({ status: "done", code: result.code });
    } catch (error) {
      const message =
        error instanceof VaultRequestError
          ? error.message
          : "No se pudo conectar con el servidor de builds.";
      setPublishState({ status: "error", message });
    }
  }

  async function copyPublishedCode(code: string) {
    if (typeof window === "undefined" || !window.navigator?.clipboard) return;
    await window.navigator.clipboard.writeText(code);
    setCopyState(`Codigo ${code} copiado`);
  }

  function downloadActorJson() {
    if (!foundryPreview || typeof window === "undefined" || typeof document === "undefined") return;
    const blob = new Blob([JSON.stringify(foundryPreview, null, 2)], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    const actorSlug = slugForFoundryFile(state.characterName || "vault-character");
    const foundryLikeFileName = `fvtt-Actor-${actorSlug}-${randomFoundryId()}.json`;
    anchor.download = foundryLikeFileName;
    anchor.click();
    window.URL.revokeObjectURL(url);
    setCopyState("Actor Foundry descargado");
  }

  useEffect(() => {
    if (!raceSubraceOptions.length) {
      if (state.subraceId) updateField("subraceId", "");
      return;
    }

    if (!raceSubraceOptions.some((entry) => entry.id === state.subraceId)) {
      updateField("subraceId", raceSubraceOptions[0]?.id ?? "");
    }
  }, [raceSubraceOptions, state.subraceId]);

  useEffect(() => {
    const keptOptional = selectedOptionalLanguages.filter((entry) => optionalLanguageChoices.includes(entry)).slice(0, optionalLanguageCount);
    const nextLanguages = joinLines([...lockedLanguages, ...keptOptional]);
    if (nextLanguages !== state.languagesText) {
      updateField("languagesText", nextLanguages);
    }
  }, [lockedLanguages, optionalLanguageChoices, optionalLanguageCount, selectedOptionalLanguages, state.languagesText]);

  useEffect(() => {
    const keptClassSkills = selectedClassSkills
      .filter((entry) => classSkillChoices.includes(entry))
      .slice(0, classSkillSelectionLimit);
    const nextProficiencies = joinLines([...lockedProficiencies, ...keptClassSkills]);
    if (nextProficiencies !== state.proficienciesText) {
      updateField("proficienciesText", nextProficiencies);
    }
  }, [classSkillChoices, classSkillSelectionLimit, lockedProficiencies, selectedClassSkills, state.proficienciesText]);

  useEffect(() => {
    const nextFeatId = selectedBackgroundGrantedFeats[0] ?? "";
    if (selectedBackgroundGrantedFeats.length > 0 && state.featId !== nextFeatId) {
      updateField("featId", nextFeatId);
    }
  }, [selectedBackgroundGrantedFeats, state.featId]);

  useEffect(() => {
    if (!filteredWeaponOptions.some((entry) => entry.id === state.weaponId)) {
      updateField("weaponId", filteredWeaponOptions[0]?.id ?? state.weaponId);
    }
  }, [filteredWeaponOptions, state.weaponId]);

  useEffect(() => {
    if (!filteredArmorOptions.some((entry) => entry.id === state.armorId)) {
      updateField("armorId", filteredArmorOptions[0]?.id ?? state.armorId);
    }
  }, [filteredArmorOptions, state.armorId]);

  useEffect(() => {
    const allowedGearLabels = new Set(gearChoices);
    const nextEquipment = joinLines(selectedEquipment.filter((entry) => allowedGearLabels.has(entry)));
    if (nextEquipment !== state.extraEquipmentText) {
      updateField("extraEquipmentText", nextEquipment);
    }
  }, [gearChoices, selectedEquipment, state.extraEquipmentText]);

  useEffect(() => {
    if (isSpellcaster) return;
    if (state.cantripsText || state.spellsText) {
      setState((current) => ({ ...current, cantripsText: "", spellsText: "" }));
    }
  }, [isSpellcaster, state.cantripsText, state.spellsText]);

  useEffect(() => {
    if (!derivedSpellcasting) return;

    const sanitizedSelections = sanitizeSpellSelections({
      selectedCantrips,
      selectedSpells,
      cantripLimit: cantripSelectionLimit,
      spellLimit: spellSelectionLimit,
      allowedSpells: filteredSpellsByLevel.map((entry) => ({ level: entry.level, label: entry.label })),
    });

    const nextCantrips = joinLines(sanitizedSelections.cantrips);
    const nextSpells = joinLines(sanitizedSelections.spells);

    if (nextCantrips !== state.cantripsText || nextSpells !== state.spellsText) {
      setState((current) => ({
        ...current,
        cantripsText: nextCantrips,
        spellsText: nextSpells,
      }));
    }
  }, [
    derivedSpellcasting,
    cantripSelectionLimit,
    filteredSpellsByLevel,
    spellSelectionLimit,
    selectedCantrips,
    selectedSpells,
    state.cantripsText,
    state.spellsText,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(builderDraftStorageKey, JSON.stringify(state));
    setSaveState("Guardado local automatico");
  }, [state]);

  useEffect(() => {
    let cancelled = false;
    loadBuilderOptions()
      .then((payload) => {
        if (cancelled) return;
        setBuilderOptions(payload);
        setDatasetState(`API conectada: ${payload.source.mode}`);
      })
      .catch(() => {
        if (cancelled) return;
        setBuilderOptions(fallbackBuilderOptions);
        setDatasetState("Fallback local activo");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const spentPointBuy = Object.values(pointBuy).reduce((acc, value) => acc + (pointBuyCost[value] ?? 0), 0);

  function renderStep() {
    switch (steps[stepIndex]?.id) {
      case "basic":
        return (
          <>
            <div className="field"><label htmlFor="character-name">Nombre del personaje <span>*</span></label>
              <input id="character-name" type="text" value={state.characterName} onChange={(event) => updateField("characterName", event.target.value)} />
              {nameMissing && <div className="field-warning">Falta el nombre del personaje. Podes seguir armandolo, pero no vas a poder generar el codigo.</div>}</div>
            <div className="field"><label htmlFor="player-name">Nombre del jugador</label>
              <input id="player-name" type="text" value={state.playerName} onChange={(event) => updateField("playerName", event.target.value)} /></div>
            <div className="field"><label>Nivel inicial <span>*</span></label>
              <select value={String(state.level)} onChange={(event) => updateField("level", Number(event.target.value))}>
                {Array.from({ length: 20 }, (_, index) => index + 1).map((level) => (
                  <option key={level} value={String(level)}>Nivel {level}</option>
                ))}
              </select></div>
            <div className="field"><label>Alineamiento</label>
              <select value={state.alignment} onChange={(event) => updateField("alignment", event.target.value)}>
                {["Sin definir", "Legal Bueno", "Neutral Bueno", "Caotico Bueno", "Legal Neutral", "Neutral Verdadero", "Caotico Neutral", "Legal Malvado", "Neutral Malvado", "Caotico Malvado"].map((entry) => (
                  <option key={entry} value={entry}>{entry}</option>
                ))}
              </select></div>
          </>
        );
      case "class":
        return (
          <>
            <div className="field"><label>Clase <span>*</span></label>
              <div className="options-grid">
                {classOptions.map((option) => (
                  <label className={`opt${state.classId === option.id ? " selected" : ""}`} key={option.id}>
                    <input
                      checked={state.classId === option.id}
                      name="cls"
                      onChange={() => {
                        updateField("classId", option.id);
                        updateField("subclassId", (builderOptions.subclasses[option.id] ?? [])[0]?.id ?? "");
                      }}
                      type="radio"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="field"><label>Subclase</label>
              <select value={state.subclassId} onChange={(event) => updateField("subclassId", event.target.value)}>
                {(subclassOptions.length ? subclassOptions : [{ id: "", label: "Sin subclase aun" }]).map((option) => (
                  <option key={option.id || "none"} value={option.id}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="feat-info">
              Hit Die: <strong>{selectedClassMeta?.hitDie ? `d${selectedClassMeta.hitDie}` : "Pendiente"}</strong> | Spellcaster: <strong>{selectedClassMeta?.spellcastingAbility ? `Si (${selectedClassMeta.spellcastingAbility.toUpperCase()})` : "No"}</strong> | Abilities primarias: <strong>{selectedClassMeta?.primaryAbilities?.join(" / ") || "Flexible"}</strong>
            </div>
          </>
        );
      case "race":
        return (
          <>
            <div className="field"><label>Raza <span>*</span></label>
              <div className="options-grid">
                {raceOptions.map((option) => (
                  <label className={`opt${state.raceId === option.id ? " selected" : ""}`} key={option.id}>
                    <input checked={state.raceId === option.id} name="race" onChange={() => updateField("raceId", option.id)} type="radio" />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>
            {raceSubraceOptions.length ? (
              <div className="field"><label>Subraza</label>
                <div className="options-grid">
                  {raceSubraceOptions.map((option) => (
                    <label className={`opt${state.subraceId === option.id ? " selected" : ""}`} key={option.id}>
                      <input checked={state.subraceId === option.id} name="subrace" onChange={() => updateField("subraceId", option.id)} type="radio" />
                      {option.label}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="feat-info">
              Idiomas fijos: <strong>{lockedLanguages.join(", ")}</strong>{optionalLanguageCount ? <> | Elecciones extra: <strong>{selectedOptionalLanguages.length}</strong> / {optionalLanguageCount}</> : null}
            </div>
            {optionalLanguageCount ? (
              <div className="field"><label>Idiomas a elegir por raza</label>
                <div className="options-grid">
                  {optionalLanguageChoices.map((entry) => {
                    const checked = selectedOptionalLanguages.includes(entry);
                    const disabled = !checked && selectedOptionalLanguages.length >= optionalLanguageCount;
                    return (
                      <label className={`opt${checked ? " selected" : ""}${disabled ? " disabled" : ""}`} key={entry}>
                        <input checked={checked} disabled={disabled} onChange={() => toggleLineField("languagesText", entry)} type="checkbox" />
                        {entry}
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </>
        );
      case "background":
        return (
          <>
            <div className="field"><label>Trasfondo</label>
              <select value={state.backgroundId} onChange={(event) => updateField("backgroundId", event.target.value)}>
                {backgroundOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select></div>
            <div className="bg-feat-auto" style={{ display: "block" }}>
              <b>Trasfondo</b>: {selectedBackgroundMeta?.label ?? state.backgroundId}
              <br />
              <b>Origen</b>: {selectedBackgroundMeta?.source ?? "PHB"}
              <br />
              <b>Feat del trasfondo</b>: {selectedBackgroundGrantedFeats.length ? featOptions.find((option) => option.id === selectedBackgroundGrantedFeats[0])?.label ?? selectedBackgroundGrantedFeats[0] : "No otorga feat automatica"}
              <br />
              <b>Skills de trasfondo</b>: {(getBackgroundGrantedProficiencies(state.backgroundId).length ? getBackgroundGrantedProficiencies(state.backgroundId) : ["Flexible"]).join(", ")}
            </div>
          </>
        );
      case "stats":
        return (
          <>
            <div className="dice-method-tabs">
              {[
                ["manual", "Manual"],
                ["array", "Standard Array"],
                ["pointbuy", "Point Buy"],
                ["roll", "4d6"],
              ].map(([id, label]) => (
                <button className={`tab-btn${statMethod === id ? " active" : ""}`} key={id} onClick={() => setStatMethod(id as StatMethod)} type="button">{label}</button>
              ))}
            </div>
            {statMethod === "array" ? (
              <div className="dice-panel active">
                <div className="assign-hint">Elegi un valor y despues hac click sobre un atributo.</div>
                <div className="array-row">
                  {arrayPool.map((value, index) => (
                    <button className={`array-chip${selectedArrayValue === value ? " selected" : ""}`} key={`${value}-${index}`} onClick={() => setSelectedArrayValue(value)} type="button">{value}</button>
                  ))}
                </div>
              </div>
            ) : null}
            {statMethod === "pointbuy" ? (
              <div className="dice-panel active">
                <div className="pb-total">Puntos disponibles: <b>{27 - spentPointBuy}</b> / 27</div>
              </div>
            ) : null}
            {statMethod === "roll" ? (
              <div className="dice-panel active">
                <button className="btn-reroll" disabled={rolledValues.length > 0} onClick={rerollStats} type="button">Tirar 4d6 x6</button>
                {rolledValues.length > 0 ? <div className="assign-hint">Esta tirada se puede usar una sola vez. Asigna esos seis resultados a tus atributos.</div> : null}
                <div className="roll-results">
                  {rolledValues.map((entry, index) => (
                    <button className={`roll-box${entry.assigned ? " used" : ""}`} key={`${entry.total}-${index}`} onClick={() => setSelectedRollIndex(index)} type="button">
                      <div className="rb-stat">{entry.assigned?.toUpperCase() ?? "—"}</div>
                      <div className="rb-val">{entry.total}</div>
                      <div className="rb-dice">{entry.dice.join(", ")}</div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="stats-grid">
              {numericDraftKeys.map((key) => (
                <div className="stat-field" key={key}>
                  <label>{key.toUpperCase()}</label>
                  {statMethod === "pointbuy" ? (
                    <div className="pb-controls">
                      <button className="pb-btn" onClick={() => adjustPointBuy(key, -1)} type="button">-</button>
                      <div className="pb-val">{pointBuy[key]}</div>
                      <button className="pb-btn" onClick={() => adjustPointBuy(key, 1)} type="button">+</button>
                    </div>
                  ) : (
                    <input
                      inputMode={statMethod === "manual" ? "numeric" : "none"}
                      onBlur={() => setNumericDrafts((current) => ({ ...current, [key]: String(state[key]) }))}
                      onChange={statMethod === "manual" ? (event) => handleNumericChange(key, event.target.value) : undefined}
                      onClick={() => {
                        if (statMethod === "array") syncArrayAssignment(key);
                        if (statMethod === "roll") assignRolledValue(key);
                      }}
                      readOnly={statMethod !== "manual"}
                      type={statMethod === "manual" ? "number" : "text"}
                      value={numericDrafts[key]}
                    />
                  )}
                  <div className="stat-mod">{`${abilityModifier(state[key]) >= 0 ? "+" : ""}${abilityModifier(state[key])}`}</div>
                </div>
              ))}
            </div>
          </>
        );
      case "training":
        return (
          <>
            <div className="feat-info">
              Competencias de trasfondo aplicadas: <strong>{lockedProficiencies.join(", ") || "Ninguna"}</strong> | Picks de clase: <strong>{selectedClassSkills.length}</strong> / {classSkillSelectionLimit}
            </div>
            <div className="field"><label>Skills de clase</label>
              <div className="options-grid">
                {skillChoices.map((entry) => {
                  const locked = lockedProficiencies.includes(entry);
                  const checked = selectedProficiencies.includes(entry);
                  const disabled = locked || (!checked && selectedClassSkills.length >= classSkillSelectionLimit);
                  return (
                  <label className={`opt${checked ? " selected" : ""}${disabled ? " disabled" : ""}`} key={entry}>
                    <input checked={checked} disabled={disabled} onChange={() => toggleLineField("proficienciesText", entry)} type="checkbox" />
                    {entry}
                  </label>
                );})}
              </div>
            </div>
            <div className="field"><label>Idiomas resultantes</label>
              <div className="options-grid">
                {languageChoices.map((entry) => (
                  <label className={`opt${selectedLanguages.includes(entry) ? " selected" : ""}`} key={entry}>
                    <input checked={selectedLanguages.includes(entry)} disabled type="checkbox" />
                    {entry}
                  </label>
                ))}
              </div>
            </div>
          </>
        );
      case "equipment":
        return (
          <>
            <div className="field"><label>Arma principal</label>
              <select value={state.weaponId} onChange={(event) => updateField("weaponId", event.target.value)}>
                {filteredWeaponOptions.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.label}</option>
                ))}
              </select>
            </div>
            {selectedWeaponMeta ? (
              <div className="bg-feat-auto" style={{ display: "block" }}>
                <b>{selectedWeaponMeta.label}</b>
                <br />
                <b>Daño</b>: {selectedWeaponMeta.damage ?? "Sin dato"}
                <br />
                <b>Tipo de daño</b>: {selectedWeaponMeta.damageType ?? "Sin dato"}
                <br />
                <b>Tipo de ataque</b>: {selectedWeaponMeta.attackType ?? "Sin dato"}
              </div>
            ) : null}
            <div className="field"><label>Armadura / Proteccion</label>
              <div className="options-grid">
                {filteredArmorOptions.map((entry) => (
                  <label className={`opt${state.armorId === entry.id ? " selected" : ""}`} key={entry.id}>
                    <input checked={state.armorId === entry.id} onChange={() => updateField("armorId", entry.id)} type="radio" />
                    {entry.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="field"><label>Equipo inicial sugerido</label>
              <div className="options-grid">
                {gearChoices.map((entry) => (
                  <label className={`opt${selectedEquipment.includes(entry) ? " selected" : ""}`} key={entry}>
                    <input checked={selectedEquipment.includes(entry)} onChange={() => toggleLineField("extraEquipmentText", entry)} type="checkbox" />
                    {entry}
                  </label>
                ))}
              </div>
            </div>
          </>
        );
      case "magic":
        return (
          <>
            <div className="feat-info">
              Spellcaster: <strong>{derivedSpellcasting ? `Si (${derivedSpellcasting.ability.toUpperCase()})` : "No"}</strong> | Progresion: <strong>{spellProgression}</strong> | Spell DC: <strong>{derivedSpellcasting?.saveDC ?? "-"}</strong>{derivedSpellcasting ? <> | Ataque de conjuro: <strong>{derivedSpellcasting.attackBonus >= 0 ? `+${derivedSpellcasting.attackBonus}` : derivedSpellcasting.attackBonus}</strong> | Nivel maximo de spell: <strong>{maxSpellLevel || 0}</strong></> : null}
            </div>
            {derivedSpellcasting ? <div className="bg-feat-auto" style={{ display: "block" }}>
              <b>Opciones / seleccion</b>: cantrips {selectedCantrips.length} / {availableCantripCount} | {spellSelectionModeLabel} {selectedSpells.length} / {availableSpellCount}
            </div> : null}
            {activeSpellInfo ? <div className="bg-feat-auto" style={{ display: "block" }}>
              <b>{activeSpellInfo.label}</b> {activeSpellInfo.level ? `(Nv${activeSpellInfo.level})` : "(Cantrip)"}
              <br />
              <b>Escuela</b>: {activeSpellInfo.school ?? "Sin dato"}
              <br />
              <b>Lanzamiento</b>: {activeSpellInfo.castingTimeLabel || "Sin dato"}
              <br />
              <b>Alcance</b>: {activeSpellInfo.rangeLabel || "Sin dato"}
              <br />
              <b>Duracion</b>: {activeSpellInfo.durationLabel || "Sin dato"}
              <br />
              <b>Componentes</b>: {activeSpellInfo.componentsLabel || "Sin dato"}
              <br />
              <b>Clases</b>: {activeSpellInfo.classes?.join(", ") || "Sin dato"}
              <br />
              <b>Descripcion</b>: {activeSpellInfo.summary?.trim() ? activeSpellInfo.summary : "Sin descripcion"}
            </div> : null}
            {derivedSpellcasting && availableCantripCount > 0 ? <div className="field"><label>Cantrips</label>
              <div className="options-grid">
                {filteredCantrips.map((entry) => {
                  const checked = selectedCantrips.includes(entry.label);
                  const disabled = !checked && selectedCantrips.length >= availableCantripCount;
                  return (
                  <label className={`opt${checked ? " selected" : ""}${disabled ? " disabled" : ""}`} key={entry.id} onClick={() => void showSpellInfo(entry)}>
                    <input checked={checked} disabled={disabled} onChange={() => toggleLineField("cantripsText", entry.label)} type="checkbox" />
                    {entry.label}
                  </label>
                );})}
              </div>
            </div> : null}
            {derivedSpellcasting && maxSpellLevel > 0 && availableSpellCount > 0 ? <div className="field"><label>{spellPickerState.sectionTitle}</label>
              <div className="options-grid">
                {filteredSpellsByLevel.map((entry) => {
                  const label = formatSpellChoiceLabel({ level: entry.level, label: entry.label });
                  const checked = selectedSpells.includes(label);
                  const disabled = !checked && selectedSpells.length >= availableSpellCount;
                  return (
                    <label className={`opt${checked ? " selected" : ""}${disabled ? " disabled" : ""}`} key={entry.id} onClick={() => void showSpellInfo(entry)}>
                      <input checked={checked} disabled={disabled} onChange={() => toggleLineField("spellsText", label)} type="checkbox" />
                      {entry.label} {entry.level ? `(Nv${entry.level})` : ""}
                    </label>
                  );
                })}
              </div>
            </div> : null}
            <div className="field"><label>Features sugeridas</label>
              <div className="options-grid">
                {[...new Set(featureSuggestions)].slice(0, 12).map((entry) => (
                  <label className={`opt${selectedFeatures.includes(entry) ? " selected" : ""}`} key={entry}>
                    <input checked={selectedFeatures.includes(entry)} onChange={() => toggleLineField("featuresText", entry)} type="checkbox" />
                    {entry}
                  </label>
                ))}
              </div>
            </div>
            <div className="field"><label>Rasgo</label><input type="text" value={state.trait} onChange={(event) => updateField("trait", event.target.value)} /></div>
            <div className="field"><label>Ideal</label><input type="text" value={state.ideal} onChange={(event) => updateField("ideal", event.target.value)} /></div>
            <div className="field"><label>Vinculo</label><input type="text" value={state.bond} onChange={(event) => updateField("bond", event.target.value)} /></div>
            <div className="field"><label>Defecto</label><input type="text" value={state.flaw} onChange={(event) => updateField("flaw", event.target.value)} /></div>
          </>
        );
      case "review":
        return (
          <>
            <div className="result-header">Resultado</div>
            <div className="result-box">
              <strong>{state.characterName || "Sin nombre"}</strong>
              {selectedClassMeta?.label ?? state.classId} {state.subclassId ? `· ${subclassOptions.find((entry) => entry.id === state.subclassId)?.label ?? state.subclassId}` : ""} | {raceOptions.find((entry) => entry.id === state.raceId)?.label ?? state.raceId} | Nivel {state.level}
              <br />
              AC {canonicalSnapshot.derived.ac} | HP {canonicalSnapshot.derived.hp} | PB +{canonicalSnapshot.derived.proficiencyBonus}
              <br />
              Skills: {selectedProficiencies.join(", ") || "Ninguna"}
              <br />
              Idiomas: {selectedLanguages.join(", ") || "Ninguno"}
              <br />
              Equipo: {[state.weaponId, state.armorId, ...selectedEquipment].join(", ")}
              <br />
              Spells: {[...selectedCantrips, ...selectedSpells].join(", ") || "Ninguno"}
            </div>
            <div className="nav">
              <button
                className="btn btn-next"
                onClick={publishForFoundry}
                disabled={publishState.status === "publishing" || !conversion.payload || nameMissing}
                type="button"
              >
                {publishState.status === "publishing" ? "GENERANDO..." : "GENERAR CODIGO"}
              </button>
              <button className="btn btn-next" onClick={copyActorJson} type="button">COPIAR ACTOR</button>
              <button className="btn btn-next" onClick={downloadActorJson} type="button">DESCARGAR JSON</button>
            </div>
            {publishState.status === "done" && (
              <div className="result-box">
                <strong>Tu codigo</strong>
                <div className="vault-code">{publishState.code}</div>
                Pegalo en el modulo de Foundry para importar el personaje.
                <br />
                <button
                  className="btn btn-next"
                  onClick={() => copyPublishedCode(publishState.code)}
                  type="button"
                >
                  COPIAR CODIGO
                </button>
              </div>
            )}
            {publishState.status === "error" && (
              <div className="result-box">
                <strong>No se pudo generar el codigo</strong>
                {publishState.message}
              </div>
            )}
            {conversion.failures.length > 0 && (
              <div className="result-box">
                <strong>Elecciones sin resolver ({conversion.failures.length})</strong>
                Estas no se van a importar. El resto del personaje si.
                <ul>
                  {conversion.failures.map((failure: ResolutionFailure, index: number) => (
                    <li key={`${failure.prop}-${failure.query}-${index}`}>{describeFailure(failure)}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="result-box">
              <strong>Estado</strong>
              {copyState} | Dataset: {datasetState} | Preflight: {foundryPreflight.summary.blockers > 0 ? "Blocked" : "Clean/Warning"}
            </div>
            <div className="copy-area">{JSON.stringify(foundryPreview ?? foundryPreflight, null, 2)}</div>
          </>
        );
      default:
        return null;
    }
  }

  return (
    <div className="vault-page">
      <header>
        <div className="title-rule"><div className="diamond"></div></div>
        <h1>VAULT<em>CREACION DE PERSONAJE</em></h1>
        <p className="tagline">D&D 5e 2014 · builder funcional para exportar a Foundry</p>
        <div className="title-rule"><div className="diamond"></div></div>
      </header>

      <div className="progress">
        {steps.map((_, index) => (
          <div className={`step-dot${index === stepIndex ? " active" : index < stepIndex ? " done" : ""}`} key={index} />
        ))}
      </div>

      <section className="section active">
        <div className="section-header">
          <div className="section-num">{`PASO ${String(stepIndex + 1).padStart(2, "0")} / 09`}</div>
          <div className="section-title">{steps[stepIndex]?.title}</div>
          <div className="section-desc">{steps[stepIndex]?.desc}</div>
        </div>

        {renderStep()}

        <div className="nav">
          {stepIndex > 0 ? (
            <button className="btn btn-back" onClick={() => setStepIndex((current) => Math.max(0, current - 1))} type="button">← ATRAS</button>
          ) : null}
          {stepIndex < steps.length - 1 ? (
            <button className="btn btn-next" onClick={() => setStepIndex((current) => Math.min(steps.length - 1, current + 1))} type="button">SIGUIENTE →</button>
          ) : null}
        </div>
      </section>

      <footer>{saveState}</footer>
    </div>
  );
}
