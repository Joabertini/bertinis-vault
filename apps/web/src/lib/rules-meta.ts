/**
 * The facts that head an entry: a spell's level and range, an item's weight and damage, a
 * species' size and speed.
 *
 * 5etools stores these as codes and nested objects ("V", "E", `{type:"point"...}`), and prints them
 * as a stat block above the prose. Each line here is a label and a markup string, so a fact can
 * itself carry a link — a weapon's mastery opens the mastery.
 */

import type { RulesKind, RulesRecord } from "@/lib/rules-text";

export type MetaLine = { label: string; text: string };

const SCHOOLS: Record<string, string> = {
  A: "Abjuration",
  C: "Conjuration",
  D: "Divination",
  E: "Enchantment",
  V: "Evocation",
  I: "Illusion",
  N: "Necromancy",
  T: "Transmutation",
};

const DAMAGE_TYPES: Record<string, string> = {
  S: "slashing",
  P: "piercing",
  B: "bludgeoning",
  F: "fire",
  C: "cold",
  L: "lightning",
  N: "necrotic",
  O: "force",
  R: "radiant",
  T: "thunder",
  I: "poison",
  A: "acid",
  Y: "psychic",
};

const PROPERTIES: Record<string, string> = {
  A: "Ammunition",
  AF: "Ammunition (firearm)",
  BF: "Burst fire",
  F: "Finesse",
  H: "Heavy",
  L: "Light",
  LD: "Loading",
  R: "Reach",
  RLD: "Reload",
  S: "Special",
  T: "Thrown",
  "2H": "Two-handed",
  V: "Versatile",
};

const ITEM_TYPES: Record<string, string> = {
  M: "Melee weapon",
  R: "Ranged weapon",
  A: "Ammunition",
  LA: "Light armor",
  MA: "Medium armor",
  HA: "Heavy armor",
  S: "Shield",
  G: "Adventuring gear",
  AT: "Artisan's tools",
  T: "Tools",
  GS: "Gaming set",
  INS: "Instrument",
  SCF: "Spellcasting focus",
  P: "Potion",
  RD: "Rod",
  RG: "Ring",
  WD: "Wand",
  SC: "Scroll",
  W: "Wondrous item",
  MNT: "Mount",
  TAH: "Tack and harness",
  VEH: "Vehicle",
  FD: "Food and drink",
  TG: "Trade good",
  OTH: "Other",
  $C: "Treasure",
  EXP: "Explosive",
};

const RARITIES: Record<string, string> = {
  none: "Mundane",
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  "very rare": "Very rare",
  legendary: "Legendary",
  artifact: "Artifact",
  varies: "Varies",
  unknown: "Unknown",
};

const ABILITY_NAMES: Record<string, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
}

function castingTime(record: RulesRecord): string {
  return asArray<Record<string, unknown>>(record["time"])
    .map((time) => {
      const unit = String(time["unit"] ?? "");
      const number = Number(time["number"] ?? 1);
      const base = unit === "bonus" ? "1 bonus action" : unit === "reaction" ? "1 reaction" : unit === "action" ? "1 action" : plural(number, unit);
      return time["condition"] ? `${base}, ${String(time["condition"])}` : base;
    })
    .join(" or ");
}

function rangeOf(record: RulesRecord): string {
  const range = record["range"];
  if (!isObject(range)) return "";
  const type = String(range["type"] ?? "");
  const distance = isObject(range["distance"]) ? range["distance"] : null;
  const amount = distance ? Number(distance["amount"]) : 0;
  const unit = distance ? String(distance["type"]) : "";

  if (type === "special") return "Special";
  if (!distance) return type;
  if (unit === "self") return "Self";
  if (unit === "touch") return "Touch";
  if (unit === "sight") return "Sight";
  if (unit === "unlimited") return "Unlimited";
  const base = `${amount} ${unit === "feet" ? "feet" : unit === "miles" ? "miles" : unit}`;
  if (type === "point") return base;
  const shape = type === "radius" ? "radius" : type === "cone" ? "cone" : type === "line" ? "line" : type === "cube" ? "cube" : type === "sphere" ? "sphere" : type === "hemisphere" ? "hemisphere" : type;
  return `Self (${base} ${shape})`;
}

function componentsOf(record: RulesRecord): string {
  const components = record["components"];
  if (!isObject(components)) return "";
  const parts: string[] = [];
  if (components["v"]) parts.push("V");
  if (components["s"]) parts.push("S");
  const material = components["m"];
  if (material) {
    const text = typeof material === "string" ? material : isObject(material) ? String(material["text"] ?? "") : "";
    parts.push(text ? `M (${text})` : "M");
  }
  if (components["r"]) parts.push("R");
  return parts.join(", ");
}

