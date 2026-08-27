/**
 * What an object does, read off the index and said out loud.
 *
 * The index stores everything about an item as codes: a longsword is
 * `{type: "M", damage: "1d8", damageType: "S", properties: ["V"]}`. That is
 * exactly what a character sheet needs and exactly what a player cannot read.
 *
 * The tables here were written against a tally of the whole index — 1773 items
 * in 2014 and 885 in 2024 — rather than from memory, so the codes that appear
 * are the codes that exist:
 *
 *   type          33 distinct in each edition, most carrying a `|SOURCE` suffix
 *   properties    14 in 2014, 13 in 2024
 *   mastery       8, and only in 2024 — the edition invented them
 *   damageType    7 in 2014, 6 in 2024
 *   rarity        11 in 2014, 9 in 2024
 *
 * An unknown code is shown as itself rather than dropped: a table that has
 * fallen behind the index should look incomplete, not look correct.
 */

import type { ItemRow } from "@bertinis-vault/vetools-index";
import type { RulesVersion } from "@bertinis-vault/vetools-ref";

import { itemInfoFor, slugOf } from "./index-options";

/**
 * The code without its book.
 *
 * 2024 writes `M|XPHB` where 2014 writes `M`, and both editions write
 * `RG|DMG` for a ring. Splitting is not optional: a switch on the raw string
 * matches nothing in 2024.
 */
function bare(code: string | null): string {
  return (code ?? "").split("|")[0] ?? "";
}

/**
 * Two rows in the 2024 index carry `"[object Object]"` where a code belongs.
 *
 * Lance has it among its properties, Psychic Blade among its masteries: an
 * object was stringified when the index was built, upstream of this front.
 * Printing it would put literal `[object Object]` on a character sheet, so it
 * is dropped here and recorded in CONTEXT.md as a measured index gap.
 */
function clean(codes: readonly string[] | null): string[] {
  return (codes ?? []).filter((code) => typeof code === "string" && code !== "[object Object]");
}

/* ---------------- what kind of thing it is ---------------- */

export type ItemKind =
  | "weapon"
  | "armor"
  | "shield"
  | "ammunition"
  | "focus"
  | "tool"
  | "consumable"
  | "wondrous"
  | "gear";

const KIND_BY_TYPE: Record<string, ItemKind> = {
  M: "weapon",
  R: "weapon",
  LA: "armor",
  MA: "armor",
  HA: "armor",
  S: "shield",
  A: "ammunition",
  AF: "ammunition",
  SCF: "focus",
  INS: "focus",
  AT: "tool",
  T: "tool",
  GS: "tool",
  P: "consumable",
  SC: "consumable",
  FD: "consumable",
  RG: "wondrous",
  RD: "wondrous",
  WD: "wondrous",
};

export const KIND_LABEL: Record<ItemKind, string> = {
  weapon: "Arma",
  armor: "Armadura",
  shield: "Escudo",
  ammunition: "Municion",
  focus: "Foco",
  tool: "Herramienta",
  consumable: "Consumible",
  wondrous: "Objeto magico",
  gear: "Equipo",
};

export function kindOf(row: ItemRow): ItemKind {
  return KIND_BY_TYPE[bare(row.type)] ?? "gear";
}

/* ---------------- how rare it is ---------------- */

export type Rarity =
  | "mundane"
  | "common"
  | "uncommon"
  | "rare"
  | "very rare"
  | "legendary"
  | "artifact"
  | "unknown";

/**
 * The rarity ladder, in the order the Dungeon Master's Guide prints it.
 *
 * `none` in the index means a mundane object — a rope, a longsword — not an
 * object of unknown rarity, and the two must not be shown the same way: one is
 * something you buy, the other is something the table has to rule on.
 */
const RARITY_BY_VALUE: Record<string, Rarity> = {
  none: "mundane",
  common: "common",
  uncommon: "uncommon",
  rare: "rare",
  "very rare": "very rare",
  legendary: "legendary",
  artifact: "artifact",
  unknown: "unknown",
  "unknown (magic)": "unknown",
  varies: "unknown",
};

