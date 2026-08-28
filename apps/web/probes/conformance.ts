/**
 * Does every draft the Forge can produce survive derivation?
 *
 * Run with `pnpm probe`. Nothing here asserts a character is *correct* — it
 * asserts the pipeline does not throw, which is a different and lower bar, and
 * the one that keeps producing blank screens: the canonical ids are `.min(1)`,
 * so any value that normalizes to an empty string is a ZodError raised through
 * the render rather than a validation message.
 *
 * The first run of this sweep broke on 20 of 47 cases. Add a row whenever a
 * new optional field reaches `buildCanonicalSnapshot`.
 */
import { readFileSync } from "node:fs";

import {
  buildCanonicalSnapshot,
  coerceBuilderState,
  initialState,
  type BuilderState,
} from "@/lib/builder";
import {
  allOptions,
  coreOptions,
  entryById,
  searchBeyondCore,
  subclassesFor,
  subracesFor,
} from "@/lib/catalog";
import { resolveDraft } from "@/lib/derive";
import { characterSheetHtml, fileSlug } from "@/lib/export-targets";
import { publishBuild } from "@/lib/vault-client";
import { hasProgress, releasedByPick } from "@/lib/vault-store";
import {
  abilitySources,
  bonusShape,
  seedSpeciesBonus,
  speciesBonusBudgetFor,
} from "@/lib/improvements";
import { ABILITY_IDS } from "@/lib/abilities";
import { chamberOrder, firstChamber } from "@/lib/chambers";
import { factsFor } from "@/lib/item-facts";
import { collections, forRulesVersion, type ItemRow } from "@bertinis-vault/vetools-index";
import type { RulesVersion } from "@bertinis-vault/vetools-ref";

import {
  levellingFor,
  proficiencyGrantForBackground,
  slugOf,
  startingEquipmentForBackground,
  startingEquipmentForClass,
} from "@/lib/index-options";
import { counselFor, proficiencyAt } from "@/lib/counsel";
import { actionProfile, concentrationAmong } from "@/lib/spells";
import { readFoundryActor } from "@/lib/foundry-import";
import {
  STANDARD_ARRAY,
  canLower,
  canRaise,
  pointBuyCost,
  pointBuyFloor,
  pointBuySpent,
  rollOneScore,
  rollSix,
  spreadWorth,
} from "@/lib/stat-methods";
import { playbookFor, tabForFeat, tabForNote, tabForRule } from "@/lib/playbook";
import { CLASS_NOTES, FEAT_NOTES, UNIVERSAL_RULES } from "@/lib/playbook-data";

/** A character with only the three fields the Forge insists on. */
const minimal: BuilderState = {
  ...initialState,
  characterName: "",
  playerName: "",
  alignment: "",
  trait: "",
  ideal: "",
  bond: "",
  flaw: "",
  notes: "",
  raceId: "dwarf",
  subraceId: "",
  classId: "wizard",
  subclassId: "",
  backgroundId: "sage",
  backgroundFeatId: "",
  featId: "",
  level: 1,
  statMethod: "roll",
  str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10,
  abilityBonuses: {},
  levelChoices: {},
  optionalFeatureIds: [],
  featAbilityChoices: {},
  sourceBooks: {},
  weaponId: "",
  armorId: "",
  extraEquipmentText: "",
  proficienciesText: "",
  languagesText: "",
  cantripsText: "",
  spellsText: "",
  featuresText: "",
};

/** Values that no catalog will resolve, including some that leave no slug. */
const hostile = ["Cosa Inventada Zzz", "...", "———", "??!", "  ·  ", "日本語"];

const textFields = [
  "extraEquipmentText",
  "proficienciesText",
  "languagesText",
  "cantripsText",
  "spellsText",
  "featuresText",
] as const;

const cases: Array<[string, BuilderState]> = [
  ["minimo 2014", minimal],
  ["minimo 2024", { ...minimal, rulesVersion: "5e-2024" }],
  ["minimo nivel 20", { ...minimal, level: 20 }],
  ["arma sin armadura", { ...minimal, weaponId: "longsword" }],
  ["armadura sin arma", { ...minimal, armorId: "chain-mail" }],
  ["arma inexistente", { ...minimal, weaponId: "espada-que-no-existe" }],
  ["armadura inexistente", { ...minimal, armorId: "armadura-fantasma" }],
  ["subraza sin raza base", { ...minimal, subraceId: "dwarf-hill" }],
  ["subclase inexistente", { ...minimal, subclassId: "subclase-fantasma" }],
  ["dote inexistente", { ...minimal, featId: "dote-fantasma" }],
  ["rasgo opcional falso", { ...minimal, optionalFeatureIds: ["nada-de-nada"] }],
];

for (const field of textFields) {
  for (const value of hostile) {
    cases.push([`${field} = ${JSON.stringify(value)}`, { ...minimal, [field]: value }]);
  }
}

/*
 * Drafts that actually carry the object-valued fields.
 *
 * These are the ones with hand-written coercion — `coerceLevelChoices`,
 * `coerceAbilityBonuses`, `coerceFeatAbilityChoices`, `coerceSourceBooks` —
 * and a round trip over drafts that leave them empty proves nothing about any
 * of them.
 */
const loaded: BuilderState = {
  ...minimal,
  characterName: "Cargada",
  classId: "fighter",
  raceId: "dwarf",
  subraceId: "dwarf-hill",
  backgroundId: "soldier",
  level: 12,
  str: 15, dex: 13, con: 14, int: 10, wis: 12, cha: 8,
  statMethod: "pointbuy",
  abilityBonuses: { str: 2, con: 1 },
  levelChoices: {
    4: { kind: "improvement", bonuses: { str: 2 } },
    6: { kind: "feat", featId: "resilient" },
    8: { kind: "improvement", bonuses: { str: 1, con: 1 } },
    12: { kind: "improvement", bonuses: { con: 2 } },
  },
  featAbilityChoices: { resilient: { wis: 1 } },
  optionalFeatureIds: ["defense", "great-weapon-fighting"],
  sourceBooks: { "class:fighter": "PHB", "race:dwarf": "PHB", "background:soldier": "PHB" },
  weaponId: "longsword",
  armorId: "chain-mail",
  extraEquipmentText: "Cuerda de seda\nRaciones",
  proficienciesText: "Athletics\nSmith's Tools",
  languagesText: "Dwarvish",
  featuresText: "Second Wind\nAction Surge",
  // The printable sheet is the only export that carries these, so a draft
  // without them leaves that half of the template unexercised.
  trait: "Habla poco y golpea primero.",
  ideal: "La deuda se paga.",
  bond: "Su clan quedo bajo la montana.",
  flaw: "No perdona una traicion, nunca.",
  notes: "Lleva el yelmo de su hermano.",
};

cases.push(["cargada 2014", loaded]);
cases.push(["cargada 2024", { ...loaded, rulesVersion: "5e-2024", subraceId: "" }]);

for (const statMethod of ["manual", "array", "pointbuy", "roll"] as const) {
  cases.push([`cargada statMethod=${statMethod}`, { ...loaded, statMethod }]);
}

// A caster carrying spells, which the plain `loaded` fighter never exercises.
cases.push([
  "cargada lanzadora",
  {
    ...loaded,
    classId: "wizard",
    armorId: "",
    sourceBooks: { ...loaded.sourceBooks, "class:wizard": "PHB" },
    cantripsText: "Fire Bolt\nMage Hand",
    spellsText: "Nv1: Magic Missile\nNv3: Fireball",
  },
]);

/*
 * Every class and species the core books print, in both editions.
 *
 * A single wizard proves almost nothing: the crashes that matter are the ones
 * a specific class reaches — a subclass taken at the level it unlocks, a
 * caster at 20 with a full spell table, a species whose subraces the index
 * names differently from its own row.
 */
const editions: Array<["2014" | "2024", BuilderState["rulesVersion"]]> = [
  ["2014", "5e-2014"],
  ["2024", "5e-2024"],
];

for (const [label, rulesVersion] of editions) {
  const base: BuilderState = { ...minimal, rulesVersion };

  for (const cls of coreOptions("class", label)) {
    const at = { ...base, classId: cls.id, sourceBooks: { [`class:${cls.id}`]: cls.source } };
    cases.push([`${label} ${cls.label} nvl 1`, { ...at, level: 1 }]);
    cases.push([`${label} ${cls.label} nvl 20`, { ...at, level: 20 }]);

    // The subclass, taken at the first level that grants it.
    const subclassLevel = levellingFor(cls.id, label).subclassLevel ?? 3;
    const subclass = subclassesFor(cls.label, label, "", 1)[0];
    if (subclass) {
      cases.push([
        `${label} ${cls.label} / ${subclass.label} nvl ${subclassLevel}`,
        { ...at, level: subclassLevel, subclassId: subclass.id },
      ]);
    }
  }

  for (const race of coreOptions("race", label)) {
    const at = { ...base, raceId: race.id, sourceBooks: { [`race:${race.id}`]: race.source } };
    cases.push([`${label} ${race.label}`, at]);

    const subrace = subracesFor(race.label, label, "", 1)[0];
    if (subrace) {
      cases.push([`${label} ${race.label} / ${subrace.label}`, { ...at, subraceId: subrace.id }]);
    }
  }
}

let broken = 0;
let unforged = 0;
let noPayload = 0;

/*
 * What the payload silently leaves behind.
 *
 * A case that does not throw has cleared the low bar. The next one is whether
 * every pick actually crossed: a resolution failure means the player chose
 * something the export dropped, and saying nothing about it is the failure
 * mode this project treats as worse than an error.
 */
const droppedByProp = new Map<string, number>();
const dropExample = new Map<string, string>();
/** The exact sentence the Ritual shows the player, one per failure shape. */
const playerFacing = new Map<string, string>();