function durationOf(record: RulesRecord): string {
  return asArray<Record<string, unknown>>(record["duration"])
    .map((entry) => {
      const type = String(entry["type"] ?? "");
      if (type === "instant") return "Instantaneous";
      if (type === "permanent") {
        const ends = asArray<string>(entry["ends"]);
        return ends.length ? `Until dispelled${ends.includes("trigger") ? " or triggered" : ""}` : "Permanent";
      }
      if (type === "special") return "Special";
      const duration = isObject(entry["duration"]) ? entry["duration"] : null;
      const text = duration ? plural(Number(duration["amount"]), String(duration["type"])) : "";
      return entry["concentration"] ? `Concentration, up to ${text}` : text;
    })
    .join(" or ");
}

function spellLines(record: RulesRecord): MetaLine[] {
  const level = Number(record["level"] ?? 0);
  const school = SCHOOLS[String(record["school"] ?? "")] ?? "";
  const ordinal = level === 1 ? "1st" : level === 2 ? "2nd" : level === 3 ? "3rd" : `${level}th`;
  const lines: MetaLine[] = [{ label: "Nivel", text: level === 0 ? `${school} cantrip` : `${ordinal}-level ${school.toLowerCase()}` }];
  const cast = castingTime(record);
  if (cast) lines.push({ label: "Lanzamiento", text: cast });
  const range = rangeOf(record);
  if (range) lines.push({ label: "Alcance", text: range });
  const comps = componentsOf(record);
  if (comps) lines.push({ label: "Componentes", text: comps });
  const duration = durationOf(record);
  if (duration) lines.push({ label: "Duración", text: duration });
  return lines;
}

function valueOf(record: RulesRecord): string {
  const value = Number(record["value"] ?? 0);
  if (!value) return "";
  if (value % 100 === 0) return `${value / 100} gp`;
  if (value % 10 === 0) return `${value / 10} sp`;
  return `${value} cp`;
}

function itemLines(record: RulesRecord): MetaLine[] {
  const lines: MetaLine[] = [];
  const typeCode = String(record["type"] ?? "").split("|")[0] ?? "";
  const kind = ITEM_TYPES[typeCode];
  const rarity = RARITIES[String(record["rarity"] ?? "none")];
  const category = record["weaponCategory"] ? `${String(record["weaponCategory"])} ` : "";
  lines.push({ label: "Tipo", text: `${category}${kind ?? "Item"}${rarity && rarity !== "Mundane" ? ` · ${rarity}` : ""}` });

  if (record["dmg1"]) {
    const type = DAMAGE_TYPES[String(record["dmgType"] ?? "")] ?? "";
    const versatile = record["dmg2"] ? ` (${String(record["dmg2"])} two-handed)` : "";
    lines.push({ label: "Daño", text: `${String(record["dmg1"])} ${type}${versatile}`.trim() });
  }
  if (record["ac"] !== undefined) {
    const stealth = record["stealth"] ? ", disadvantage on Stealth" : "";
    const strength = record["strength"] ? `, Strength ${String(record["strength"])}` : "";
    lines.push({ label: "CA", text: `${String(record["ac"])}${strength}${stealth}` });
  }
  const properties = asArray<string | { uid?: string }>(record["property"])
    .map((entry) => (typeof entry === "string" ? entry : String(entry.uid ?? "")).split("|")[0] ?? "")
    .map((code) => PROPERTIES[code] ?? "")
    .filter(Boolean);
  if (properties.length) lines.push({ label: "Propiedades", text: properties.join(", ") });
  const masteries = asArray<string>(record["mastery"]);
  if (masteries.length) {
    lines.push({
      label: "Maestría",
      text: masteries.map((entry) => `{@itemMastery ${entry}}`).join(", "),
    });
  }
  if (record["range"]) lines.push({ label: "Alcance", text: `${String(record["range"])} ft.` });
  if (record["reqAttune"]) {
    lines.push({
      label: "Sintonía",
      text: typeof record["reqAttune"] === "string" ? `Requires attunement ${String(record["reqAttune"])}` : "Requires attunement",
    });
  }
  const bonus = [record["bonusWeapon"], record["bonusAc"]].find((entry) => typeof entry === "string");
  if (bonus) lines.push({ label: "Bonificador", text: String(bonus) });
  const weight = Number(record["weight"] ?? 0);
  if (weight) lines.push({ label: "Peso", text: `${weight} lb` });
  const cost = valueOf(record);
  if (cost) lines.push({ label: "Precio", text: cost });
  const charges = record["charges"];
  if (charges) lines.push({ label: "Cargas", text: String(charges) });
  return lines;
}