export const RARITY_LABEL: Record<Rarity, string> = {
  mundane: "Comun y corriente",
  common: "Comun",
  uncommon: "Poco comun",
  rare: "Raro",
  "very rare": "Muy raro",
  legendary: "Legendario",
  artifact: "Artefacto",
  unknown: "Sin definir",
};

/** The colour the tables use, which players read before they read the word. */
export const RARITY_TINT: Record<Rarity, string> = {
  mundane: "#8a8175",
  common: "#c9c2b4",
  uncommon: "#5fa463",
  rare: "#4a7fc1",
  "very rare": "#9a5fc1",
  legendary: "#c9922f",
  artifact: "#b84a2f",
  unknown: "#6a635a",
};

export function rarityOf(row: ItemRow): Rarity {
  return RARITY_BY_VALUE[(row.rarity ?? "").toLowerCase()] ?? "mundane";
}

/** Whether this is a magic item at all. Drives whether rarity is worth saying. */
export function isMagic(row: ItemRow): boolean {
  const rarity = rarityOf(row);
  return rarity !== "mundane" && rarity !== "unknown";
}

/* ---------------- what a weapon does ---------------- */

const DAMAGE_TYPE: Record<string, string> = {
  B: "contundente",
  P: "perforante",
  S: "cortante",
  R: "radiante",
  N: "necrotico",
  C: "frio",
  Y: "psiquico",
};

/**
 * The weapon properties, as the Spanish books name them.
 *
 * Each carries the sentence that says what it changes, because the name alone
 * is only useful to someone who already knows: "Sutil" tells a new player
 * nothing, "podes usar Destreza en vez de Fuerza" tells them everything.
 */
const PROPERTY: Record<string, { label: string; means: string }> = {
  "2H": { label: "A dos manos", means: "Ocupa las dos manos: no hay escudo." },
  A: { label: "Municion", means: "Necesita flechas, virotes o balas." },
  AF: { label: "Municion", means: "Necesita municion, de las modernas." },
  BF: { label: "Rafaga", means: "Puede disparar una rafaga sobre un area." },
  F: { label: "Sutil", means: "Usas Destreza o Fuerza, la que te convenga." },
  H: { label: "Pesada", means: "Las criaturas Pequenas la usan con desventaja." },
  L: { label: "Ligera", means: "Sirve para pelear con dos armas." },
  LD: { label: "Carga", means: "Un solo disparo por accion, por mas ataques que tengas." },
  R: { label: "Alcance", means: "Llegas 5 pies mas lejos, para atacar y para oportunidad." },
  RLD: { label: "Recarga", means: "Hay que recargarla cada tantos disparos." },
  S: { label: "Especial", means: "Tiene una regla propia, escrita en su entrada." },
  T: { label: "Arrojadiza", means: "Podes tirarla usando el mismo modificador." },
  V: { label: "Versatil", means: "Mas dano si la agarras con las dos manos." },
  Vst: { label: "Vestigio", means: "Un Vestigio de Divergencia: despierta con el uso." },
};

/**
 * The 2024 weapon masteries.
 *
 * Kept under their English names on purpose: they are new enough that tables
 * say "Topple" out loud, and translating them would leave a player unable to
 * find the entry anyone else is reading.
 */
const MASTERY: Record<string, string> = {
  Cleave: "Al matar, un ataque gratis contra otro enemigo pegado.",
  Graze: "Si fallas, igual haces dano de caracteristica.",
  Nick: "El ataque de la segunda arma entra en la misma accion.",
  Push: "Empuja 10 pies al que golpeas.",
  Sap: "El que golpeas tiene desventaja en su proximo ataque.",
  Slow: "Le sacas 10 pies de velocidad hasta tu proximo turno.",
  Topple: "Salvacion de Constitucion o cae derribado.",
  Vex: "Al pegar, tenes ventaja en tu proximo ataque contra el.",
};

export type WeaponFacts = {
  /** "1d8 cortante", or "1d8/1d10 cortante" when versatile. */
  damage: string | null;
  properties: Array<{ code: string; label: string; means: string }>;
  masteries: Array<{ name: string; means: string }>;
};