for (const [tag, state] of cases) {
  try {
    const resolved = resolveDraft(state);
    if (resolved.status !== "ready") {
      unforged += 1;
      console.log("SIN FORJAR".padEnd(11), tag);
      continue;
    }

    for (const failure of resolved.failures) {
      const key = `${failure.prop}/${failure.reason}`;
      droppedByProp.set(key, (droppedByProp.get(key) ?? 0) + 1);
      if (!dropExample.has(key)) dropExample.set(key, tag);
    }

    resolved.failures.forEach((failure, index) => {
      const key = `${failure.prop}/${failure.reason}`;
      const sentence = resolved.problems[index];
      if (sentence && !playerFacing.has(key)) playerFacing.set(key, sentence);
    });

    if (!resolved.payload) {
      noPayload += 1;
      console.log("SIN PAYLOAD".padEnd(11), tag.padEnd(44), resolved.problems.join(" | ").slice(0, 90));
    }
  } catch (error) {
    broken += 1;
    const message =
      error instanceof Error ? error.message.split("\n").slice(0, 1).join("") : String(error);
    const path =
      typeof error === "object" && error && "issues" in error
        ? JSON.stringify(
            (error as { issues: Array<{ path: unknown[] }> }).issues.map((i) => i.path.join(".")),
          )
        : "";
    console.log("REVIENTA".padEnd(11), tag.padEnd(44), path || message);
  }
}

console.log(
  `\n${cases.length} casos: ${broken} revientan, ${unforged} sin forjar, ${noPayload} sin payload.`,
);

/*
 * Does a sealed character reopen as the same character?
 *
 * The Codex keeps builder states, not derived sheets, and localStorage keeps
 * them as JSON — so every reforge is a round trip through `JSON.parse` and
 * `coerceBuilderState`. A field that coercion forgets does not announce
 * itself: the tome simply comes back subtly different from the one that was
 * sealed, which is the quietest way this front could lie.
 *
 * `updatedAt` is stamped fresh on every derivation, so it is excluded.
 */
function withoutTimestamp(state: BuilderState): string {
  const snapshot = buildCanonicalSnapshot(state) as { meta: { updatedAt?: string } };
  const { updatedAt: _ignored, ...meta } = snapshot.meta;
  return JSON.stringify({ ...snapshot, meta });
}

let drifted = 0;
for (const [tag, state] of cases) {
  const reopened = coerceBuilderState(JSON.parse(JSON.stringify(state)));

  let before: string;
  let after: string;
  try {
    before = withoutTimestamp(state);
    after = withoutTimestamp(reopened);
  } catch {
    // Already counted as a crash above; nothing more to learn here.
    continue;
  }

  if (before !== after) {
    drifted += 1;
    console.log("DERIVA".padEnd(11), tag);
  }
}

console.log(`Sellar y reabrir: ${drifted} de ${cases.length} casos cambian.`);

/*
 * Does every pick reach the payload?
 *
 * A resolution failure is the loud way a choice can be lost. The quiet way is
 * a field the converter never fills — `expertise` is initialized to `[]` and
 * nothing ever pushes to it, so a rogue exports without their doubled
 * proficiency and nothing anywhere says so.
 *
 * The two gaps below are the repo's, not this front's, and they are listed
 * rather than tolerated: when either is fixed upstream this section reports it
 * as an unexpected pass, which is the reminder to delete the entry.
 */
const audited = coerceBuilderState(
  JSON.parse(
    JSON.stringify({
      ...loaded,
      subclassId: "champion",
      proficienciesText: "Athletics\nIntimidation\nSmith's Tools",
    }),
  ),
);

const auditedResult = resolveDraft(audited);
const payload = auditedResult.status === "ready" ? auditedResult.payload : null;

type Check = { what: string; ok: boolean; knownGap?: string };

const checks: Check[] = payload
  ? [
      { what: "especie", ok: Boolean(payload.race?.ref?.hash) },
      {
        what: "subraza",
        ok: JSON.stringify(payload.race ?? {}).includes("hill"),
        knownGap: "to-payload busca subrazas bajo el prop `race`, donde no viven",
      },
      { what: "clase", ok: payload.classes?.[0]?.ref?.hash === "fighter_phb" },
      { what: "nivel", ok: payload.classes?.[0]?.level === audited.level },
      { what: "subclase", ok: Boolean(payload.classes?.[0]?.subclass?.hash) },
      { what: "trasfondo", ok: Boolean(payload.background?.ref?.hash) },
      { what: "habilidades", ok: (payload.proficiencies?.skills?.length ?? 0) >= 2 },
      { what: "idiomas", ok: (payload.proficiencies?.languages?.length ?? 0) >= 1 },
      { what: "herramientas", ok: (payload.proficiencies?.tools?.length ?? 0) >= 1 },
      { what: "salvaciones", ok: (payload.proficiencies?.savingThrows?.length ?? 0) === 2 },
      {
        what: "expertise",
        ok: (payload.proficiencies?.expertise?.length ?? 0) > 0,
        knownGap: "partitionProficiencies nunca escribe en expertise; el kind no existe en el schema",
      },
      { what: "dotes", ok: (payload.feats?.length ?? 0) >= 1 },
      { what: "dones", ok: (payload.optionalFeatures?.length ?? 0) >= 1 },
      { what: "equipo", ok: (payload.equipment?.length ?? 0) >= 2 },
      { what: "puntos de golpe", ok: typeof payload.derived?.hp === "number" },
      { what: "clase de armadura", ok: typeof payload.derived?.ac === "number" },
      { what: "bonificador", ok: typeof payload.derived?.proficiencyBonus === "number" },
      // Every source of an ability score, added by hand:
      //   FUE  15 tirada  +2 especie  +2 nivel 4  +1 nivel 8            = 20
      //   SAB  12 tirada  +1 por la media-dote Resilient                = 13
      // A wrong number here is the worst failure this project has, because the
      // sheet keeps showing it confidently.
      {
        what: `caracteristicas (FUE ${payload.abilities?.str}, SAB ${payload.abilities?.wis})`,
        ok: payload.abilities?.str === 20 && payload.abilities?.wis === 13,
      },
    ]
  : [];

console.log("\nQue del personaje llega al payload:");
let silent = 0;
let fixedUpstream = 0;

for (const check of checks) {
  if (check.ok && check.knownGap) {
    fixedUpstream += 1;
    console.log(`  ARREGLADO  ${check.what.padEnd(24)} ya cruza — borrar la excepcion`);
  } else if (check.ok) {
    console.log(`  ok         ${check.what}`);
  } else if (check.knownGap) {
    console.log(`  hueco repo ${check.what.padEnd(24)} ${check.knownGap}`);
  } else {
    silent += 1;
    console.log(`  PERDIDO    ${check.what.padEnd(24)} no llega y nadie avisa`);
  }
}

if (!payload) console.log("  (el personaje auditado no produjo payload)");

/*
 * The printable sheet, checked as text.
 *
 * This is the one export that never went through a schema, so nothing ever
 * objected to what it printed. Both faults found here — an English
 * `"Language: "` prefix reaching a Spanish document, and sections that were
 * simply absent — were invisible until someone read the markup.
 *
 * Run over every case, because a section only breaks on the character that
 * has the thing: a fighter proves nothing about the spell list.
 */
const sheetFaults: string[] = [];

for (const [tag, state] of cases) {
  const result = resolveDraft(state);
  if (result.status !== "ready") continue;

  let html: string;
  try {
    html = characterSheetHtml(result.snapshot);
  } catch (error) {
    sheetFaults.push(`${tag}: revienta al armar la hoja (${String(error).slice(0, 60)})`);
    continue;
  }

  // A template hole prints the word rather than failing, so the sheet looks
  // finished and says "undefined" where a number belongs.
  for (const hole of ["undefined", "NaN", "[object Object]"]) {
    if (html.includes(hole)) sheetFaults.push(`${tag}: la hoja imprime "${hole}"`);
  }

  if (/Language:/i.test(html)) sheetFaults.push(`${tag}: la hoja imprime el prefijo "Language:"`);
  if (!html.includes("</html>")) sheetFaults.push(`${tag}: la hoja sale cortada`);

  const name = state.characterName.trim();
  if (name && !html.includes(name)) sheetFaults.push(`${tag}: la hoja no lleva el nombre`);

  // Every character has these three, so their absence is a broken template
  // rather than an empty section.
  for (const heading of ["Aptitudes", "Puntos de golpe", "Clase de armadura"]) {
    if (!html.includes(heading)) sheetFaults.push(`${tag}: la hoja no tiene "${heading}"`);
  }

  /*
   * The sections that were missing, asserted present.
   *
   * Checking only for what should be absent is how a check passes by being
   * empty: a sheet that printed nothing at all would clear every rule above.
   * These say what has to be there, for the characters that have it.
   */
  if (state.languagesText.trim()) {
    const language = state.languagesText.trim().split("\n")[0]?.trim() ?? "";
    if (!html.includes("Idiomas")) sheetFaults.push(`${tag}: la hoja no tiene Idiomas`);
    if (language && !html.includes(language)) {
      sheetFaults.push(`${tag}: la hoja pierde el idioma "${language}"`);
    }
  }

  // Every class grants two saving throws at level one, without exception.
  if (state.classId && !html.includes("Salvaciones")) {
    sheetFaults.push(`${tag}: la hoja no tiene Salvaciones`);
  }

  if (state.subraceId && !html.includes("Historia") && !html.includes(titleish(state.subraceId))) {
    sheetFaults.push(`${tag}: la hoja no nombra la subraza`);
  }

  if (state.trait.trim() && !html.includes("Historia")) {
    sheetFaults.push(`${tag}: la hoja no tiene Historia`);
  }
}

