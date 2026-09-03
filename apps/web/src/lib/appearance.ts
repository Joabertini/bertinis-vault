/**
 * A starting point for what a character looks like, drawn from their species.
 *
 * The species is what actually decides the visual — a player asked for this
 * during the beta and was right about the reason. A dwarf and a dragonborn
 * share no height, no build and no skin, and a blank set of fields makes every
 * character start as the same nobody.
 *
 * Two sources, kept apart on purpose:
 *
 * - **Size, from the index.** Every species row carries it, so height, weight
 *   and build come out of data for all 258 of them rather than out of a list
 *   written here.
 * - **Colouring, from a short table below.** The index does not carry it. The
 *   books print it per species and the source bundle those rows are generated
 *   from is not in this repository, so the alternative to a table is nothing.
 *
 * The table covers the species people actually play and stops there. A species
 * it does not name gets its physical build and no colouring, which is the
 * honest answer: inventing a palette for a species whose book nobody here has
 * read would put a wrong fact on a character sheet, and a blank field is a
 * question the player can answer.
 *
 * Everything is a *suggestion*. Nothing here overwrites something the player
 * typed, and the sheet is theirs to contradict — a pale orc is a character, not
 * an error.
 */

import type { RulesVersion } from "@bertinis-vault/vetools-ref";

import { raceInfoFor } from "./index-options";

export type Appearance = {
  age: string;
  height: string;
  weight: string;
  eyes: string;
  hair: string;
  skin: string;
};

/**
 * Metric, because the sheet is in Spanish and its own placeholders say
 * "1,75 m" and "70 kg". The ranges below are in inches and pounds because the
 * books print them that way; converting here keeps one honest source and one
 * readable output.
 */
function metres(totalInches: number): string {
  return `${(totalInches * 0.0254).toFixed(2).replace(".", ",")} m`;
}

function kilos(pounds: number): string {
  return `${Math.round(pounds * 0.4536)} kg`;
}

/**
 * The body a size category implies, as the range to roll inside.
 *
 * Medium spans a lot — a halfling is Small and a goliath is Medium — so this is
 * a floor to vary from rather than a claim about any one species. A species the
 * table below knows adjusts it.
 */
const BUILD: Record<string, { inches: [number, number]; pounds: [number, number] }> = {
  S: { inches: [34, 46], pounds: [35, 75] },
  M: { inches: [58, 76], pounds: [110, 250] },
  L: { inches: [78, 96], pounds: [280, 480] },
};

type Palette = {
  eyes: string[];
  hair: string[];
  skin: string[];
  /** Overrides the size default where a species is notably outside it. */
  inches?: [number, number];
  pounds?: [number, number];
  /** Most species reach adulthood around 18; a few take far longer. */
  age?: [number, number];
};

/**
 * The species this file will describe, and no others.
 *
 * Written in the builder's own language because it is shown, not matched.
 * Keyed by the slug the catalogue uses, so a lookup is a lookup rather than a
 * name comparison that a reprint would break.
 */