function speedOf(speed: unknown): string {
  if (typeof speed === "number") return `${speed} ft.`;
  if (!isObject(speed)) return "";
  return Object.entries(speed)
    .map(([mode, value]) => {
      const feet = typeof value === "number" ? value : isObject(value) ? Number(value["number"]) : value === true ? "equal to walking" : "";
      return mode === "walk" ? `${feet} ft.` : `${mode} ${feet}${typeof feet === "number" ? " ft." : ""}`;
    })
    .join(", ");
}

function raceLines(record: RulesRecord): MetaLine[] {
  const lines: MetaLine[] = [];
  const sizes = asArray<string>(record["size"]).map((code) => ({ T: "Tiny", S: "Small", M: "Medium", L: "Large", V: "Varies" })[code] ?? code);
  if (sizes.length) lines.push({ label: "Tamaño", text: sizes.join(" or ") });
  const speed = speedOf(record["speed"]);
  if (speed) lines.push({ label: "Velocidad", text: speed });
  if (record["darkvision"]) lines.push({ label: "Visión en la oscuridad", text: `${String(record["darkvision"])} ft.` });
  return lines;
}

function prerequisiteText(record: RulesRecord): string {
  return asArray<Record<string, unknown>>(record["prerequisite"])
    .map((entry) => {
      const parts: string[] = [];
      const level = entry["level"];
      if (typeof level === "number") parts.push(`Level ${level}+`);
      else if (isObject(level)) parts.push(`Level ${String(level["level"])}+`);
      for (const ability of asArray<Record<string, number>>(entry["ability"])) {
        for (const [key, value] of Object.entries(ability)) parts.push(`${ABILITY_NAMES[key] ?? key} ${value}+`);
      }
      if (entry["spellcasting"] || entry["spellcasting2014"]) parts.push("Spellcasting");
      for (const proficiency of asArray<Record<string, unknown>>(entry["proficiency"])) {
        parts.push(`${Object.keys(proficiency).join(", ")} proficiency`);
      }
      if (typeof entry["other"] === "string") parts.push(entry["other"]);
      for (const feat of asArray<string>(entry["feat"])) parts.push(`{@feat ${feat}}`);
      return parts.join(", ");
    })
    .filter(Boolean)
    .join("; ");
}

function classLines(record: RulesRecord): MetaLine[] {
  const lines: MetaLine[] = [];
  const hd = record["hd"];
  if (isObject(hd)) lines.push({ label: "Dado de golpe", text: `d${String(hd["faces"])}` });

  const primary = asArray<Record<string, boolean>>(record["primaryAbility"])
    .map((entry) => Object.keys(entry).map((key) => ABILITY_NAMES[key] ?? key).join(" and "))
    .join(" or ");
  if (primary) lines.push({ label: "Característica principal", text: primary });

  const starting = record["startingProficiencies"];
  if (isObject(starting)) {
    const armor = asArray<string>(starting["armor"]);
    const weapons = asArray<string>(starting["weapons"]);
    const tools = asArray<string>(starting["tools"]);
    if (armor.length) lines.push({ label: "Armaduras", text: armor.join(", ") });
    if (weapons.length) lines.push({ label: "Armas", text: weapons.join(", ") });
    if (tools.length) lines.push({ label: "Herramientas", text: tools.join(", ") });
    const skills = asArray<Record<string, unknown>>(starting["skills"])[0];
    if (skills && isObject(skills["choose"])) {
      const choose = skills["choose"];
      lines.push({
        label: "Habilidades",
        text: `Choose ${String(choose["count"])} from ${asArray<string>(choose["from"]).map((skill) => `{@skill ${skill}}`).join(", ")}`,
      });
    }
  }
  const caster = record["spellcastingAbility"];
  if (typeof caster === "string") lines.push({ label: "Lanzamiento", text: ABILITY_NAMES[caster] ?? caster });
  return lines;
}

/** The facts to print above an entry's prose. Kinds with nothing to say return none. */
export function metaLinesFor(kind: RulesKind, record: RulesRecord): MetaLine[] {
  switch (kind) {
    case "spell":
      return spellLines(record);
    case "item":
      return itemLines(record);
    case "race":
      return raceLines(record);
    case "class":
      return classLines(record);
    case "feat": {
      const lines: MetaLine[] = [];
      const requirement = prerequisiteText(record);
      if (requirement) lines.push({ label: "Requisito", text: requirement });
      return lines;
    }
    case "optionalfeature": {
      const requirement = prerequisiteText(record);
      return requirement ? [{ label: "Requisito", text: requirement }] : [];
    }
    case "action": {
      const time = asArray<Record<string, unknown>>(record["time"])[0];
      return time ? [{ label: "Tiempo", text: `${String(time["number"] ?? 1)} ${String(time["unit"] ?? "action")}` }] : [];
    }
    default:
      return [];
  }
}