/** `"dwarf-hill"` reads as "Dwarf Hill", the way the sheet title-cases it. */
function titleish(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/*
 * The name of the downloaded file.
 *
 * Two names that differ must not produce the same filename: the second
 * download silently overwrites the first, or lands as "(1)", and the player
 * has no idea which character is in which file.
 */
const nameCases: Array<[string, string]> = [
  ["Thorin Escudoroble", "Thorin_Escudoroble"],
  ["José Fernández", "José_Fernández"],
  ["Ünäl", "Ünäl"],
  ["日本語", "日本語"],
  ["Мила", "Мила"],
  ["  espacios  raros  ", "espacios_raros"],
  ["a/b\\c:d", "abcd"],
  ["...", "personaje"],
  ["", "personaje"],
  ["   ", "personaje"],
  [".oculto.", "oculto"],
];

const nameFaults: string[] = [];
for (const [input, expected] of nameCases) {
  const actual = fileSlug(input);
  if (actual !== expected) {
    nameFaults.push(`fileSlug(${JSON.stringify(input)}) = ${JSON.stringify(actual)}, esperaba ${JSON.stringify(expected)}`);
  }
}

// Distinct names, distinct files. The old slug collapsed every non-Latin name
// onto "personaje", so a party of four downloaded one file four times.
const distinct = ["日本語", "Мила", "José", "Jose"];
const slugs = new Set(distinct.map(fileSlug));
if (slugs.size !== distinct.length) {
  nameFaults.push(`${distinct.length} nombres distintos dan ${slugs.size} archivos`);
}

/*
 * What happens when the store answers badly.
 *
 * These paths only run when something is already wrong, which is exactly when
 * nobody is watching them. Casting the response without looking used to mean a
 * store answering `{}` produced a success screen with no code on it.
 */
const storeFaults: string[] = [];
const realFetch = globalThis.fetch;
const realConsoleError = console.error;


async function answersWith(
  body: string,
  init: ResponseInit,
): Promise<{ ok: true; code: string } | { ok: false; message: string }> {
  globalThis.fetch = (async () => new Response(body, init)) as typeof fetch;
  // `readError` logs the server's own words; that is right in the app and
  // noise here.
  console.error = () => {};

  try {
    const published = await publishBuild({} as never, "http://ejemplo.invalido");
    return { ok: true, code: published.code };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  } finally {
    globalThis.fetch = realFetch;
    console.error = realConsoleError;
  }
}

const json = { status: 200, headers: { "Content-Type": "application/json" } };

const storeCases: Array<[string, () => Promise<boolean>, string]> = [
  [
    "codigo valido",
    async () => {
      const r = await answersWith(JSON.stringify({ code: "AB12CD" }), json);
      return r.ok && r.code === "AB12CD";
    },
    "un codigo bueno tiene que pasar",
  ],
  [
    "cuerpo vacio",
    async () => {
      const r = await answersWith("{}", json);
      return !r.ok && r.message.includes("no devolvio un codigo");
    },
    "{} tiene que fallar, no dar exito sin codigo",
  ],
  [
    "codigo en blanco",
    async () => {
      const r = await answersWith(JSON.stringify({ code: "   " }), json);
      return !r.ok;
    },
    "un codigo de espacios no sirve para escribir en Foundry",
  ],
  [
    "no es JSON",
    async () => {
      const r = await answersWith("<html>error</html>", json);
      return !r.ok && r.message.includes("no es JSON");
    },
    "una pagina de error no es una respuesta",
  ],
  [
    "error 500",
    async () => {
      const r = await answersWith(JSON.stringify({ error: "boom" }), { ...json, status: 500 });
      return !r.ok && r.message.includes("del otro lado") && !r.message.includes("boom");
    },
    "el jugador lee castellano, no el texto del Worker",
  ],
  [
    "error 429",
    async () => {
      const r = await answersWith(JSON.stringify({}), { ...json, status: 429 });
      return !r.ok && r.message.includes("Espera");
    },
    "un 429 tiene que decir que espere",
  ],
];

/** Runs at the end: the app's build target has no top-level await. */
async function checkStore() {
  for (const [name, run, why] of storeCases) {
    if (!(await run())) storeFaults.push(`${name}: ${why}`);
  }

  // A trailing slash in the env file would send every request to `//builds`.
  let seen = "";
  globalThis.fetch = (async (input: string | URL | Request) => {
    seen = String(input);
    return new Response(JSON.stringify({ code: "X" }), json);
  }) as typeof fetch;
  await publishBuild({} as never, "http://ejemplo.invalido/");
  globalThis.fetch = realFetch;
  if (seen.includes("//builds")) storeFaults.push(`barra final: pide ${seen}`);

  console.log("\nRespuestas del almacen:");
  if (storeFaults.length === 0) {
    console.log(`  ok  ${storeCases.length + 1} respuestas`);
  } else {
    for (const fault of storeFaults) console.log(`  FALLA  ${fault}`);
  }
}

/*
 * Whether the Gate knows there is work on the anvil.
 *
 * A false negative here is silent data loss: the Gate offers no way back, the
 * player presses the big button, and a character disappears.
 */
// `minimal` already carries a species, class and background, so an actually
// untouched draft has to be built here.
const untouched: BuilderState = {
  ...minimal,
  characterName: "",
  raceId: "",
  classId: "",
  backgroundId: "",
  level: 1,
};

const progressCases: Array<[string, BuilderState, boolean]> = [
  ["borrador intacto", untouched, false],
  ["solo nombre", { ...untouched, characterName: "Alguien" }, true],
  ["solo especie", { ...untouched, raceId: "dwarf" }, true],
  ["solo clase", { ...untouched, classId: "wizard" }, true],
  ["solo trasfondo", { ...untouched, backgroundId: "sage" }, true],
  ["solo nivel subido", { ...untouched, level: 5 }, true],
  ["cargada", loaded, true],
];

const progressFaults: string[] = [];
for (const [name, state, expected] of progressCases) {
  if (hasProgress(state) !== expected) {
    progressFaults.push(`hasProgress(${name}) = ${!expected}, esperaba ${expected}`);
  }
}

/*
 * What a species or class change releases.
 *
 * Measured before the fix: a dwarf wizard switched to elf kept CON 14 and
 * never got the elf's Dexterity, and switched to fighter kept two wizard
 * spells. Both exported as legal characters.
 */
const spellcaster: BuilderState = {
  ...loaded,
  classId: "wizard",
  subclassId: "evocation",
  subraceId: "dwarf-hill",
  cantripsText: "Fire Bolt",
  spellsText: "Nv1: Magic Missile",
  optionalFeatureIds: ["defense"],
};

const afterRace = releasedByPick("race", spellcaster);
const afterClass = releasedByPick("class", spellcaster);

if (Object.keys(afterRace.patch.abilityBonuses ?? { keep: 1 }).length !== 0) {
  progressFaults.push("cambiar de especie no suelta la mejora: el bonus viejo sobrevive");
}
if (afterRace.patch.subraceId !== "") {
  progressFaults.push("cambiar de especie no suelta la subraza");
}
if (afterClass.patch.cantripsText !== "" || afterClass.patch.spellsText !== "") {
  progressFaults.push("cambiar de clase no suelta los conjuros: un guerrero exporta con Bola de Fuego");
}
if ((afterClass.patch.optionalFeatureIds ?? ["x"]).length !== 0) {
  progressFaults.push("cambiar de clase no suelta los dones");
}
// The player has to be told what went; a silent drop is its own bug.
if (afterRace.shed.length === 0 || afterClass.shed.length === 0) {
  progressFaults.push("se sueltan elecciones sin nombrar cuales");
}

/*
 * The 2024 background feat, which almost every background names outright.
 *
 * 55 of 60 grant a fixed feat that is derived from the background itself, so
 * this path needs no player input and nothing would announce it breaking:
 * the character would simply export one feat short.
 */
const bgFeatFaults: string[] = [];
for (const bg of searchBeyondCore("background", "2024", "", 12)) {
  const state: BuilderState = {
    ...untouched,
    rulesVersion: "5e-2024",
    raceId: "dwarf",
    classId: "fighter",
    backgroundId: bg.id,
    sourceBooks: { [`background:${bg.id}`]: bg.source },
  };

  const result = resolveDraft(state);
  if (result.status !== "ready" || !result.payload) {
    bgFeatFaults.push(`${bg.label}: no produjo payload`);
    continue;
  }
  if ((result.payload.feats ?? []).length === 0) {
    bgFeatFaults.push(`${bg.label} [${bg.source}]: el trasfondo no entrego su dote`);
  }
}

/*
 * The 2014 species increase, against the book.
 *
 * The index keeps race and subrace increases apart and expects them summed.
 * Reading only the race gave every subrace character less than the rules
 * grant — a mountain dwarf two Strength short — and the sheet showed the wrong
 * total with no sign anything was missing.
 */
const seedExpected: Array<[string, string, Record<string, number>]> = [
  ["dwarf", "dwarf-hill", { con: 2, wis: 1 }],
  ["dwarf", "dwarf-mountain", { con: 2, str: 2 }],
  ["elf", "elf-wood", { dex: 2, wis: 1 }],
  ["elf", "elf-high", { dex: 2, int: 1 }],
  ["halfling", "halfling-lightfoot", { dex: 2, cha: 1 }],
  ["halfling", "halfling-stout", { dex: 2, con: 1 }],
  ["gnome", "gnome-rock", { int: 2, con: 1 }],
  ["gnome", "gnome-forest", { int: 2, dex: 1 }],
];

const seedFaults: string[] = [];
for (const [raceId, subraceId, expected] of seedExpected) {
  const seed = seedSpeciesBonus({ ...untouched, raceId, subraceId }, "2014");
  if (JSON.stringify(seed) !== JSON.stringify({ ...expected, ...seed, ...expected })) {
    seedFaults.push(`${subraceId}: ${JSON.stringify(seed)}, esperaba ${JSON.stringify(expected)}`);
    continue;
  }
  const sum = (m: Record<string, number>) => Object.values(m).reduce((a, b) => a + b, 0);
  if (sum(seed as Record<string, number>) !== sum(expected)) {
    seedFaults.push(`${subraceId}: total ${sum(seed as Record<string, number>)}, esperaba ${sum(expected)}`);
  }
}

/*
 * The editor's target must match what the species grants.
 *
 * It was a flat 3, which is right for 2024 — the background hands out three
 * points to assign — and wrong for 2014, where the species grants a fixed
 * amount that varies: 3 for most, 4 for a mountain dwarf, 6 for a human. A
 * correct mountain dwarf was shown as "4 / 3" in the colour reserved for
 * something being wrong.
 */
for (const [raceId, subraceId, expected] of seedExpected) {
  const state = { ...untouched, raceId, subraceId };
  const budget = speciesBonusBudgetFor(state, "2014");
  const granted = Object.values(expected).reduce((a, b) => a + b, 0);
  if (budget !== granted) {
    seedFaults.push(`${subraceId}: presupuesto ${budget}, la especie da ${granted}`);
  }
}

// 2024 species grant nothing; the three points come from the background.
if (speciesBonusBudgetFor({ ...untouched, raceId: "dwarf" }, "2024") !== 3) {
  seedFaults.push("2024: el presupuesto del trasfondo deberia ser 3");
}

/*
 * Whole characters, against arithmetic done by hand from the 2014 PHB.
 *
 * Every other check in this file compares the code to itself. These compare it
 * to the book: the hit points, proficiency bonus and save DC are worked out in
 * the comments above each case, so a change that quietly alters a formula has
 * something to fail against.
 */
type WorkedCase = {
  nombre: string;
  state: Partial<BuilderState>;
  espera: { con: number; pg: number; comp: number; cd?: number };
};

const worked: WorkedCase[] = [
  {
    // Enano de la colina, clerigo 5.
    //   CON 14 +2 especie = 16 (+3);  SAB 15 +1 especie = 16 (+3)
    //   PG d8: 8 + 4x5 = 28, mas 5x3 = 15  ->  43
    //   competencia nivel 5 = +3;  CD = 8 + 3 + 3 = 14
    nombre: "enano colina clerigo 5",
    state: {
      raceId: "dwarf", subraceId: "dwarf-hill", classId: "cleric", level: 5,
      str: 10, dex: 12, con: 14, int: 10, wis: 15, cha: 8,
    },
    espera: { con: 16, pg: 43, comp: 3, cd: 14 },
  },
  {
    // Enano de la montana, guerrero 4.
    //   FUE 15 +2 = 17 (+3);  CON 14 +2 = 16 (+3)
    //   PG d10: 10 + 3x6 = 28, mas 4x3 = 12  ->  40
    nombre: "enano montana guerrero 4",
    state: {
      raceId: "dwarf", subraceId: "dwarf-mountain", classId: "fighter", level: 4,
      str: 15, dex: 13, con: 14, int: 10, wis: 12, cha: 8,
    },
    espera: { con: 16, pg: 40, comp: 2 },
  },
  {
    // Alto elfo, mago 3.
    //   DES 14 +2 = 16;  INT 15 +1 = 16 (+3);  CON 13 (+1)
    //   PG d6: 6 + 2x4 = 14, mas 3x1 = 3  ->  17
    //   CD = 8 + 2 + 3 = 13
    nombre: "alto elfo mago 3",
    state: {
      raceId: "elf", subraceId: "elf-high", classId: "wizard", level: 3,
      str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10,
    },
    espera: { con: 13, pg: 17, comp: 2, cd: 13 },
  },
];

const workedFaults: string[] = [];
for (const caso of worked) {
  // A background is required to derive at all, and none of these cases turn on
  // which one it is.
  const sinSemilla = { ...untouched, backgroundId: "soldier", ...caso.state } as BuilderState;
  const state: BuilderState = {
    ...sinSemilla,
    abilityBonuses: seedSpeciesBonus(sinSemilla, "2014"),
  };

  const r = resolveDraft(state);
  if (r.status !== "ready") {
    workedFaults.push(`${caso.nombre}: no deriva`);
    continue;
  }

  const d = r.snapshot.derived;
  const con = r.snapshot.abilities.final.con;
  const cd = d.spellcasting?.saveDC;

  if (con !== caso.espera.con) workedFaults.push(`${caso.nombre}: CON ${con}, el manual da ${caso.espera.con}`);
  if (d.hp !== caso.espera.pg) workedFaults.push(`${caso.nombre}: PG ${d.hp}, la cuenta da ${caso.espera.pg}`);
  if (d.proficiencyBonus !== caso.espera.comp) {
    workedFaults.push(`${caso.nombre}: competencia +${d.proficiencyBonus}, la tabla da +${caso.espera.comp}`);
  }
  if (caso.espera.cd !== undefined && cd !== caso.espera.cd) {
    workedFaults.push(`${caso.nombre}: CD ${cd}, la cuenta da ${caso.espera.cd}`);
  }
}

/*
 * The counsel layer, against the optimization guide's own arithmetic.
 *
 * The panel states a character's attack bonus and save DC. Both are sums the
 * player will check against their own sheet, so an arithmetic slip here is a
 * number they will trust and act on.
 */
const counselFaults: string[] = [];

// The proficiency table is printed in the guide; no interpretation involved.
for (const [level, expected] of [
  [1, 2], [4, 2], [5, 3], [8, 3], [9, 4], [12, 4], [13, 5], [16, 5], [17, 6], [20, 6],
] as Array<[number, number]>) {
  if (proficiencyAt(level) !== expected) {
    counselFaults.push(`competencia nivel ${level}: ${proficiencyAt(level)}, la tabla da ${expected}`);
  }
}

{
  // Mago nivel 1, INT 15 + 1 humano = 16 (+3), competencia +2.
  //   ataque = 2 + 3 = +5
  //   CD     = 8 + 2 + 3 = 13
  const draft: BuilderState = {
    ...untouched, backgroundId: "soldier",
    raceId: "human", classId: "wizard", level: 1,
    str: 8, dex: 14, con: 14, int: 15, wis: 12, cha: 10,
  };
  const state = { ...draft, abilityBonuses: seedSpeciesBonus(draft, "2014") };
  const advice = counselFor(buildCanonicalSnapshot(state), state, "2014", []);

  const ataque = advice.find((a) => a.id === "ataque");
  if (!ataque?.title.startsWith("+5")) counselFaults.push(`ataque: "${ataque?.title}", la cuenta da +5`);
  if (!advice.find((a) => a.id === "cd")?.title.includes("13")) {
    counselFaults.push("la CD deberia ser 13");
  }
  // Nothing is wrong with this build, so nothing should be flagged.
  if (advice.some((a) => a.kind === "smell")) {
    counselFaults.push("marca un olor en un mago sano");
  }
}

{
  // INT 12 y CON 8: los dos olores que la guia nombra.
  const draft: BuilderState = {
    ...untouched, backgroundId: "soldier",
    raceId: "human", classId: "wizard", level: 1,
    str: 8, dex: 14, con: 7, int: 11, wis: 12, cha: 10,
  };
  const state = { ...draft, abilityBonuses: seedSpeciesBonus(draft, "2014") };
  const advice = counselFor(buildCanonicalSnapshot(state), state, "2014", []);

  if (!advice.some((a) => a.id === "principal-baja")) {
    counselFaults.push("no avisa que la caracteristica principal esta bajo 16");
  }
  if (!advice.some((a) => a.id === "con-baja")) {
    counselFaults.push("no avisa una Constitucion dejada de lado");
  }
}

{
  // Tres conjuros de concentracion en un clerigo: solo uno puede correr.
  const conc = concentrationAmong(["Nv1: Bless", "Nv2: Hold Person", "Nv3: Spirit Guardians"], "2014");
  if (conc.length !== 3) {
    counselFaults.push(`concentracion detectada en ${conc.length} de 3 conjuros`);
  }
  if (concentrationAmong(["Nv3: Fireball", "Nv1: Shield"], "2014").length !== 0) {
    counselFaults.push("marca concentracion en conjuros que no la piden");
  }
}

/*
 * The concentration save, and which feat protects it at which level.
 *
 * The crossover in `counsel.ts` is arithmetic, so it is checked as arithmetic:
 * advantage on a roll that succeeds with chance `q` is worth `q * (1 - q)`,
 * proficiency is worth a flat `p / 20`, and the advice must name whichever is
 * larger at the character's own level. Against the DC 10 that most hits
 * produce this puts the switch at level 13, or level 9 once Constitution
 * reaches 18 and the unaided chance is already high enough that doubling the
 * die buys less than a flat +4.
 */
{
  const conCon = (con: number, level: number, extra: Partial<BuilderState> = {}) => {
    const draft: BuilderState = {
      ...untouched, backgroundId: "soldier",
      raceId: "human", classId: "wizard", level,
      str: 8, dex: 14, con, int: 16, wis: 12, cha: 10,
      spellsText: "Nv1: Bless",
      ...extra,
    };
    const state = { ...draft, abilityBonuses: seedSpeciesBonus(draft, "2014") };
    const lineas = state.spellsText.split("\n").filter(Boolean);
    return counselFor(
      buildCanonicalSnapshot(state), state, "2014",
      concentrationAmong(lineas, "2014"), actionProfile(lineas, "2014"),
    );
  };
  const dice = (advice: ReturnType<typeof conCon>) =>
    advice.find((a) => a.id === "salvacion-concentracion")?.detail ?? "";

  // Mago: la clase da Inteligencia y Sabiduria, nunca Constitucion.
  if (!dice(conCon(14, 5))) {
    counselFaults.push("no avisa que un mago concentra sin competencia en Constitucion");
  }
  // La formula, en los dos lados de su propio cruce.
  for (const [con, level, feat] of [
    [14, 5, "Lanzador de Guerra"], [14, 12, "Lanzador de Guerra"],
    [14, 13, "Resiliencia"], [18, 9, "Resiliencia"], [18, 8, "Lanzador de Guerra"],
  ] as Array<[number, number, string]>) {
    if (!dice(conCon(con, level)).includes(feat)) {
      counselFaults.push(`CON ${con} nivel ${level}: deberia nombrar ${feat}`);
    }
  }

  // Un barbaro tiene la salvacion por clase: no hay hueco que tapar.
  if (dice(conCon(14, 5, { classId: "barbarian" }))) {
    counselFaults.push("avisa del hueco a una clase que ya tiene la salvacion");
  }
  // Ni a quien ya gasto la dote, en cualquiera de las dos formas.
  if (dice(conCon(14, 5, { levelChoices: { 4: { kind: "feat", featId: "war-caster" } } }))) {
    counselFaults.push("avisa teniendo Lanzador de Guerra");
  }
  if (
    dice(conCon(14, 13, {
      levelChoices: { 4: { kind: "feat", featId: "resilient" } },
      featAbilityChoices: { resilient: { con: 1 } },
    }))
  ) {
    counselFaults.push("avisa teniendo Resiliencia (Constitucion)");
  }
  // Resiliencia apuntada a otra cosa no tapa este hueco.
  if (
    !dice(conCon(14, 13, {
      levelChoices: { 4: { kind: "feat", featId: "resilient" } },
      featAbilityChoices: { resilient: { dex: 1 } },
    }))
  ) {
    counselFaults.push("cuenta Resiliencia (Destreza) como si protegiera la concentracion");
  }
  // Y sin nada que concentrar, el hueco no existe.
  if (dice(conCon(14, 5, { spellsText: "Nv3: Fireball" }))) {
    counselFaults.push("avisa de la concentracion a quien no concentra nada");
  }
}

/*
 * Action economy — what the guide puts first.
 *
 * The casting times come from the index, so what is checked here is that each
 * spell lands in the right pile and that the counsel fires on the shape of the
 * pile rather than on its size. The four spells below are chosen because their
 * casting times are printed in the manual and are not going to move: Fireball
 * an action, Misty Step a bonus action, Shield a reaction, Identify a minute.
 */
{
  const perfil = actionProfile(
    ["Nv3: Fireball", "Nv2: Misty Step", "Nv1: Shield", "Nv1: Identify"],
    "2014",
  );
  const esperado: Array<[keyof typeof perfil, string]> = [
    ["action", "Fireball"],
    ["bonus", "Misty Step"],
    ["reaction", "Shield"],
    ["long", "Identify"],
  ];
  for (const [pila, conjuro] of esperado) {
    if (!perfil[pila].includes(conjuro)) {
      counselFaults.push(`${conjuro} no cayo en "${pila}"`);
    }
  }
  if (perfil.unknown.length !== 0) {
    counselFaults.push(`el indice no ubico ${perfil.unknown.join(", ")}`);
  }

  // Cantrips arrive as bare names, not as "Nv1: ...". Both forms must parse.
  if (!actionProfile(["Fire Bolt"], "2014").action.includes("Fire Bolt")) {
    counselFaults.push("no ubica un truco escrito sin nivel");
  }
}

{
  /*
   * The no-reaction smell, at its edge on both sides.
   *
   * Held until four combat spells: below that the absence says nothing, and a
   * check that fires on a level 1 caster with two spells would be noise. The
   * long-casting one must not push the count over the line, because a spell
   * that takes a minute is not part of any turn.
   */
  const base: BuilderState = {
    ...untouched, backgroundId: "soldier",
    raceId: "human", classId: "wizard", level: 5,
    str: 8, dex: 14, con: 14, int: 15, wis: 12, cha: 10,
  };
  const conLista = (spells: string[]) => {
    const draft = { ...base, spellsText: spells.join("\n") };
    const state = { ...draft, abilityBonuses: seedSpeciesBonus(draft, "2014") };
    return counselFor(
      buildCanonicalSnapshot(state), state, "2014",
      concentrationAmong(spells, "2014"), actionProfile(spells, "2014"),
    );
  };

  const cuatroDeAccion = ["Nv3: Fireball", "Nv1: Magic Missile", "Nv2: Scorching Ray", "Nv1: Mage Armor"];
  if (!conLista(cuatroDeAccion).some((a) => a.id === "sin-reaccion")) {
    counselFaults.push("no avisa que la reaccion queda sin usar");
  }
  if (conLista(cuatroDeAccion.slice(0, 3)).some((a) => a.id === "sin-reaccion")) {
    counselFaults.push("avisa de la reaccion con una lista todavia corta");
  }
  if (conLista([...cuatroDeAccion, "Nv1: Shield"]).some((a) => a.id === "sin-reaccion")) {
    counselFaults.push("avisa de la reaccion teniendo Escudo");
  }
  // Tres de accion mas Identify: sigue siendo una lista corta para el turno.
  if (conLista([...cuatroDeAccion.slice(0, 3), "Nv1: Identify"]).some((a) => a.id === "sin-reaccion")) {
    counselFaults.push("cuenta un conjuro de un minuto como parte del turno");
  }

  // El reparto se dice siempre que haya algo que repartir, y con los numeros.
  const reparto = conLista([...cuatroDeAccion, "Nv1: Shield"]).find((a) => a.id === "reparto");
  if (!reparto?.title.startsWith("4 accion") || !reparto.title.includes("1 reaccion")) {
    counselFaults.push(`reparto: "${reparto?.title}", deberia ser 4 accion / 0 adicional / 1 reaccion`);
  }
  if (conLista([]).some((a) => a.id === "reparto")) {
    counselFaults.push("reparte un turno sin conjuros");
  }

  // Tres de accion adicional se pisan entre si; dos todavia no.
  const tresAdicionales = ["Nv1: Healing Word", "Nv2: Misty Step", "Nv1: Hex"];
  if (!conLista(tresAdicionales).some((a) => a.id === "adicional-lleno")) {
    counselFaults.push("no avisa de tres conjuros de accion adicional");
  }
  if (conLista(tresAdicionales.slice(0, 2)).some((a) => a.id === "adicional-lleno")) {
    counselFaults.push("avisa de accion adicional con solo dos");
  }
}

/*
 * The Vision — the cheat sheet, narrowed to one character.
 *
 * What is checked is the join, because the join is the fragile part. The
 * prose was written against names a player says out loud ("Berserker",
 * "Life") and the index stores names as printed ("Path of the Berserker",
 * "Life Domain"), so every one of the 101 written subclasses has to survive
 * being picked in the Forge and then read back out of the tome.
 *
 * A silent drop here costs a subclass its whole page and nothing complains,
 * which is exactly the kind of rot a count catches and a spot check does not.
 */
const visionFaults: string[] = [];

{
  const anyone: BuilderState = {
    ...untouched, backgroundId: "soldier",
    raceId: "human", classId: "fighter", level: 5,
    str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8,
  };

  let reached = 0;
  const lost: string[] = [];

  for (const classId of Object.keys(CLASS_NOTES)) {
    const cls = entryById("class", "2014", classId);
    if (!cls) { lost.push(`${classId}: la clase no esta en el indice`); continue; }

    const alone = playbookFor({ ...anyone, classId }, null, "2014");

    for (const spoken of Object.keys(CLASS_NOTES[classId]!.subclasses)) {
      const wanted = spoken.toLowerCase();
      const printed = subclassesFor(cls.label, "2014").find((entry) => {
        const label = entry.label.toLowerCase();
        return label === wanted || label.endsWith(` ${wanted}`) || label.startsWith(`${wanted} `);
      });
      if (!printed) { lost.push(`${classId}/${spoken}: sin subclase en el indice`); continue; }

      const book = playbookFor(
        {
          ...anyone,
          classId,
          subclassId: printed.id,
          sourceBooks: { [`subclass:${printed.id}`]: printed.source },
        },
        null,
        "2014",
      );

      // Picking the subclass has to add something the class alone did not.
      if (book.features.length > alone.features.length || book.tips.length > alone.tips.length) {
        reached++;
      } else {
        lost.push(`${classId}/${spoken} -> ${printed.label}`);
      }
    }
  }

  if (lost.length > 0) {
    visionFaults.push(`${reached} de ${reached + lost.length} subclases llegan al tomo`);
    for (const entry of lost.slice(0, 6)) visionFaults.push(`   ${entry}`);
  }

  /*
   * The combinations, on characters built to trigger exactly one.
   *
   * Both directions each time: a character who assembles the combination sees
   * it, and a character one piece short does not. A combination panel that
   * fires on everyone is the same as no panel.
   */
  const combosOf = (patch: Partial<BuilderState>) =>
    playbookFor({ ...anyone, ...patch }, null, "2014").combos.map((entry) => entry.id);

  const expect = (label: string, patch: Partial<BuilderState>, ids: string[]) => {
    const got = combosOf(patch);
    if (got.join(",") !== ids.join(",")) {
      visionFaults.push(`combos de ${label}: [${got.join(", ")}], esperaba [${ids.join(", ")}]`);
    }
  };

  expect("fighter con GWM", {
    classId: "fighter", levelChoices: { 4: { kind: "feat", featId: "great-weapon-master" } },
  }, ["gwm_action_surge"]);
  expect("fighter sin dotes", { classId: "fighter" }, []);
  expect("rogue con Mobile", {
    classId: "rogue", levelChoices: { 4: { kind: "feat", featId: "mobile" } },
  }, ["mobile_rogue"]);
  // Resiliencia cuenta solo apuntada a Constitucion, que es la unica escrita.
  expect("Resiliencia (CON) + Lanzador de Guerra", {
    levelChoices: { 4: { kind: "feat", featId: "resilient" }, 6: { kind: "feat", featId: "war-caster" } },
    featAbilityChoices: { resilient: { con: 1 } },
  }, ["resilient_warcaster"]);
  expect("Resiliencia (DES) + Lanzador de Guerra", {
    levelChoices: { 4: { kind: "feat", featId: "resilient" }, 6: { kind: "feat", featId: "war-caster" } },
    featAbilityChoices: { resilient: { dex: 1 } },
  }, []);

  // Una clase que la hoja no cubre se declara vacia, no se rellena.
  const artificer = playbookFor({ ...anyone, classId: "artificer" }, null, "2014");
  if (!artificer.unwritten || artificer.features.length > 0) {
    visionFaults.push("el artificiero no se declara sin escribir");
  }
}

/*
 * The three tabs.
 *
 * The cheat sheet has no tab field, so the split is inferred from prose, and
 * an inference over 187 notes is exactly the kind of thing that rots without
 * anyone noticing. The counts are pinned: change the sheet, or change the
 * pattern, and this says so instead of quietly emptying a page.
 *
 * The anchors below are the notes the classifier got wrong at least once
 * while it was being written, which makes them the ones worth watching.
 */
{
  const counts: Record<string, number> = { core: 0, combate: 0, movimiento: 0 };
  for (const notes of Object.values(CLASS_NOTES)) {
    const every = [
      ...notes.bonusActions,
      ...notes.reactions,
      ...notes.classFeatures,
      ...Object.values(notes.subclasses).flatMap((sub) => sub.extra),
    ];
    for (const note of every) counts[tabForNote(note)] = (counts[tabForNote(note)] ?? 0) + 1;
  }

  const total = counts.core! + counts.combate! + counts.movimiento!;
  if (total !== 187) visionFaults.push(`las notas suman ${total}, eran 187`);
  if (counts.movimiento !== 22) {
    visionFaults.push(`${counts.movimiento} notas en movimiento, eran 22`);
  }

  // Los ocho ataques de oportunidad son el ancla del reparto: si dejan de caer
  // en movimiento, la pestana pierde su contenido principal.
  const oportunidad = Object.values(CLASS_NOTES)
    .flatMap((notes) => notes.reactions)
    .filter((note) => note.name === "Ataque de oportunidad");
  if (oportunidad.length !== 8) {
    visionFaults.push(`${oportunidad.length} ataques de oportunidad, eran 8`);
  }
  if (oportunidad.some((note) => tabForNote(note) !== "movimiento")) {
    visionFaults.push("un ataque de oportunidad no cayo en movimiento");
  }

  /*
   * Las dotes que el clasificador archivo mal alguna vez.
   *
   * War Caster y Martial Adept caian en movimiento porque su `tip` nombra a
   * Sentinel y a Trip Attack — vocabulario de otra dote. Bladesong caia por
   * un "+10ft velocidad" que es uno de cuatro extras, no el tema de la nota.
   */
  for (const [name, tab] of [
    ["Mobile", "movimiento"], ["Sentinel", "movimiento"], ["Charger", "movimiento"],
    ["Mage Slayer", "combate"], ["Martial Adept", "combate"],
    ["Great Weapon Master", "combate"], ["Sharpshooter", "combate"],
    ["Tough", "core"], ["Lucky", "core"], ["Resilient (CON)", "core"],
  ] as Array<[string, string]>) {
    const note = FEAT_NOTES[name];
    if (!note) { visionFaults.push(`la dote "${name}" ya no esta en la hoja`); continue; }
    const got = tabForFeat(name, note);
    if (got !== tab) visionFaults.push(`la dote "${name}" cayo en ${got}, deberia ir a ${tab}`);
  }

  // Las once reglas universales se reparten dos a movimiento, nueve a core.
  const reglas = UNIVERSAL_RULES.flatMap((block) => block.items);
  const enMovimiento = reglas.filter((item) => tabForRule(item.label) === "movimiento");
  if (reglas.length !== 11) visionFaults.push(`${reglas.length} reglas universales, eran 11`);
  if (enMovimiento.map((item) => item.label).join(",") !== "MOVIMIENTO,Empujar/Agarre") {
    visionFaults.push(
      `reglas en movimiento: ${enMovimiento.map((i) => i.label).join(", ") || "ninguna"}`,
    );
  }
}

/*
 * Reading a Foundry actor back in.
 *
 * Against a real export rather than a hand-written stub: Rathma Utgard, a
 * level 5 paladin with 90 items, a Kender out of Dragonlance, a Rune Carver
 * background out of Bigby's, three feats and forty spells. A fixture written
 * by the same hand as the parser proves only that the hand is consistent.
 *
 * Every assertion here is a thing that was wrong once.
 */
const actorFaults: string[] = [];

{
  // Relative to the package root, not to this file: the probe is bundled into
  // `.probe/` before it runs, so `import.meta.url` points at the build output.
  const raw = JSON.parse(readFileSync("probes/fixtures/rathma-paladin-5.json", "utf8"));
  const report = readFoundryActor(raw);

  if (!report) {
    actorFaults.push("no reconocio a Rathma como personaje");
  } else {
    const { state, unresolved } = report;

    if (unresolved.length > 0) {
      actorFaults.push(`${unresolved.length} sin resolver: ${unresolved.join(" | ")}`);
    }

    // La edicion sale del archivo, no se pregunta.
    for (const [label, got, want] of [
      ["nombre", state.characterName, "Rathma Utgard"],
      ["edicion", state.rulesVersion, "5e-2014"],
      ["clase", state.classId, "paladin"],
      ["subclase", state.subclassId, "oath-of-the-ancients"],
      ["raza", state.raceId, "kender"],
      ["trasfondo", state.backgroundId, "rune-carver"],
      ["arma", state.weaponId, "shatterspike"],
      ["armadura", state.armorId, "plate-armor"],
    ] as Array<[string, string, string]>) {
      if (got !== want) actorFaults.push(`${label}: "${got}", esperaba "${want}"`);
    }

    if (state.level !== 5) actorFaults.push(`nivel ${state.level}, esperaba 5`);

    /*
     * Los puntajes entran como base sin bonus encima.
     *
     * Los de Foundry ya son finales. Sembrarle el bonus racial arriba le
     * sumaria dos puntos a una caracteristica que el jugador nunca subio.
     */
    const scores = `${state.str} ${state.dex} ${state.con} ${state.int} ${state.wis} ${state.cha}`;
    if (scores !== "18 15 15 11 12 18") actorFaults.push(`puntajes ${scores}, esperaba 18 15 15 11 12 18`);
    if (Object.keys(state.abilityBonuses).length > 0) {
      actorFaults.push("le sembro bonus de especie encima de puntajes que ya eran finales");
    }

    /*
     * Tres dotes y un solo nivel de mejora.
     *
     * Un paladin nivel 5 mejora una vez, en el nivel 4, y Rathma tiene tres
     * dotes: una la da el trasfondo, otra ocupa la mejora, y la tercera va al
     * hueco de dote libre. Cuando esto solo miraba los niveles de mejora, dos
     * de las tres se reportaban como imposibles de ubicar.
     */
    if (state.backgroundFeatId !== "rune-shaper") {
      actorFaults.push(`dote de trasfondo "${state.backgroundFeatId}", esperaba rune-shaper`);
    }
    if (state.levelChoices[4]?.kind !== "feat" || state.levelChoices[4]?.featId !== "alert") {
      actorFaults.push("la mejora de nivel 4 deberia ser Alert");
    }
    if (state.featId !== "crusher") {
      actorFaults.push(`dote libre "${state.featId}", esperaba crusher`);
    }

    /*
     * Los rasgos raciales y de clase no son dotes.
     *
     * dnd5e archiva "Divine Smite" y "Kender Curiosity" como items de tipo
     * `feat` igual que Alert. Son 26 en esta ficha y solo 3 son dotes de
     * verdad; `system.type.value` es lo unico que las separa.
     */
    const dotes = [
      state.backgroundFeatId,
      state.featId,
      ...Object.values(state.levelChoices).map((c) => (c.kind === "feat" ? c.featId : "")),
    ].filter(Boolean);
    if (dotes.length !== 3) actorFaults.push(`${dotes.length} dotes, esperaba 3`);
    if (dotes.some((id) => id === "divine-smite" || id === "kender-curiosity")) {
      actorFaults.push("tomo un rasgo de clase o de raza como si fuera una dote");
    }

    const conjuros = state.spellsText.split("\n").filter(Boolean);
    if (conjuros.length !== 40) actorFaults.push(`${conjuros.length} conjuros, esperaba 40`);

    // Y tiene que derivar, que es lo unico que prueba que el estado sirve.
    const draft = resolveDraft(state);
    if (draft.status !== "ready") {
      actorFaults.push("el personaje importado no deriva");
    } else {
      if (draft.problems.length > 0) {
        actorFaults.push(`${draft.problems.length} elecciones sin resolver en el payload`);
      }
      if (draft.snapshot.derived.ac !== 18) {
        actorFaults.push(`CA ${draft.snapshot.derived.ac}, esperaba 18 (placa 18)`);
      }
      /*
       * PG 44 contra los 60 que decia Foundry.
       *
       * No es un fallo del importador: 44 es el promedio fijo (10 + 4x6 +
       * 5x2) y 60 es el maximo (10 + 4x10 + 5x2). Rathma se subio con max
       * roll y el builder siempre promedia, porque todavia no ofrece elegir
       * el metodo. Queda fijado aca para que el dia que se agregue, esto
       * falle y obligue a mirarlo.
       */
      if (draft.snapshot.derived.hp !== 44) {
        actorFaults.push(
          `PG ${draft.snapshot.derived.hp}: era 44 con promedio fijo. Si ya se elige metodo de PG, actualizar.`,
        );
      }
    }
  }

  // Lo que no es un personaje se rechaza, en vez de entrar a medias.
  for (const [label, value] of [
    ["un monstruo", { type: "npc", items: [] }],
    ["un json cualquiera", { hola: "mundo" }],
    ["null", null],
  ] as Array<[string, unknown]>) {
    if (readFoundryActor(value) !== null) actorFaults.push(`acepto ${label} como personaje`);
  }
}

/*
 * What a background hands you, across all of them.
 *
 * The Origin chamber used to show a name and a book, so choosing among 161
 * backgrounds meant choosing among 161 strings. All of this was already in the
 * index. What is checked is that the flattening survives every row shape —
 * measured across 152 rows and 231 options, in four entry kinds — rather than
 * the one background someone happened to open.
 */
const grantFaults: string[] = [];

{
  /*
   * Counted per edition, because a background is only ever looked up under
   * the rules it is legal in. Concatenating the two lists and guessing the
   * edition off the source book was the first version of this, and it looked
   * up 2014 rows under 2024 and undercounted by forty.
   *
   * The numbers are measured, not floors picked by feel. 2024 is the tidy
   * edition: every one of its sixty backgrounds prints both a skill grant and
   * an equipment list. 2014 is the long tail — 101 backgrounds across every
   * setting book, and the ones from campaign settings often print neither.
   */
  const expected: Record<string, { total: number; skills: number; gear: number }> = {
    "2014": { total: 101, skills: 72, gear: 74 },
    "2024": { total: 60, skills: 60, gear: 60 },
  };

  for (const rules of ["2014", "2024"] as RulesVersion[]) {
    const all = allOptions("background", rules);
    let withSkills = 0;
    let withGear = 0;
    const empty: string[] = [];

    for (const entry of all) {
      const grant = proficiencyGrantForBackground(entry.id, rules, entry.source);
      const gear = startingEquipmentForBackground(entry.id, rules, entry.source);

      if (grant.skillsGranted.length > 0) withSkills++;
      if (gear.length > 0) withGear++;

      // A flattened line that came out blank means an entry kind fell through
      // the switch — the failure mode this exists to catch.
      if (gear.some((line) => !line.trim())) empty.push(entry.label);
    }

    if (empty.length > 0) {
      grantFaults.push(
        `${rules}: ${empty.length} con lineas de equipo vacias (${empty.slice(0, 3).join(", ")})`,
      );
    }

    const want = expected[rules]!;
    if (all.length !== want.total) grantFaults.push(`${rules}: ${all.length} trasfondos, eran ${want.total}`);
    if (withSkills !== want.skills) {
      grantFaults.push(`${rules}: ${withSkills} otorgan competencias, eran ${want.skills}`);
    }
    if (withGear !== want.gear) {
      grantFaults.push(`${rules}: ${withGear} traen equipo, eran ${want.gear}`);
    }
  }

  // El acolito es el caso conocido: dos competencias fijas y equipo con las
  // cuatro formas de entrada a la vez.
  const acolito = proficiencyGrantForBackground("acolyte", "2014", "PHB");
  if (acolito.skillsGranted.join(",") !== "Insight,Religion") {
    grantFaults.push(`acolito otorga ${acolito.skillsGranted.join(", ")}, esperaba Insight y Religion`);
  }
  const equipo = startingEquipmentForBackground("acolyte", "2014", "PHB");
  if (equipo.length === 0) grantFaults.push("el acolito no trae equipo inicial");

  // Las clases usan el mismo aplanador, y 27 de 31 imprimen equipo.
  const conEquipo = allOptions("class", "2014").filter(
    (entry) => startingEquipmentForClass(entry.id, "2014").length > 0,
  );
  if (conEquipo.length < 12) {
    grantFaults.push(`solo ${conEquipo.length} clases 2014 traen equipo inicial`);
  }
}

/*
 * The four ways of making six numbers.
 *
 * These are printed tables, so they are checked against the printed values
 * rather than against whatever the code happens to return. The two jumps in
 * the point buy cost — 13 to 14, and 14 to 15 — are the whole mechanism, and
 * a table that lost them would still look plausible while quietly making a 15
 * cost the same as a 13.
 */
const statFaults: string[] = [];

{
  // El arreglo estandar, tal cual sale impreso.
  if (STANDARD_ARRAY.join(",") !== "15,14,13,12,10,8") {
    statFaults.push(`arreglo estandar ${STANDARD_ARRAY.join(", ")}`);
  }

  for (const [score, cost] of [
    [8, 0], [9, 1], [10, 2], [11, 3], [12, 4], [13, 5], [14, 7], [15, 9],
  ] as Array<[number, number]>) {
    if (pointBuyCost(score) !== cost) {
      statFaults.push(`comprar un ${score} cuesta ${pointBuyCost(score)}, la tabla dice ${cost}`);
    }
  }
  // Fuera de la tabla no se vende nada, ni por abajo ni por arriba.
  for (const score of [7, 16, 18]) {
    if (pointBuyCost(score) !== null) statFaults.push(`la compra de puntos vende un ${score}`);
  }

  /*
   * El reparto que la guia recomienda tiene que entrar justo en el presupuesto.
   *
   * 15/14/13/12/10/8 sale 9+7+5+4+2+0 = 27, o sea exactamente los 27 puntos.
   * Que sea exacto no es casualidad: es el reparto que el sistema esta armado
   * para que puedas pagar, y por eso la guia lo nombra.
   */
  const recomendado = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };
  if (pointBuySpent(recomendado) !== 27) {
    statFaults.push(`15/14/13/12/10/8 cuesta ${pointBuySpent(recomendado)}, deberia costar 27`);
  }
  // Y el piso no cuesta nada.
  if (pointBuySpent(pointBuyFloor()) !== 0) statFaults.push("el piso de 8 en todo cuesta puntos");

  /*
   * Subir se corta cuando el paso no entra, no cuando el puntaje no entra.
   *
   * Con 26 gastados y un 13 encima, subir a 14 cuesta 2 y solo queda 1: no se
   * puede. Una version que mirara el costo del puntaje en vez del costo del
   * paso lo dejaria pasar.
   */
  const casi = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };
  if (canRaise(casi, "con")) statFaults.push("deja subir de 13 a 14 sin puntos para pagar el salto");
  if (canRaise(casi, "str")) statFaults.push("deja pasar de 15, que es el tope");
  if (!canLower(casi, "str")) statFaults.push("no deja bajar un 15");
  if (canLower(casi, "cha")) statFaults.push("deja bajar de 8, que es el piso");

  /*
   * La tirada: 4d6 descartando el menor cae entre 3 y 18, nunca fuera.
   *
   * Mil tiradas alcanzan para que un limite mal puesto salga; el promedio se
   * comprueba flojo porque es aleatorio y un rango estrecho fallaria solo.
   */
  const muestras = Array.from({ length: 1000 }, () => rollOneScore());
  const fuera = muestras.filter((score) => score < 3 || score > 18);
  if (fuera.length > 0) statFaults.push(`${fuera.length} tiradas fuera de 3..18`);

  const promedio = muestras.reduce((total, score) => total + score, 0) / muestras.length;
  // 4d6 drop lowest promedia 12.24; con mil muestras no se aleja un punto.
  if (promedio < 11.2 || promedio > 13.3) {
    statFaults.push(`promedio de tirada ${promedio.toFixed(2)}, esperaba cerca de 12.24`);
  }
  if (rollSix().length !== 6) statFaults.push("una tirada completa no da seis puntajes");

  // La suma de modificadores del arreglo estandar: +2+2+1+1+0-1 = 5.
  if (spreadWorth([...STANDARD_ARRAY]) !== 5) {
    statFaults.push(`el arreglo estandar suma ${spreadWorth([...STANDARD_ARRAY])} de modificador`);
  }
}

