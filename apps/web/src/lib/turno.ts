/**
 * "Tu turno": what a character can do, drawn from their own sheet.
 *
 * The old reminders were notes written by hand for twelve classes and for 2014. This reads the
 * same data the sheet prints (`hojaDataFor`): the weapons that are equipped, the spells that are
 * prepared, the class features from the rules text. So it works for any class, in either edition,
 * and its numbers are the sheet's: it cannot disagree with it.
 *
 * What a feature costs is read from its own text, not from a table kept here: "as a Bonus Action",
 * "you can take a Reaction", "you can use this feature twice", "the number of times shown in the
 * Rages column". The class's level table (`classTable.json`) answers the last one.
 *
 * Nothing is invented. A feature whose text states no cost is not a turn option, and a resource
 * whose count the text does not give is not shown with a guessed one.
 */

import type { IconKey } from "./icons";
import { kindIconKey } from "./icons";
import {
  PROPERTY_NAMES,
  featureRecordOf,
  recordNamed,
  spellRecord,
  type HojaData,
  type HojaEstado,
  type HojaItem,
  type HojaRules,
  type HojaSpell,
} from "./hoja-2024";
import type { RulesVersion } from "@bertinis-vault/vetools-ref";

/** What an option does for the character; it sets its colour. */
export type Role = "dmg" | "ctl" | "heal" | "def" | "mov" | "util" | "rxn";

export type TurnoRoll = { label: string; formula: string };

export type TurnoOption = {
  id: string;
  role: Role;
  icon: IconKey;
  name: string;
  /** One short line: what it is, how it reaches. */
  line: string;
  /** The number on the right ("1d12+4", "CD 15", "+3d6") and what it is. */
  big: string;
  small: string;
  /** Tapping the row rolls this; tapping the number rolls `damage`. */
  attack?: TurnoRoll;
  damage?: TurnoRoll;
};

export type TurnoSlot = { id: "action" | "bonus"; title: string; hint: string; options: TurnoOption[] };

export type TurnoReaction = { id: string; when: string; name: string; line: string; role: Role; roll?: TurnoRoll };

export type TurnoResource = {
  id: string;
  name: string;
  hint: string;
  max: number;
  used: number;
  role: Role;
  /** What a short rest gives back: one use, all of them, or nothing. */
  short: "one" | "all" | null;
  kind: "pip" | "hd";
};

export type Turno = {
  name: string;
  line: string;
  banner: string;
  vitals: Array<[string, string]>;
  hp: { value: number; max: number };
  tips: string[];
  slots: TurnoSlot[];
  reactions: TurnoReaction[];
  resources: TurnoResource[];
  /** A passive feature worth remembering: its name and its first sentence. */
  feature: { name: string; text: string } | null;
};

type Table = NonNullable<HojaRules["classTable"]>;

/* -------------------------------------------------------------------------- */
/*  Text helpers                                                               */
/* -------------------------------------------------------------------------- */

const BOOKS: Record<RulesVersion, string[]> = { "2024": ["xphb", "phb"], "2014": ["phb", "xphb"] };

/** A 5etools string without its markup: "{@variantrule Bonus Action|XPHB}" becomes "Bonus Action". */
export function plain(text: string): string {
  return text
    .replace(/\{@\w+ ([^|}]*)[^}]*\}/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

const NUMBER_WORDS: Record<string, number> = { once: 1, twice: 2, two: 2, three: 3, four: 4, five: 5, six: 6 };

/** The first sentence of a record's text, without markup, cut to `max` characters. */
function firstSentence(record: Record<string, unknown> | null, max = 140): string {
  const entries = record?.["entries"];
  const first = Array.isArray(entries) ? entries.find((entry) => typeof entry === "string") : null;
  if (typeof first !== "string") return "";
  const text = plain(first);
  const sentence = text.split(/(?<=[.!?])\s/)[0] ?? text;
  return sentence.length > max ? `${sentence.slice(0, max - 1).trimEnd()}…` : sentence;
}