const PALETTES: Record<string, Palette> = {
  dwarf: {
    eyes: ["castaños", "avellana", "grises", "negros"],
    hair: ["castaño oscuro", "negro", "rojizo", "gris acero", "rubio ceniza"],
    skin: ["morena", "clara curtida", "rojiza", "cetrina"],
    inches: [48, 56],
    pounds: [130, 200],
    age: [50, 200],
  },
  elf: {
    eyes: ["verdes", "azul claro", "ámbar", "grises", "violetas"],
    hair: ["negro", "plateado", "rubio pálido", "castaño cobrizo"],
    skin: ["pálida", "clara", "morena clara", "con reflejos de cobre"],
    inches: [60, 74],
    pounds: [90, 150],
    age: [100, 700],
  },
  human: {
    eyes: ["castaños", "verdes", "azules", "grises", "negros"],
    hair: ["negro", "castaño", "rubio", "pelirrojo", "canoso"],
    skin: ["clara", "morena", "oscura", "aceitunada"],
    age: [18, 60],
  },
  halfling: {
    eyes: ["castaños", "avellana", "verdes"],
    hair: ["castaño rizado", "negro", "rubio oscuro"],
    skin: ["morena clara", "rosada", "aceitunada"],
    age: [20, 120],
  },
  gnome: {
    eyes: ["azules", "castaños", "negros brillantes"],
    hair: ["blanco", "castaño claro", "rubio", "gris"],
    skin: ["clara", "morena", "de tono madera"],
    age: [40, 350],
  },
  dragonborn: {
    eyes: ["dorados", "rojos", "verdes", "plateados"],
    hair: ["sin pelo"],
    skin: ["escamas de bronce", "escamas rojas", "escamas verdes", "escamas negras", "escamas doradas"],
    inches: [72, 80],
    pounds: [220, 320],
    age: [15, 70],
  },
  tiefling: {
    eyes: ["negros sin pupila", "rojos", "dorados", "plateados"],
    hair: ["negro", "rojo oscuro", "morado", "azul medianoche"],
    skin: ["roja", "cobriza", "morada oscura", "casi negra"],
    age: [18, 90],
  },
  "half-orc": {
    eyes: ["castaños", "verdes oscuros", "amarillentos"],
    hair: ["negro", "castaño oscuro", "gris"],
    skin: ["gris verdosa", "verde oliva", "gris ceniza"],
    inches: [68, 78],
    pounds: [180, 280],
    age: [14, 55],
  },
  orc: {
    eyes: ["rojizos", "amarillos", "castaños"],
    hair: ["negro", "gris oscuro"],
    skin: ["verde oscura", "gris", "verde grisácea"],
    inches: [70, 80],
    pounds: [200, 300],
    age: [14, 50],
  },
  goliath: {
    eyes: ["azul pálido", "grises", "verdes claros"],
    hair: ["sin pelo", "negro corto"],
    skin: ["gris con vetas oscuras", "gris azulada", "gris con marcas de nacimiento"],
    inches: [84, 96],
    pounds: [280, 400],
    age: [18, 80],
  },
  "half-elf": {
    eyes: ["verdes", "avellana", "azules", "ámbar"],
    hair: ["castaño", "negro", "rubio oscuro", "cobrizo"],
    skin: ["clara", "morena clara", "aceitunada"],
    age: [20, 180],
  },
  aasimar: {
    eyes: ["dorados", "blancos luminosos", "azul claro"],
    hair: ["blanco", "rubio pálido", "negro"],
    skin: ["clara con brillo", "dorada", "morena luminosa"],
    age: [18, 160],
  },
  tabaxi: {
    eyes: ["verdes", "ámbar", "dorados"],
    hair: ["pelaje atigrado", "pelaje moteado", "pelaje liso negro", "pelaje leonado"],
    skin: ["pelaje corto", "pelaje denso"],
    age: [18, 70],
  },
  goblin: {
    eyes: ["rojos", "amarillos", "negros"],
    hair: ["ninguno", "mechones negros"],
    skin: ["verde", "verde amarillenta", "verde grisácea"],
    inches: [36, 46],
    pounds: [40, 70],
    age: [10, 55],
  },
  firbolg: {
    eyes: ["azul grisáceo", "verdes"],
    hair: ["rojizo", "castaño", "gris"],
    skin: ["rosada grisácea", "morena clara"],
    inches: [84, 92],
    pounds: [240, 320],
    age: [30, 500],
  },
};

function pick<T>(options: readonly T[], random: () => number): T | undefined {
  if (options.length === 0) return undefined;
  return options[Math.floor(random() * options.length)];
}

function between([low, high]: [number, number], random: () => number): number {
  return low + Math.floor(random() * (high - low + 1));
}

/**
 * A suggested appearance for a species, or null when there is no species yet.
 *
 * `random` is a parameter so a test can hand it a fixed sequence. Left out, it
 * is `Math.random` and every press of the button gives a different character.
 */
export function suggestAppearance(
  raceId: string,
  subraceId: string,
  rulesVersion: RulesVersion,
  random: () => number = Math.random,
): Appearance | null {
  if (!raceId) return null;

  // The subrace is merged in, because it is where the build often differs: a
  // hill dwarf and a mountain dwarf are not the same weight.
  const row = raceInfoFor(raceId, subraceId, rulesVersion);
  const palette = PALETTES[raceId];
  const build = BUILD[row?.size ?? "M"] ?? BUILD.M!;

  const inches = between(palette?.inches ?? build.inches, random);
  const pounds = between(palette?.pounds ?? build.pounds, random);
  const age = between(palette?.age ?? [18, 60], random);

  return {
    age: String(age),
    height: metres(inches),
    weight: kilos(pounds),
    eyes: pick(palette?.eyes ?? [], random) ?? "",
    hair: pick(palette?.hair ?? [], random) ?? "",
    skin: pick(palette?.skin ?? [], random) ?? "",
  };
}

/** Whether this species has colouring to suggest, or only a build. */
export function hasPalette(raceId: string): boolean {
  return raceId in PALETTES;
}