/*
 * De donde salio cada punto.
 *
 * La hoja viva muestra el desglose — base, especie, mejoras, dotes — y el
 * export manda `final`. Son dos caminos hacia el mismo numero, asi que lo que
 * hay que probar es que no se separen: si el desglose suma 19 y el export
 * manda 20, el jugador esta mirando un personaje que no existe.
 *
 * Se comprueba sobre la ficha cargada, que tiene las cuatro fuentes a la vez:
 * un enano de colina (especie), tres mejoras de nivel, y Resilient apuntado a
 * Sabiduria (media dote).
 */
const sourceFaults: string[] = [];

{
  const sources = abilitySources(loaded);
  const snapshot = buildCanonicalSnapshot(loaded);

  for (const ability of ABILITY_IDS) {
    const source = sources[ability];
    const exported = snapshot.abilities.final[ability];

    if (source.final !== exported) {
      sourceFaults.push(
        `${ability}: el desglose dice ${source.final} y el export manda ${exported}`,
      );
    }
    if (source.base !== snapshot.abilities.base[ability]) {
      sourceFaults.push(`${ability}: la base del desglose no es la del export`);
    }
  }

  // Las cuatro fuentes, una por una, contra la ficha de arriba.
  if (sources.str.base !== 15) sourceFaults.push(`base de fuerza ${sources.str.base}, esperaba 15`);
  if (sources.str.species !== 2) sourceFaults.push(`especie en fuerza ${sources.str.species}`);
  // Mejoras de nivel 4 (+2) y 8 (+1). La de 12 va a Constitucion.
  if (sources.str.improvements !== 3) {
    sourceFaults.push(`mejoras en fuerza ${sources.str.improvements}, esperaba 3`);
  }
  // Resilient apuntado a Sabiduria: la unica media dote de esta ficha.
  if (sources.wis.feats !== 1) sourceFaults.push(`Resilient no suma a sabiduria`);
  if (sources.str.feats !== 0) sourceFaults.push(`una dote suma a fuerza sin haberla elegido`);

  /*
   * El tope de 20, que es donde una suma ingenua se separa del export.
   *
   * `applyAbilityBonuses` recorta; sumar los cuatro numeros no. Una fuerza que
   * quiere llegar a 22 tiene que mostrar 20 y decir que sobro.
   */
  const pasada = abilitySources({
    ...loaded,
    str: 17,
    levelChoices: {
      ...loaded.levelChoices,
      12: { kind: "improvement", bonuses: { str: 2 } },
    },
  });

  if (pasada.str.final !== 20) {
    sourceFaults.push(`17+2+5 en fuerza da ${pasada.str.final}, el tope es 20`);
  }
  if (!pasada.str.capped) sourceFaults.push("pasarse de 20 no queda marcado");
  if (sources.str.capped) sourceFaults.push("un 20 exacto queda marcado como pasado");

  // El reparto impreso, dicho como lo diria un jugador.
  if (bonusShape({ str: 2, con: 1 }) !== "+2 / +1") {
    sourceFaults.push(`un +2/+1 se lee "${bonusShape({ str: 2, con: 1 })}"`);
  }
  if (bonusShape({}) !== "sin repartir") sourceFaults.push("un reparto vacio no se anuncia");
}