/** The strings of a record's entries, in order, one level of nesting deep. */
function textsOf(record: Record<string, unknown> | null): string[] {
  const out: string[] = [];
  const walk = (node: unknown, depth: number) => {
    if (typeof node === "string") out.push(node);
    else if (depth < 3 && node && typeof node === "object") {
      const inner = (node as { entries?: unknown }).entries;
      for (const child of Array.isArray(node) ? node : Array.isArray(inner) ? inner : []) walk(child, depth + 1);
    }
  };
  walk(record?.["entries"], 0);
  return out;
}

/**
 * What a feature does, in one line: the sentence that names what it costs ("As a Bonus Action, you
 * give yourself Advantage...") and not the flavour sentence before it ("You can imbue yourself with
 * a primal power..."). Falls back to the first sentence.
 */
function shortLine(record: Record<string, unknown> | null, max = 100): string {
  const sentences = textsOf(record).flatMap((text) => plain(text).split(/(?<=[.!?])\s/));
  const costly = sentences.find((sentence) => /Bonus Action|Reaction|Magic action/.test(sentence));
  const line = costly ?? sentences[0] ?? "";
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
}

/** What a reaction does, without repeating what sets it off: the words after "take a Reaction". */
function effectLine(record: Record<string, unknown> | null, max = 90): string {
  for (const text of textsOf(record)) {
    const after = text.split(/\{@variantrule Reaction[^}]*\}/)[1];
    if (!after) continue;
    const effect = plain(after).replace(/^(?:\s*,)?\s*(?:to |and )?/, "").replace(/[.]+$/, "");
    if (effect.length > 3) {
      const line = effect.charAt(0).toUpperCase() + effect.slice(1);
      return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
    }
  }
  return shortLine(record, max);
}

/** Average of a dice formula: "2d10+3" is 14. Used only to order what to show first. */
export function averageOf(formula: string): number {
  let total = 0;
  for (const match of formula.replace(/\s+/g, "").matchAll(/([+-]?)(?:(\d*)d(\d+)|(\d+))/gi)) {
    const sign = match[1] === "-" ? -1 : 1;
    total += sign * (match[3] ? Math.max(1, Number(match[2] || 1)) * ((Number(match[3]) + 1) / 2) : Number(match[4]));
  }
  return total;
}

const signed = (value: number) => (value >= 0 ? `+${value}` : String(value));

/* -------------------------------------------------------------------------- */
/*  A feature, read from its text                                              */
/* -------------------------------------------------------------------------- */

export type FeatureCost = "action" | "bonus" | "reaction" | null;