export function weaponFacts(row: ItemRow): WeaponFacts {
  const type = DAMAGE_TYPE[row.damageType ?? ""] ?? row.damageType ?? "";

  // Versatile prints both dice, because the choice is the whole property.
  const dice = row.versatileDamage ? `${row.damage}/${row.versatileDamage}` : row.damage;

  return {
    damage: row.damage ? `${dice} ${type}`.trim() : null,
    properties: clean(row.properties).map((code) => ({
      code,
      label: PROPERTY[code]?.label ?? code,
      means: PROPERTY[code]?.means ?? "",
    })),
    masteries: clean(row.mastery).map((name) => ({ name, means: MASTERY[name] ?? "" })),
  };
}

/* ---------------- what armour does ---------------- */

export type ArmorFacts = {
  /** "CA 14 + Des (max 2)", said the way the sheet computes it. */
  armorClass: string;
  /** The Strength the armour asks for, when it asks. */
  strength: number | null;
  stealthDisadvantage: boolean;
};

/**
 * How the armour class reads, per armour category.
 *
 * The three categories differ only in how much Dexterity they let through, and
 * that difference is the entire reason a player picks one over another: light
 * takes the whole modifier, medium caps it at two, heavy takes none.
 */
export function armorFacts(row: ItemRow): ArmorFacts | null {
  if (row.ac === null) return null;

  const category = bare(row.type);
  const armorClass =
    category === "S"
      ? `+${row.ac} a la CA`
      : category === "LA"
        ? `CA ${row.ac} + Des`
        : category === "MA"
          ? `CA ${row.ac} + Des (max 2)`
          : category === "HA"
            ? `CA ${row.ac}`
            : `CA ${row.ac}`;

  return {
    armorClass,
    // Stored as a string of digits, and blank for armour with no requirement.
    strength: row.strength ? Number(row.strength) : null,
    stealthDisadvantage: row.stealthDisadvantage === 1,
  };
}

/* ---------------- what it costs and weighs ---------------- */

/**
 * Price and weight, in the units a table speaks.
 *
 * The index stores value in copper, which nobody says out loud: a longsword is
 * fifteen gold, not fifteen hundred copper.
 */
export function priceOf(row: ItemRow): string | null {
  if (row.value === null) return null;
  if (row.value % 100 === 0) return `${row.value / 100} po`;
  if (row.value % 10 === 0) return `${row.value / 10} pp`;
  return `${row.value} pc`;
}

export function weightOf(row: ItemRow): string | null {
  if (row.weight === null || row.weight === 0) return null;
  return `${row.weight} lb`;
}

/* ---------------- everything at once ---------------- */

export type ItemFacts = {
  row: ItemRow;
  kind: ItemKind;
  rarity: Rarity;
  magic: boolean;
  attunement: boolean;
  price: string | null;
  weight: string | null;
  weapon: WeaponFacts | null;
  armor: ArmorFacts | null;
};

/**
 * Everything the index knows about one item, by the id a draft stores.
 *
 * Returns null for an id the index does not carry, which happens for the
 * hand-typed lines a player leaves in their bag — those are not lookups, they
 * are notes, and treating a missing row as an error would flag them all.
 */
export function factsFor(
  id: string,
  rulesVersion: RulesVersion,
  sourceBook?: string,
): ItemFacts | null {
  const row = itemInfoFor(id, rulesVersion, sourceBook);
  if (!row) return null;

  const kind = kindOf(row);

  return {
    row,
    kind,
    rarity: rarityOf(row),
    magic: isMagic(row),
    attunement: row.attunement === 1,
    price: priceOf(row),
    weight: weightOf(row),
    weapon: kind === "weapon" ? weaponFacts(row) : null,
    armor: armorFacts(row),
  };
}

/** The display name for an id, falling back to the id read as words. */
export function nameFor(id: string, rulesVersion: RulesVersion): string {
  const row = itemInfoFor(id, rulesVersion);
  if (row) return row.name;

  return id
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export { slugOf };