/*
 * El orden de las camaras, que cambia segun quien este forjando.
 *
 * Dos ordenes distintos y las mismas reglas para los dos: no se puede repartir
 * mejoras sobre puntajes que todavia no existen, ni ofrecer dones sin clase ni
 * trasfondo. Lo que se comprueba no es "estan en este orden" sino que las
 * dependencias se respeten en cualquiera de los dos.
 */
const chamberFaults: string[] = [];

{
  for (const pace of ["nuevo", "veterano"] as const) {
    for (const caster of [false, true]) {
      const order = chamberOrder(pace, caster);
      const at = (key: string) => order.indexOf(key as (typeof order)[number]);

      // Las nueve camaras, sin repetidas y sin faltantes.
      const expected = caster ? 9 : 8;
      if (order.length !== expected) {
        chamberFaults.push(`${pace}/${caster}: ${order.length} camaras, esperaba ${expected}`);
      }
      if (new Set(order).size !== order.length) {
        chamberFaults.push(`${pace}/${caster}: una camara aparece dos veces`);
      }
      if (caster !== order.includes("spells")) {
        chamberFaults.push(`${pace}: los conjuros ${caster ? "faltan" : "sobran"}`);
      }

      // Las dependencias reales.
      if (at("growth") < at("attributes")) {
        chamberFaults.push(`${pace}: mejoras antes que aptitudes`);
      }
      if (at("gifts") < at("calling") || at("gifts") < at("origin")) {
        chamberFaults.push(`${pace}: dones antes de tener clase o trasfondo`);
      }
      if (at("identity") !== order.length - 1) {
        chamberFaults.push(`${pace}: identidad no es la ultima`);
      }
    }
  }

  // Y la diferencia que justifica la pregunta: por donde arranca cada uno.
  if (firstChamber("veterano") !== "attributes") {
    chamberFaults.push(`un veterano arranca en ${firstChamber("veterano")}`);
  }
  if (firstChamber("nuevo") !== "ancestry") {
    chamberFaults.push(`alguien nuevo arranca en ${firstChamber("nuevo")}`);
  }
}