/** What action a feature takes, from the first place its text names one. */
export function costOf(text: string): FeatureCost {
  const candidates: Array<[FeatureCost, RegExp]> = [
    ["bonus", /\{@variantrule Bonus Action/],
    ["reaction", /\{@variantrule Reaction/],
    ["action", /\{@action Magic/],
  ];
  let best: { cost: FeatureCost; at: number } | null = null;
  for (const [cost, pattern] of candidates) {
    const at = text.search(pattern);
    if (at >= 0 && (!best || at < best.at)) best = { cost, at };
  }
  return best?.cost ?? null;
}

/** The label of a class table's column that is about `name`: "Rage" is the "Rages" column. */
function columnFor(table: Table[string] | undefined, name: string): number {
  if (!table) return -1;
  const wanted = name.toLowerCase();
  return table.labels.findIndex((label) => {
    const lower = label.toLowerCase();
    return lower === wanted || lower === `${wanted}s` || lower === `${wanted} points`;
  });
}

/** The value of the class table's column `label` at `level`. */
function tableValue(table: Table[string] | undefined, label: string, level: number): string | null {
  const column = table?.labels.findIndex((entry) => entry === label) ?? -1;
  return column >= 0 ? (table?.rows[level - 1]?.[column] ?? null) : null;
}

/** How many times a feature can be used between rests, when its text says so. */
export function usesOf(
  text: string,
  name: string,
  level: number,
  table: Table[string] | undefined,
  mods: { proficiency: number; abilities: Record<string, number> },
): number | null {
  // "the number of times shown in the Rages column": the level table has the number.
  const named = /in the ([A-Z][A-Za-z' ]+?) column/.exec(text)?.[1];
  const column = named ? table?.labels.findIndex((label) => label === named) ?? -1 : columnFor(table, name);
  if (column >= 0) {
    const value = Number(table?.rows[level - 1]?.[column]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  const times = /use (?:this feature|this class's [A-Za-z ]+|it) (once|twice|(\w+) times)/i.exec(text);
  if (times) {
    const word = (times[2] ?? times[1] ?? "").toLowerCase();
    return NUMBER_WORDS[word] ?? (Number(word) || null);
  }
  if (/number of times equal to your Proficiency Bonus/i.test(text)) return mods.proficiency;
  const mod = /number of times equal to your (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) modifier/i.exec(text);
  if (mod) return Math.max(1, mods.abilities[(mod[1] ?? "").slice(0, 3).toLowerCase()] ?? 1);
  if (/can't do so again until/i.test(text)) {
    const upgrade = /Starting at level (\d+), you can use it twice/i.exec(text);
    return upgrade && level >= Number(upgrade[1]) ? 2 : 1;
  }
  return null;
}

/** What a short rest gives back of a limited feature, from the same text. */
export function shortRestOf(text: string): "one" | "all" | null {
  if (/regain one expended use when you finish a \{@variantrule Short Rest/i.test(text)) return "one";
  if (/(?:until you finish a|regain all expended uses when you finish a) \{@variantrule Short Rest/i.test(text)) return "all";
  return null;
}

/** What a feature does for the character, read from its text. */
function roleOf(text: string, rider: boolean): Role {
  if (rider || /extra damage|additional damage/i.test(text)) return "dmg";
  if (/regain[^.]*Hit Points|temporary Hit Points/i.test(text)) return "heal";
  if (/@action (Dash|Disengage|Hide)|Speed increases|teleport/i.test(text)) return "mov";
  if (/halve|Resistance|reduce the damage|Armor Class/i.test(text)) return "def";
  if (/Frightened|Charmed|Paralyzed|Restrained|Stunned|Incapacitated|Prone/i.test(text)) return "ctl";
  return "util";
}

/** What a spell does, read from its text and its record. */
function spellRole(record: Record<string, unknown> | null, damage: string | null, save: boolean): Role {
  const text = JSON.stringify(record?.["entries"] ?? "");
  if (damage) return "dmg";
  if (/regain[^.]*Hit Points|hit points equal|restores? [^.]*hit points/i.test(text)) return "heal";
  if (/teleport|Speed (?:increases|is)|fly speed/i.test(text)) return "mov";
  if (/bonus to AC|Armor Class|Resistance/i.test(text)) return "def";
  if (save || /@condition (Charmed|Frightened|Paralyzed|Restrained|Stunned|Blinded|Incapacitated|Prone|Deafened)/i.test(text)) return "ctl";
  return "util";
}

/* -------------------------------------------------------------------------- */
/*  The turn                                                                   */
/* -------------------------------------------------------------------------- */

const HAS_AREA = /sphere|cone|cube|line|radius|cylinder/i;

function weaponLine(item: HojaItem, rules: HojaRules, rulesVersion: RulesVersion): string {
  const record = recordNamed(rules.item, item.name, rulesVersion);
  const properties = ((record?.["property"] as unknown[] | undefined) ?? [])
    .map((code) => (typeof code === "string" ? code : ((code as { uid?: string }).uid ?? "")).split("|")[0] ?? "")
    .map((code) => PROPERTY_NAMES[code] ?? "")
    .filter(Boolean);
  const mastery = ((record?.["mastery"] as unknown[] | undefined) ?? []).map((code) => String(code).split("|")[0]);
  return [...properties.slice(0, 3), ...mastery.slice(0, 1).map((name) => `Maestría ${name}`)].join(" · ") || item.subtitle;
}

function attackRoll(rolls: Array<{ label: string; formula: string }> | undefined): TurnoRoll | undefined {
  return rolls?.find((roll) => /^Ataque/.test(roll.label));
}

function damageRoll(rolls: Array<{ label: string; formula: string }> | undefined): TurnoRoll | undefined {
  return rolls?.find((roll) => roll.label === "Daño");
}

export function turnoFor(
  data: HojaData,
  rules: HojaRules,
  rulesVersion: RulesVersion,
  estado: HojaEstado = {},
): Turno {
  const classTable = rules.classTable ?? {};
  const mods = {
    proficiency: data.proficiencyBonus,
    abilities: Object.fromEntries(Object.entries(data.abilities).map(([id, entry]) => [id, entry.modifier])),
  };
  const books = BOOKS[rulesVersion];

  const action: TurnoOption[] = [];
  const bonus: TurnoOption[] = [];
  const reactions: TurnoReaction[] = [];
  const resources: TurnoResource[] = [];
  const riders: TurnoOption[] = [];
  const passives: Array<{ name: string; record: Record<string, unknown> | null }> = [];

  /* ---- weapons ---- */
  const seen = new Set<string>();
  const weapons = data.items.filter((item) => item.group === "weapon" && (estado.equipped?.[item.key] ?? item.equipped) && item.attack && !seen.has(item.name) && seen.add(item.name));
  const melee = weapons.filter((item) => /Melee/i.test(item.subtitle));
  for (const item of weapons) {
    const rolls = data.info[item.key]?.rolls;
    const attack = attackRoll(rolls);
    const damage = damageRoll(rolls);
    action.push({
      id: item.key,
      role: "dmg",
      icon: item.icon,
      name: item.name,
      line: weaponLine(item, rules, rulesVersion),
      big: damage?.formula.replace(/\s+/g, "") ?? "",
      small: item.attack ? `${signed(item.attack.bonus)} ataque` : "",
      ...(attack ? { attack } : {}),
      ...(damage ? { damage } : {}),
    });
  }

  /* ---- spells ---- */
  for (const bucket of data.spells) {
    for (const spell of bucket.spells as HojaSpell[]) {
      if (bucket.level > 0 && !(estado.prepared?.[spell.key] ?? spell.prepared)) continue;
      const slot = spell.time === "A" ? "action" : spell.time === "BA" ? "bonus" : spell.time === "R" ? "reaction" : null;
      if (!slot) continue;
      const record = spellRecord(rules, spell.label, rulesVersion);
      const rolls = data.info[spell.key]?.rolls;
      const damage = damageRoll(rolls);
      const role = spellRole(record, damage?.formula ?? null, spell.save !== null);
      const attack = attackRoll(rolls);
      const level = bucket.level === 0 ? "Truco" : `Nv ${bucket.level}`;
      const reach = typeof spell.range === "string" ? spell.range : `${spell.range.value} ${spell.range.unit}`;
      if (slot === "reaction") {
        const condition = (record?.["time"] as Array<{ condition?: string }> | undefined)?.[0]?.condition;
        reactions.push({
          id: spell.key,
          when: condition ? plain(condition).replace(/^which you take /i, "").replace(/^./, (first) => first.toUpperCase()).slice(0, 90) : "Cuando se dispara",
          name: spell.label,
          line: `${level} · ${spell.concentration ? "concentración" : reach}`,
          role: role === "util" ? "rxn" : role,
        });
        continue;
      }
      const option: TurnoOption = {
        id: spell.key,
        role,
        icon: spell.icon,
        name: spell.label,
        line: [level, reach, HAS_AREA.test(spell.target) ? spell.target : "", spell.concentration ? "concentración" : ""].filter(Boolean).join(" · "),
        big: damage ? damage.formula.replace(/\s+/g, "") : spell.save ? `CD ${spell.save.dc}` : spell.attack !== null ? signed(spell.attack) : "",
        small: spell.save ? `${spell.save.ability} salv.` : spell.attack !== null ? `${signed(spell.attack)} ataque` : "",
        ...(attack ? { attack } : {}),
        ...(damage ? { damage } : {}),
      };
      (slot === "action" ? action : bonus).push(option);
    }
  }

  /* ---- class features, from their own text ---- */
  const table = (() => {
    const first = data.classes[0];
    if (!first) return undefined;
    for (const book of books) {
      const hit = classTable[`${first.name.toLowerCase()}|${book}`];
      if (hit) return hit;
    }
    return undefined;
  })();
  const classLevel = data.classes[0]?.level ?? data.level;

  for (const name of data.classFeatures) {
    const record = featureRecordOf(name);
    if (!record) continue;
    const text = JSON.stringify(record["entries"] ?? "");
    const cost = costOf(text);
    const uses = usesOf(text, name, classLevel, table, mods);
    // "Sneak Attack" has a column of its own in the level table: a die added to an attack.
    const dice = tableValue(table, name, classLevel);
    const damageColumn = tableValue(table, `${name} Damage`, classLevel);
    const rider = dice !== null && /^\d+d\d+$/.test(dice);

    // A count only means a resource when the text speaks of spending it: "Weapon Mastery" has a
    // number in its table too, and nothing to spend.
    const spendable = /expended|can't do so again|once per|regain (?:all|one)|until you finish a/i.test(text) && !/^(Spellcasting|Weapon Mastery|Pact Magic)$/i.test(name);
    if (uses !== null && cost !== "reaction" && spendable) {
      resources.push({
        id: `f:${name}`,
        name,
        hint: `${uses} ${uses === 1 ? "uso" : "usos"}`,
        max: uses,
        used: Math.min(uses, estado.pips?.[`turno:f:${name}`] ?? 0),
        role: roleOf(text, rider),
        short: shortRestOf(text),
        kind: "pip",
      });
    }

    if (rider) {
      riders.push({
        id: `f:${name}`,
        role: "dmg",
        icon: kindIconKey("feature"),
        name,
        line: /once per turn/i.test(text) ? "Una vez por turno" : shortLine(record),
        big: `+${dice}`,
        small: "extra",
        damage: { label: name, formula: dice! },
      });
    } else if (cost === "reaction") {
      const first = (record["entries"] as unknown[] | undefined)?.find((entry) => typeof entry === "string");
      const trigger = typeof first === "string" ? /^(.*?),? you can (?:take|use) a \{@variantrule Reaction/.exec(first)?.[1] : null;
      reactions.push({
        id: `f:${name}`,
        when: trigger ? plain(trigger).slice(0, 90) : "Cuando se dispara",
        name,
        line: effectLine(record),
        role: roleOf(text, false),
      });
    } else if (cost === "bonus" || cost === "action") {
      const option: TurnoOption = {
        id: `f:${name}`,
        role: roleOf(text, damageColumn !== null),
        icon: kindIconKey("feature"),
        name,
        line: shortLine(record),
        big: damageColumn ?? "",
        small: damageColumn ? "daño" : "",
      };
      (cost === "bonus" ? bonus : action).push(option);
    } else if (uses === null) {
      passives.push({ name, record });
    }
  }

  /* ---- opportunity attack: every melee weapon gives one ---- */
  const best = melee
    .map((item) => ({ item, roll: attackRoll(data.info[item.key]?.rolls) }))
    .sort((a, b) => (b.item.attack?.bonus ?? 0) - (a.item.attack?.bonus ?? 0))[0];
  if (best?.roll) {
    reactions.push({
      id: "oa",
      when: "Se aleja un enemigo de tu alcance",
      name: "Ataque de oportunidad",
      line: `Un ataque cuerpo a cuerpo · ${signed(best.item.attack?.bonus ?? 0)}`,
      role: "rxn",
      roll: best.roll,
    });
  }

  /* ---- order: the strongest first, riders right after the first attack ---- */
  const byPower = (a: TurnoOption, b: TurnoOption) => {
    const score = (option: TurnoOption) => (option.role === "dmg" ? 1000 + averageOf(option.damage?.formula ?? option.big) : 0);
    return score(b) - score(a);
  };
  action.sort(byPower);
  const ordered = [...action.slice(0, 1), ...riders, ...action.slice(1)].slice(0, 5);
  ordered.push({ id: "other", role: "util", icon: kindIconKey("feature"), name: "Otras acciones", line: "Correr · Esquivar · Ayudar · Esconderse · Retirarse", big: "", small: "" });

  /* ---- resources: spell slots and hit dice ---- */
  const casting = data.spellcasting;
  if (casting) {
    for (const [level, count] of Object.entries(casting.slots)) {
      if (!count) continue;
      const pact = level === "pact";
      resources.push({
        id: `slot:${level}`,
        name: pact ? "Espacios de pacto" : `Espacios nv ${level}`,
        hint: `${count} en total`,
        max: count,
        used: Math.min(count, estado.pips?.[`turno:slot:${level}`] ?? 0),
        role: "ctl",
        short: pact ? "all" : null,
        kind: "pip",
      });
    }
  }
  const hdLeft = Math.min(data.hitDice, estado.hd ?? data.hitDice);
  resources.push({
    id: "hd",
    name: "Dados de golpe",
    hint: `d${data.play.hitDie}`,
    max: data.hitDice,
    used: data.hitDice - hdLeft,
    role: "heal",
    short: null,
    kind: "hd",
  });

  /* ---- the two lines under the banner ---- */
  const tips: string[] = [];
  const topBonus = bonus.find((option) => option.small === "daño");
  const single = ordered.find((option) => option.role === "dmg" && !option.id.startsWith("f:") && !HAS_AREA.test(option.line));
  if (topBonus) tips.push(`Activá ${topBonus.name} antes de atacar: ${topBonus.big} al daño.`);
  else if (single) tips.push(`Tu mejor ataque: ${single.name} (${single.big}).`);
  const rider = riders[0];
  const area = ordered.find((option) => option.role === "dmg" && HAS_AREA.test(option.line));
  if (rider) tips.push(`${rider.name} suma ${rider.big.replace("+", "")} ${rider.line.toLowerCase()}.`);
  else if (area) tips.push(`Si hay varios enemigos juntos: ${area.name}.`);
  else {
    const limited = resources.find((entry) => entry.kind === "pip" && !entry.id.startsWith("slot:"));
    if (limited) tips.push(`${limited.name}: ${limited.hint}.`);
  }

  /* ---- a passive worth remembering: the last one gained that fits in a sentence ---- */
  const worth = passives.filter((entry) => !/Weapon Mastery|Spellcasting|Ability Score|Subclass|Epic Boon|Fighting Style|Expertise/i.test(entry.name));
  const feature = [...worth]
    .reverse()
    .map((entry) => ({ name: entry.name, text: firstSentence(entry.record, 400) }))
    .find((entry) => entry.text && entry.text.length <= 150) ?? null;

  return {
    name: data.name,
    line: `${data.species} · ${data.classLine}`,
    banner: data.banner,
    vitals: [
      ["CA", String(data.armorClass)],
      ["Inic.", signed(data.initiative)],
      ["Vel.", String(data.speed ?? 30)],
    ],
    hp: { value: Math.min(estado.hpMax ?? data.hitPoints, estado.hp ?? estado.hpMax ?? data.hitPoints), max: estado.hpMax ?? data.hitPoints },
    tips: tips.slice(0, 2),
    slots: [
      { id: "action", title: "Acción", hint: "1 por turno", options: ordered },
      ...(bonus.length > 0 ? [{ id: "bonus" as const, title: "Acción adicional", hint: "1 por turno", options: bonus }] : []),
    ],
    reactions,
    resources,
    feature,
  };
}

/* -------------------------------------------------------------------------- */
/*  Resting                                                                    */
/* -------------------------------------------------------------------------- */

/** The play state after `used` changes on a resource. */
export function withUsed(estado: HojaEstado, resource: TurnoResource, used: number): HojaEstado {
  const next = Math.max(0, Math.min(resource.max, used));
  if (resource.kind === "hd") return { ...estado, hd: resource.max - next };
  return { ...estado, pips: { ...(estado.pips ?? {}), [`turno:${resource.id}`]: next } };
}

/** The play state after a rest: what comes back, the same way the sheet's own rest does it. */
export function afterRest(estado: HojaEstado, turno: Turno, kind: "corto" | "largo", hpMax: number): HojaEstado {
  const pips = { ...(estado.pips ?? {}) };
  for (const resource of turno.resources) {
    if (resource.kind !== "pip") continue;
    const key = `turno:${resource.id}`;
    const used = pips[key] ?? 0;
    if (kind === "largo" || resource.short === "all") pips[key] = 0;
    else if (resource.short === "one") pips[key] = Math.max(0, used - 1);
  }
  if (kind === "corto") return { ...estado, pips };
  const hd = turno.resources.find((resource) => resource.kind === "hd");
  const dice = hd?.max ?? 0;
  return {
    ...estado,
    hp: hpMax,
    temp: 0,
    hd: Math.min(dice, (estado.hd ?? dice) + Math.max(1, Math.floor(dice / 2))),
    pips: { ...pips, "system.attributes.death.success": 0, "system.attributes.death.failure": 0 },
  };
}