/*
 * Lo que dice un objeto cuando lo levantas.
 *
 * Las tablas de item-facts.ts traducen codigos del indice, asi que lo que hay
 * que probar no es que traduzcan bien un caso sino que no haya codigos sin
 * traducir: un arma con una propiedad que la tabla no conoce muestra la letra
 * pelada en la ficha.
 *
 * Se recorre el indice entero, las dos ediciones, contando cuantos codigos
 * quedan sin nombre. Cero es lo unico aceptable.
 */
const itemFaults: string[] = [];

{
  for (const rulesVersion of ["2014", "2024"] as const) {
    const rows = forRulesVersion(collections.item ?? [], rulesVersion) as ItemRow[];
    if (rows.length < 800) itemFaults.push(`${rulesVersion}: solo ${rows.length} objetos`);

    const untranslated = { property: new Set<string>(), mastery: new Set<string>(), damage: new Set<string>() };
    let weapons = 0;
    let withDamage = 0;
    let armour = 0;

    for (const row of rows) {
      const facts = factsFor(slugOf(row.name), rulesVersion, row.source);
      if (!facts) {
        itemFaults.push(`${rulesVersion}: ${row.name} no se encuentra por su propio id`);
        continue;
      }

      if (facts.weapon) {
        weapons += 1;
        if (facts.weapon.damage) withDamage += 1;

        // Un codigo sin traducir sale como el codigo mismo.
        for (const property of facts.weapon.properties) {
          if (property.label === property.code) untranslated.property.add(property.code);
        }
        for (const mastery of facts.weapon.masteries) {
          if (!mastery.means) untranslated.mastery.add(mastery.name);
        }
        // El tipo de dano se traduce dentro de la linea, asi que se mira crudo.
        if (row.damageType && facts.weapon.damage?.includes(row.damageType)) {
          untranslated.damage.add(row.damageType);
        }
      }

      if (facts.armor) armour += 1;

      // La suciedad del indice nunca llega a la pantalla.
      const printed = [
        ...(facts.weapon?.properties.map((entry) => entry.label) ?? []),
        ...(facts.weapon?.masteries.map((entry) => entry.name) ?? []),
      ];
      if (printed.some((entry) => entry.includes("[object"))) {
        itemFaults.push(`${rulesVersion}: ${row.name} imprime un objeto sin convertir`);
      }
    }

    for (const [kind, codes] of Object.entries(untranslated)) {
      if (codes.size > 0) {
        itemFaults.push(`${rulesVersion}: ${kind} sin traducir — ${[...codes].join(", ")}`);
      }
    }

    /*
     * Los pisos, medidos: 2014 trae 202 armas y 70 armaduras; 2024, 93 y 34.
     * Se comprueban flojos porque el indice puede crecer, pero no puede
     * encogerse sin que algo se haya roto.
     */
    const floors = rulesVersion === "2014" ? { weapons: 200, armour: 68 } : { weapons: 90, armour: 32 };
    if (weapons < floors.weapons) itemFaults.push(`${rulesVersion}: ${weapons} armas`);
    if (armour < floors.armour) itemFaults.push(`${rulesVersion}: ${armour} armaduras`);
    // Una sola arma en 2014 no imprime dano; el resto tiene que tenerlo.
    if (withDamage < weapons - 1) {
      itemFaults.push(`${rulesVersion}: ${weapons - withDamage} armas sin dano`);
    }
  }

  // El caso que junta todo: una espada larga es versatil y hace dos danos.
  const longsword = factsFor("longsword", "2014");
  if (!longsword?.weapon?.damage?.startsWith("1d8/1d10")) {
    itemFaults.push(`la espada larga hace "${longsword?.weapon?.damage}"`);
  }
  if (!longsword?.weapon?.properties.some((entry) => entry.label === "Versatil")) {
    itemFaults.push("la espada larga no sale versatil");
  }
  if (longsword?.magic) itemFaults.push("la espada larga sale como objeto magico");

  // Y una armadura, con las tres cosas que la definen.
  const plate = factsFor("plate-armor", "2014") ?? factsFor("plate", "2014");
  if (plate?.armor?.armorClass !== "CA 18") {
    itemFaults.push(`la armadura de placas da "${plate?.armor?.armorClass}"`);
  }
  if (plate?.armor?.strength !== 15) itemFaults.push(`pide Fuerza ${plate?.armor?.strength}`);
  if (!plate?.armor?.stealthDisadvantage) itemFaults.push("las placas no estorban al sigilo");

  /*
   * El equipo inicial de clase, que es lo que abre la camara de Equipo.
   *
   * Medido: 2024 imprime equipo para sus trece clases, y 2014 para catorce de
   * dieciocho. Las cuatro que no son los tres companeros de Tasha y una clase
   * de prestigio de UA — ninguna es una clase de la que se arme un personaje,
   * asi que se nombran en vez de contarse: si alguna clase de verdad dejara de
   * traer equipo, la lista cambia y la cuenta no.
   */
  const kitless = new Set([
    "prestige-class-rune-scribe",
    "expert-sidekick",
    "spellcaster-sidekick",
    "warrior-sidekick",
  ]);

  for (const rulesVersion of ["2014", "2024"] as const) {
    const classes = forRulesVersion(collections.class ?? [], rulesVersion) as Array<{ name: string }>;

    for (const row of classes) {
      const id = slugOf(row.name);
      const kit = startingEquipmentForClass(id, rulesVersion);

      if (kit.length === 0 && !kitless.has(id)) {
        itemFaults.push(`${rulesVersion}: ${row.name} no trae equipo inicial`);
      }
      // Y nada de lo que se muestra puede seguir en el idioma del indice.
      for (const line of kit) {
        if (/[a-z][A-Z]/.test(line)) {
          itemFaults.push(`${rulesVersion}: ${row.name} muestra un codigo crudo — ${line}`);
        }
      }
    }
  }
}

console.log("\nLo que dice un objeto:");
if (itemFaults.length === 0) {
  console.log("  ok         tipos, rarezas, propiedades y maestrias, sin codigos sueltos");
} else {
  for (const fault of itemFaults) console.log(`  FALLA      ${fault}`);
}

console.log("\nEl orden de las camaras:");
if (chamberFaults.length === 0) {
  console.log("  ok         dos ordenes, y las dependencias se respetan en los dos");
} else {
  for (const fault of chamberFaults) console.log(`  FALLA      ${fault}`);
}

console.log("\nDe donde salio cada punto:");
if (sourceFaults.length === 0) {
  console.log("  ok         base, especie, mejoras y dotes suman lo que exporta");
} else {
  for (const fault of sourceFaults) console.log(`  FALLA      ${fault}`);
}

console.log("\nComo se hacen los seis numeros:");
if (statFaults.length === 0) {
  console.log("  ok         arreglo estandar, tabla de compra, sus dos saltos y la tirada");
} else {
  for (const fault of statFaults) console.log(`  FALLA      ${fault}`);
}

console.log("\nLo que otorga un trasfondo:");
if (grantFaults.length === 0) {
  console.log("  ok         competencias, dote y equipo de los 161, en sus cuatro formas");
} else {
  for (const fault of grantFaults) console.log(`  FALLA      ${fault}`);
}

console.log("\nTraer de Foundry:");
if (actorFaults.length === 0) {
  console.log("  ok         Rathma Utgard entero, y tres archivos que no son personajes");
} else {
  for (const fault of actorFaults) console.log(`  FALLA      ${fault}`);
}

console.log("\nLa vision (hoja de trucos por personaje):");
if (visionFaults.length === 0) {
  console.log("  ok         101 subclases, los combos, y el reparto en 3 pestanas");
} else {
  for (const fault of visionFaults) console.log(`  FALLA      ${fault}`);
}

console.log("\nComo pelea (guia de optimizacion):");
if (counselFaults.length === 0) {
  console.log("  ok         competencia, bonificadores, concentracion y economia de acciones");
} else {
  for (const fault of counselFaults) console.log(`  FALLA      ${fault}`);
}

console.log("\nPersonajes enteros contra el manual:");
if (workedFaults.length === 0) {
  console.log(`  ok         ${worked.length} personajes: PG, competencia y CD hechos a mano`);
} else {
  for (const fault of workedFaults) console.log(`  FALLA      ${fault}`);
}

console.log("\nMejora de especie 2014:");
if (seedFaults.length === 0) {
  console.log(`  ok         ${seedExpected.length} subrazas y sus presupuestos, contra el manual`);
} else {
  for (const fault of seedFaults) console.log(`  FALLA      ${fault}`);
}
console.log(
  "  hueco      humano variante          el indice guarda ability=null, igual que las subrazas que no suman;",
);
console.log(
  "                                      no hay como distinguir 'no suma' de 'reemplaza' sin inventar la regla",
);

console.log("\nDote de trasfondo 2024:");
if (bgFeatFaults.length === 0) {
  console.log("  ok  12 trasfondos entregan su dote");
} else {
  for (const fault of bgFeatFaults.slice(0, 8)) console.log(`  FALLA  ${fault}`);
}

// Changing background releases a chosen feat, so it cannot be exported under a
// background that never granted it.
{
  const chose: BuilderState = { ...untouched, backgroundFeatId: "tough" };
  const after = releasedByPick("background", chose);
  if (after.patch.backgroundFeatId !== "") {
    progressFaults.push("cambiar de trasfondo no suelta la dote elegida");
  }
  if (after.shed.length === 0) {
    progressFaults.push("suelta la dote del trasfondo sin nombrarla");
  }
}

console.log("\nForja en curso:");
if (progressFaults.length === 0) {
  console.log(`  ok  ${progressCases.length} borradores`);
} else {
  for (const fault of progressFaults) console.log(`  FALLA  ${fault}`);
}

console.log("\nNombre del archivo:");
if (nameFaults.length === 0) {
  console.log(`  ok  ${nameCases.length + 1} nombres`);
} else {
  for (const fault of nameFaults) console.log(`  FALLA  ${fault}`);
}

console.log("\nHoja imprimible:");
if (sheetFaults.length === 0) {
  console.log(`  ok  ${cases.length} hojas sin fallas`);
} else {
  // One line per distinct fault; the same hole repeats across every case.
  for (const fault of [...new Set(sheetFaults)].slice(0, 12)) console.log(`  FALLA  ${fault}`);
  console.log(`  ${sheetFaults.length} fallas en total`);
}

if (droppedByProp.size > 0) {
  console.log("\nElecciones que el payload no resolvio:");
  for (const [prop, count] of [...droppedByProp].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${prop.padEnd(28)} ${String(count).padStart(3)}  p.ej. ${dropExample.get(prop)}`);
  }

  console.log("\nLo que el jugador lee en el Ritual:");
  for (const [key, sentence] of [...playerFacing].sort()) {
    console.log(`  ${key}\n    ${sentence}`);
  }
}

void checkStore().then(() => {
  process.exitCode =
    broken > 0 ||
    drifted > 0 ||
    silent > 0 ||
    !payload ||
    sheetFaults.length > 0 ||
    nameFaults.length > 0 ||
    progressFaults.length > 0 ||
    bgFeatFaults.length > 0 ||
    seedFaults.length > 0 ||
    workedFaults.length > 0 ||
    counselFaults.length > 0 ||
    visionFaults.length > 0 ||
    actorFaults.length > 0 ||
    grantFaults.length > 0 ||
    statFaults.length > 0 ||
    sourceFaults.length > 0 ||
    chamberFaults.length > 0 ||
    itemFaults.length > 0 ||
    storeFaults.length > 0
      ? 1
      : 0;
});
