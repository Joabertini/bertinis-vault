/**
 * The 2024 sheet: Foundry's dnd5e character sheet, filled with a character.
 *
 * The page is `public/hoja-2024/hoja.html`: the sheet's own markup (dnd5e,
 * MIT) as Foundry renders it, with Wizards' art replaced by ours and Foundry's
 * core CSS replaced by `nucleo.css`. It is a template: this file reads it,
 * writes the character's values where the sheet prints them, and hands back
 * the HTML for an iframe, so the sheet's CSS never touches the app's.
 *
 * Owner's decision, 2026-11-17: the sheet is Foundry's, copied as it is. The
 * design is `docs/diseno/hoja-2024` and the owner's mock-ups of every tab;
 * each tab here prints what the mock-up prints.
 */

import { skillIdFor, toolAbilityFor, toolIdFor, type CharacterBuild } from "@bertinis-vault/contracts";
import { collections, type SpellRow } from "@bertinis-vault/vetools-index";
import type { RulesVersion } from "@bertinis-vault/vetools-ref";

import type { AbilityId } from "./abilities";
import type { BuilderState } from "./builder-state";
import { entryById } from "./catalog";
import { bannerFor } from "./class-banner";
import { CLASS_ICON_PATHS } from "./class-icon-paths";
import { ICON_COLS, ICON_SHEET_KEYS, ICON_SILHOUETTES, type SilhouetteIconKey } from "./icon-atlas";
import {
  backgroundIconKey,
  isSheetIcon,
  itemIconKey,
  kindIconKey,
  speciesIconKey,
  spellIconKey,
  type IconKey,
} from "./icons";
import { itemInfoFor, rowsBySlug, slugOf, spellInfoFor } from "./index-options";
import { sheetDataFor } from "./sheet-data";

export const HOJA_BASE = "/hoja-2024/";

const DETAILS = 'section.tab[data-tab="details"]';

export type HojaCheck = { modifier: number; proficient: boolean; expert: boolean };

export type HojaItemGroup = "weapon" | "equipment" | "consumable" | "tool" | "container" | "loot";

export type HojaItem = {
  name: string;
  quantity: number;
  /** Pounds for one; null when the catalogue gives none. */
  weight: number | null;
  group: HojaItemGroup;
  /** "Simple Melee • Action", "Light Armor"… what Foundry prints under the name. */
  subtitle: string;
  icon: IconKey;
  /** Weapons only. */
  attack?: { bonus: number; damage: string | null; damageType: "slashing" | "piercing" | "bludgeoning" | null };
};

export type HojaSpell = {
  label: string;
  prepared: boolean;
  /** "V, S, M". */
  components: string;
  /** "A", "BA", "R", "1m", "1h": the condensed column. */
  time: string;
  /** `{ value: 120, unit: "ft" }`, or a word ("Touch", "Self"). */
  range: { value: number; unit: string } | string;
  /** "evocation"… lower case, as the icons are named. */
  school: string;
  /** "1 creature", "20 ft sphere": what the spell's text says it reaches. */
  target: string;
  /** The spell attack, when the spell makes one. */
  attack: number | null;
  /** The saving throw it calls for: "DEX", against the caster's DC. */
  save: { ability: string; dc: number } | null;
  ritual: boolean;
  concentration: boolean;
  icon: IconKey;
};

/** The rules text the app fetches from `public/rules/<kind>.json`, keyed as those files are. */
export type RulesTable = Record<string, Record<string, unknown>>;
export type HojaRules = { classFeature?: RulesTable; subclassFeature?: RulesTable; spell?: RulesTable };

export type HojaData = {
  name: string;
  /** "Warlock 1", "Fighter 5 / Wizard 2": as Foundry's header prints it. */
  classLine: string;
  level: number;
  /** A new character sits at the start of their level: the threshold, out of the next one. */
  xp: { value: number; max: number };
  portrait: string;
  /** The banner: the player's, or their class's own. A URL. */
  banner: string;
  abilities: Record<AbilityId, { score: number; modifier: number; save: HojaCheck }>;
  /** By dnd5e key: acr, ani, arc... */
  skills: Record<string, HojaCheck & { ability: AbilityId }>;
  tools: Array<{ label: string; ability: AbilityId | null; modifier: number }>;
  armorClass: number;
  initiative: number;
  speed: number | null;
  proficiencyBonus: number;
  hitPoints: number;
  hitDice: number;
  creatureType: string;
  species: string;
  size: string;
  background: string;
  armor: string[];
  weapons: string[];
  languages: string[];

  /** One pill per class in the Features tab. */
  classes: Array<{ classId: string; name: string; subclass: string; level: number }>;
  classFeatures: string[];
  speciesTraits: string[];
  feats: string[];
  backgroundFeatures: string[];

  items: HojaItem[];
  purse: { pp: number; gp: number; ep: number; sp: number; cp: number };
  encumbrance: { value: number; max: number; strength: number; size: string; multiplier: number };
  attuned: number;

  /** Absent for a character who casts nothing: the Spells tab goes. */
  spellcasting: {
    ability: AbilityId;
    attackBonus: number;
    saveDC: number;
    slots: Record<string, number>;
    pactLevel: number | null;
    prepared: number;
  } | null;
  spells: Array<{ level: number; spells: HojaSpell[] }>;

  alignment: string;
  characteristics: Array<{ label: string; value: string }>;
  personality: { trait: string; ideal: string; bond: string; flaw: string };
  /** The free-text "Appearance" box. */
  appearance: string;
  /** The Biography editor at the bottom. */
  biography: string;
  /** dnd5e's special-trait flags this character has, e.g. "jackOfAllTrades". */
  traits: string[];
};

const ABILITIES: AbilityId[] = ["str", "dex", "con", "int", "wis", "cha"];

/** What `hoja.html` was saved with, in the order Foundry lists them. */
export const SKILL_KEYS = [
  "acr", "ani", "arc", "ath", "dec", "his", "ins", "itm", "inv",
  "med", "nat", "prc", "prf", "per", "rel", "slt", "ste", "sur",
] as const;

/** Experience a character has on reaching each level, 1 to 20. */
const XP_THRESHOLDS = [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
  85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000,
];

/* -------------------------------------------------------------------------- */
/*  Small writers                                                              */
/* -------------------------------------------------------------------------- */

function signed(target: Element | null, value: number) {
  if (!target) return;
  const doc = target.ownerDocument;
  const sign = doc.createElement("span");
  sign.className = "sign";
  sign.textContent = value < 0 ? "-" : "+";
  target.replaceChildren(sign, doc.createTextNode(String(Math.abs(value))));
}

function text(target: Element | null, value: string) {
  if (target) target.textContent = value;
}

/** A proficiency dot. Its look lives in a declarative shadow root, saved with the page. */
function proficiency(cycle: Element | null, value: 0 | 0.5 | 1 | 2) {
  if (!cycle) return;
  const label = { 0: "Not Proficient", 0.5: "Half Proficient", 1: "Proficient", 2: "Expertise" }[value];
  cycle.setAttribute("value", String(value));
  cycle.setAttribute("data-tooltip", label);
  cycle.setAttribute("aria-label", label);
  const template = cycle.querySelector("template") as HTMLTemplateElement | null;
  template?.content.querySelector("input")?.setAttribute("value", String(value));
}

const levelOf = (check: HojaCheck): 0 | 1 | 2 => (check.expert ? 2 : check.proficient ? 1 : 0);

/** One pill per value, cloned from the first the page was saved with. */
function pills(doc: Document, heading: string, values: string[]) {
  const group = [...doc.querySelectorAll(`${DETAILS} .pills-group`)].find(
    (entry) => entry.querySelector("h3 span")?.textContent?.trim() === heading,
  );
  const list = group?.querySelector("ul.pills");
  const sample = list?.querySelector("li.pill");
  if (!group || !list || !sample) return;
  if (values.length === 0) {
    group.remove();
    return;
  }
  list.replaceChildren(
    ...values.map((value) => {
      const pill = sample.cloneNode(true) as Element;
      text(pill.querySelector(".label"), value);
      return pill;
    }),
  );
}

const tab = (name: string) => `section.tab[data-tab="${name}"]`;

/* -------------------------------------------------------------------------- */
/*  Icons                                                                      */
/* -------------------------------------------------------------------------- */

const ICON_SIZE = 40;

function tile(paths: string[]): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect x="8" y="8" width="496" height="496" rx="64" fill="#15151b" stroke="#9f9275" stroke-opacity="0.45" stroke-width="10"/>` +
    paths.map((d) => `<path d="${d}" fill="#c9a46a" transform="translate(64 64) scale(0.75)"/>`).join("") +
    `</svg>`
  );
}

function svgImage(doc: Document, svg: string, className: string): Element {
  const image = doc.createElement("img");
  image.className = className;
  image.setAttribute("src", `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
  image.setAttribute("alt", "");
  image.setAttribute("draggable", "false");
  return image;
}

/**
 * The icon the sheet draws where Foundry draws an item's picture: one cell of the sprite sheet
 * the Forge already uses, or a gold silhouette on a dark tile. Same two looks as `GameIcon`.
 */
function iconNode(doc: Document, key: IconKey, className = "item-image gold-icon", size = ICON_SIZE): Element {
  if (isSheetIcon(key)) {
    const index = ICON_SHEET_KEYS.indexOf(key);
    const node = doc.createElement("span");
    node.className = className;
    node.setAttribute(
      "style",
      [
        "display:inline-block",
        `width:${size}px`,
        `height:${size}px`,
        "border-radius:5px",
        "background-color:#0d0b0b",
        'background-image:url("/icons/atlas.webp")',
        "background-repeat:no-repeat",
        `background-size:${ICON_COLS * size}px auto`,
        `background-position:${-(index % ICON_COLS) * size}px ${-Math.floor(index / ICON_COLS) * size}px`,
      ].join(";"),
    );
    return node;
  }
  return svgImage(doc, tile([ICON_SILHOUETTES[key as SilhouetteIconKey]]), className);
}

/** Puts `key` where the page was saved with the sample picture. Keeps the picture's own classes. */
function setIcon(doc: Document, picture: Element | null, key: IconKey) {
  if (!picture) return;
  picture.replaceWith(iconNode(doc, key, picture.getAttribute("class") || "item-image gold-icon"));
}

/**
 * The dnd5e icons the page was saved with, by file name ("evocation", "slashing"…).
 * Each carries its drawing in a shadow root, so a copy draws without a request.
 */
function iconBank(doc: Document): Map<string, Element> {
  const bank = new Map<string, Element>();
  for (const icon of doc.querySelectorAll("dnd5e-icon[src]")) {
    const name = /([^/]+)\.svg$/.exec(icon.getAttribute("src") ?? "")?.[1];
    if (name && !bank.has(name)) bank.set(name, icon.cloneNode(true) as Element);
  }
  return bank;
}

/* -------------------------------------------------------------------------- */
/*  Item lists                                                                 */
/* -------------------------------------------------------------------------- */

type Row = {
  title: string;
  subtitle?: string;
  icon?: IconKey;
  /** Writes the columns this row has; every other column is left empty. */
  fill?: (item: Element) => void;
};

const headingOf = (section: Element) => section.querySelector("h3.item-name")?.textContent?.trim() ?? "";

function section(doc: Document, tabName: string, heading: string): Element | null {
  return [...doc.querySelectorAll(`${tab(tabName)} .items-section`)].find((entry) => headingOf(entry) === heading) ?? null;
}

function detail(item: Element, column: string): Element | null {
  const cell = item.querySelector(`:scope > .item-row > .item-detail.item-${column}`);
  cell?.classList.remove("empty");
  return cell;
}

/**
 * One row per value, cloned from the first row the section was saved with.
 * A section with nothing to list is dropped rather than printed empty.
 */
function fillRows(target: Element | null, rows: Row[], fallback: Element | null = null) {
  if (!target) return;
  const doc = target.ownerDocument;
  const list = target.querySelector("ol.item-list");
  const sample = list?.querySelector(":scope > li.item") ?? fallback;
  if (!list || !sample || rows.length === 0) {
    target.remove();
    return;
  }
  list.replaceChildren(
    ...rows.map((row) => {
      const item = sample.cloneNode(true) as Element;
      item.removeAttribute("data-item-id");
      item.removeAttribute("data-uuid");
      // The expanded description holds the sample item's own activities.
      item.querySelector(".item-description .wrapper")?.replaceChildren();
      for (const marked of item.querySelectorAll("[data-item-id]")) marked.removeAttribute("data-item-id");
      if (row.icon) setIcon(doc, item.querySelector(".item-row .item-image"), row.icon);
      text(item.querySelector(".item-row .name .title"), row.title);
      const subtitle = item.querySelector(".item-row .name .subtitle");
      if (row.subtitle) {
        if (subtitle) text(subtitle, row.subtitle);
        else {
          const added = doc.createElement("span");
          added.className = "subtitle";
          added.textContent = row.subtitle;
          item.querySelector(".item-row .name")?.append(added);
        }
      } else subtitle?.remove();
      for (const cell of item.querySelectorAll(":scope > .item-row > .item-detail")) {
        if (cell.classList.contains("item-controls")) continue;
        cell.replaceChildren();
        cell.classList.add("empty");
      }
      row.fill?.(item);
      return item;
    }),
  );
}

function quantityCell(doc: Document, item: Element, quantity: number) {
  const cell = detail(item, "quantity");
  if (!cell) return;
  const minus = doc.createElement("a");
  minus.className = "adjustment-button always-interactive";
  minus.setAttribute("data-action", "decrease");
  minus.innerHTML = '<i class="fa-solid fa-minus" inert></i>';
  const input = doc.createElement("input");
  input.className = "always-interactive";
  input.setAttribute("type", "text");
  input.setAttribute("value", String(quantity));
  input.setAttribute("disabled", "");
  const plus = doc.createElement("a");
  plus.className = "adjustment-button always-interactive";
  plus.setAttribute("data-action", "increase");
  plus.innerHTML = '<i class="fa-solid fa-plus" inert></i>';
  cell.replaceChildren(minus, input, plus);
}

function weightCell(doc: Document, item: Element, weight: number | null) {
  if (weight === null) return;
  const cell = detail(item, "weight");
  if (!cell) return;
  const icon = doc.createElement("i");
  icon.className = "fa-solid fa-weight-hanging";
  icon.setAttribute("inert", "");
  cell.replaceChildren(icon, doc.createTextNode(` ${weight}`));
}

function dash(doc: Document, item: Element, column: string) {
  const cell = detail(item, column);
  if (cell) cell.replaceChildren(doc.createTextNode("—"));
}

/* -------------------------------------------------------------------------- */
/*  Tabs                                                                       */
/* -------------------------------------------------------------------------- */

function featuresTab(doc: Document, data: HojaData) {
  const pillList = doc.querySelector(`${tab("features")} .classes`);
  const pillSample = pillList?.querySelector(".class.pill-lg");
  if (pillList && pillSample) {
    pillList.replaceChildren(
      ...data.classes.map((entry) => {
        const pill = pillSample.cloneNode(true) as Element;
        pill.removeAttribute("data-item-id");
        const [classIcon, subclassIcon] = [...pill.querySelectorAll(".icons img")];
        const drawing = CLASS_ICON_PATHS[entry.classId];
        if (classIcon) {
          if (drawing) classIcon.replaceWith(svgImage(doc, tile(drawing.paths), classIcon.getAttribute("class") ?? "gold-icon"));
          else setIcon(doc, classIcon, kindIconKey("feature"));
        }
        if (subclassIcon) {
          if (entry.subclass) setIcon(doc, subclassIcon, kindIconKey("subclass"));
          else subclassIcon.remove();
        }
        for (const marked of pill.querySelectorAll("[data-item-id]")) marked.removeAttribute("data-item-id");
        text(pill.querySelector(".title"), entry.name);
        const subtitle = pill.querySelector(".subtitle");
        if (entry.subclass) text(subtitle, entry.subclass);
        else subtitle?.remove();
        text(pill.querySelector(".level span"), String(entry.level));
        return pill;
      }),
    );
  }

  const all = [...doc.querySelectorAll(`${tab("features")} .items-section`)];
  const usesAndRecovery = (item: Element) => {
    dash(doc, item, "uses");
    dash(doc, item, "recovery");
  };
  const classSection = all[0] ?? null;
  text(classSection?.querySelector("h3.item-name") ?? null, `${data.classes[0]?.name ?? "Class"} Features`);
  fillRows(classSection, data.classFeatures.map((title) => ({ title, icon: kindIconKey("feature"), fill: usesAndRecovery })));
  fillRows(
    section(doc, "features", "Species Features"),
    data.speciesTraits.map((title) => ({ title, icon: kindIconKey("species"), fill: usesAndRecovery })),
  );
  fillRows(
    section(doc, "features", "Background Features"),
    data.backgroundFeatures.map((title) => ({ title, icon: kindIconKey("background"), fill: usesAndRecovery })),
  );
  const other = section(doc, "features", "Other Features");
  text(other?.querySelector("h3.item-name") ?? null, "Feats");
  fillRows(other, data.feats.map((title) => ({ title, subtitle: "Feat", icon: kindIconKey("feat"), fill: usesAndRecovery })));
  section(doc, "features", "Active Abilities")?.remove();
  section(doc, "features", "Passive Abilities")?.remove();
}

const DAMAGE_LABEL = { slashing: "Slashing", piercing: "Piercing", bludgeoning: "Bludgeoning" } as const;

function inventoryTab(doc: Document, data: HojaData, bank: Map<string, Element>) {
  const root = doc.querySelector(tab("inventory"));

  // Encumbrance: what everything in the bag weighs, against what the character can carry.
  const meter = root?.querySelector(".encumbrance .meter");
  if (meter) {
    const percent = data.encumbrance.max > 0 ? Math.min(100, (data.encumbrance.value / data.encumbrance.max) * 100) : 0;
    meter.setAttribute("aria-valuenow", String(percent));
    meter.setAttribute("aria-valuetext", String(data.encumbrance.value));
    meter.setAttribute("aria-valuemax", String(data.encumbrance.max));
    (meter as HTMLElement).style.setProperty("--bar-percentage", `${percent}%`);
    text(meter.querySelector(".label .value"), String(data.encumbrance.value));
    text(meter.querySelector(".label .max"), String(data.encumbrance.max));
  }
  text(root?.querySelector(".encumbrance .strength .value") ?? null, String(data.encumbrance.strength));
  text(root?.querySelector(".encumbrance .size .value") ?? null, data.encumbrance.size);
  const multiplier = root?.querySelector(".encumbrance .multiplier .value");
  if (multiplier) {
    const sign = doc.createElement("span");
    sign.className = "sign";
    sign.textContent = "×";
    multiplier.replaceChildren(sign, doc.createTextNode(String(data.encumbrance.multiplier)));
  }

  // Containers: one card per bag, as Foundry shows them beside the meter.
  const containerList = root?.querySelector("ul.containers");
  const containerSample = containerList?.querySelector("li.container");
  const containers = data.items.filter((item) => item.group === "container");
  if (containerList && containerSample) {
    if (containers.length === 0) containerList.replaceChildren();
    else {
      containerList.replaceChildren(
        ...containers.map((bag) => {
          const card = containerSample.cloneNode(true) as Element;
          card.removeAttribute("data-item-id");
          card.removeAttribute("data-uuid");
          card.querySelector("a")?.setAttribute("aria-label", bag.name);
          card.querySelector(".meter")?.setAttribute("style", "--bar-percentage: 0%");
          const picture = card.querySelector("img");
          if (picture) picture.replaceWith(iconNode(doc, bag.icon, "", 72));
          return card;
        }),
      );
    }
  }

  for (const coin of ["pp", "gp", "ep", "sp", "cp"] as const) {
    root?.querySelector(`input[name="system.currency.${coin}"]`)?.setAttribute("value", String(data.purse[coin]));
  }
  text(root?.querySelector(".attunement .value") ?? null, String(data.attuned));

  const rowFor = (item: HojaItem): Row => ({
    title: item.name,
    subtitle: item.subtitle,
    icon: item.icon,
    fill: (row) => {
      if (item.attack) {
        signed(detail(row, "roll"), item.attack.bonus);
        const cell = detail(row, "formula");
        if (cell) {
          const line = doc.createElement("div");
          line.className = "row";
          const formula = doc.createElement("span");
          formula.className = "formula";
          formula.textContent = item.attack.damage ?? "—";
          line.append(formula);
          const kind = item.attack.damageType;
          const drawing = kind ? bank.get(kind) : undefined;
          if (kind && drawing) {
            const holder = doc.createElement("span");
            holder.setAttribute("aria-label", DAMAGE_LABEL[kind]);
            holder.append(drawing.cloneNode(true));
            line.append(holder);
          }
          cell.replaceChildren(line);
        }
      } else {
        weightCell(doc, row, item.weight);
        quantityCell(doc, row, item.quantity);
      }
      dash(doc, row, "uses");
    },
  });

  const keep: Record<string, HojaItemGroup> = {
    Weapons: "weapon",
    Equipment: "equipment",
    Consumables: "consumable",
    Tools: "tool",
    Containers: "container",
    Loot: "loot",
  };
  // Some sections were saved empty (the sample had no containers or loot): their rows borrow
  // the shape of an equipment row, which has the same columns.
  const borrowed = (section(doc, "inventory", "Equipment")?.querySelector("li.item")?.cloneNode(true) as Element | undefined) ?? null;
  for (const entry of [...(root?.querySelectorAll(".items-section") ?? [])]) {
    const group = keep[headingOf(entry)];
    if (!group) {
      entry.remove();
      continue;
    }
    entry.removeAttribute("hidden");
    fillRows(entry, data.items.filter((item) => item.group === group).map(rowFor), borrowed);
  }
}

function spellsTab(doc: Document, data: HojaData, bank: Map<string, Element>) {
  const root = doc.querySelector(tab("spells"));
  if (!data.spellcasting && data.spells.length === 0) {
    root?.remove();
    doc.querySelector('nav.tabs [data-action="tab"][data-tab="spells"]')?.remove();
    return;
  }

  const casting = data.spellcasting;
  const card = root?.querySelector(".spellcasting");
  if (card && casting) {
    card.setAttribute("data-ability", casting.ability);
    text(card.querySelector(".header h3"), `${data.classes[0]?.name ?? ""} Spellcasting`.trim());
    signed(card.querySelector(".ability .value"), data.abilities[casting.ability].modifier);
    signed(card.querySelector(".attack .value"), casting.attackBonus);
    text(card.querySelector(".save .value"), String(casting.saveDC));
    // The Forge lets a player pick exactly as many as the class prepares.
    text(card.querySelector(".prepared .count"), String(casting.prepared));
    text(card.querySelector(".prepared .max"), String(casting.prepared));
  } else card?.remove();

  const list = root?.querySelector(".spells-list");
  const sections = [...(list?.querySelectorAll(".items-section") ?? [])];
  const sample = section(doc, "spells", "Cantrips") ?? sections[0] ?? null;
  const pipsSample = sections.map((entry) => entry.querySelector(".pips")).find(Boolean) ?? null;
  const pipSample = pipsSample?.querySelector(".pip") ?? null;
  if (!list || !sample) return;

  const rowFor = (spell: HojaSpell): Row => ({
    title: spell.label,
    subtitle: spell.components,
    icon: spell.icon,
    fill: (item) => {
      const school = detail(item, "school");
      const drawing = bank.get(spell.school);
      if (school) {
        school.setAttribute("aria-label", spell.school);
        if (drawing) school.replaceChildren(drawing.cloneNode(true));
        else if (spell.school) school.replaceChildren(iconNode(doc, `school-${spell.school}` as IconKey, "school-icon", 18));
        else school.classList.add("empty");
      }
      const time = detail(item, "time");
      if (time) {
        const condensed = doc.createElement("span");
        condensed.className = "condensed";
        condensed.textContent = spell.time;
        time.replaceChildren(condensed);
      }
      const range = detail(item, "range");
      if (range) {
        if (typeof spell.range === "string") {
          const word = doc.createElement("span");
          word.className = "condensed";
          word.textContent = spell.range;
          range.replaceChildren(word);
        } else {
          range.innerHTML = `<span class="integer">${spell.range.value}</span><span class="literal"> </span><span class="unit">${spell.range.unit}</span>`;
        }
      }
      const target = detail(item, "target");
      if (target) {
        const words = doc.createElement("span");
        words.className = "condensed";
        words.textContent = spell.target || "—";
        target.replaceChildren(words);
      }
      if (spell.attack !== null) signed(detail(item, "roll"), spell.attack);
      else if (spell.save) {
        const roll = detail(item, "roll");
        if (roll) {
          roll.innerHTML = `<div class="stacked"><span class="ability"></span><span class="value"></span></div>`;
          text(roll.querySelector(".ability"), spell.save.ability);
          text(roll.querySelector(".value"), String(spell.save.dc));
        }
      } else dash(doc, item, "roll");
      dash(doc, item, "uses");
    },
  });

  const built = data.spells.map((bucket) => {
    const part = sample.cloneNode(true) as Element;
    part.querySelector(".pips")?.remove();
    const pact = casting?.pactLevel === bucket.level ? (casting.slots.pact ?? 0) : 0;
    const slots = pact || (casting?.slots[String(bucket.level)] ?? 0);
    text(
      part.querySelector("h3.item-name"),
      bucket.level === 0 ? "Cantrips" : pact ? `Pact Magic — ${ordinal(bucket.level)} Level` : `${ordinal(bucket.level)} Level`,
    );
    fillRows(part, bucket.spells.map(rowFor));
    if (bucket.level > 0 && slots > 0 && pipsSample && pipSample) {
      const pips = pipsSample.cloneNode(false) as Element;
      pips.replaceChildren(...Array.from({ length: slots }, () => pipSample.cloneNode(true) as Element));
      part.querySelector("ol.item-list")?.before(pips);
    }
    return part;
  });
  list.replaceChildren(...built);
}

function ordinal(level: number): string {
  const suffix = level === 1 ? "st" : level === 2 ? "nd" : level === 3 ? "rd" : "th";
  return `${level}${suffix}`;
}

function effectsTab(doc: Document) {
  // A new character has no effects: Foundry hides the empty lists and shows the conditions.
  for (const entry of doc.querySelectorAll(`${tab("effects")} .items-section`)) {
    if (!entry.querySelector(".conditions-list")) entry.remove();
  }
  for (const condition of doc.querySelectorAll(`${tab("effects")} .conditions-list .condition`)) {
    condition.classList.remove("active");
  }
}

function biographyTab(doc: Document, data: HojaData) {
  const values = new Map<string, string>([["Alignment", data.alignment]]);
  for (const entry of data.characteristics) values.set(entry.label, entry.value);
  for (const row of doc.querySelectorAll(`${tab("biography")} ul.characteristics > li`)) {
    const value = values.get(row.querySelector(".label")?.textContent?.trim() ?? "");
    text(row.querySelector(".value"), value?.trim() ? value : "—");
  }

  const boxes: Record<string, string> = {
    Ideals: data.personality.ideal,
    Bonds: data.personality.bond,
    Flaws: data.personality.flaw,
    "Personality Traits": data.personality.trait,
    Appearance: data.appearance,
  };
  for (const box of doc.querySelectorAll(`${tab("biography")} .textbox`)) {
    const value = boxes[box.querySelector("h3 span")?.textContent?.trim() ?? ""] ?? "";
    const paragraph = box.querySelector("p");
    if (!paragraph) continue;
    paragraph.replaceChildren();
    const lines = value.trim() ? value.trim().split(/\n+/) : ["—"];
    lines.forEach((line, index) => {
      if (index > 0) paragraph.append(doc.createElement("br"), doc.createElement("br"));
      paragraph.append(doc.createTextNode(line));
    });
  }

  const editor = doc.querySelector(`${tab("biography")} .editor-content`);
  if (editor) {
    const paragraphs = data.biography.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
    editor.replaceChildren(
      ...(paragraphs.length ? paragraphs : ["—"]).map((part) => {
        const paragraph = doc.createElement("p");
        paragraph.textContent = part;
        return paragraph;
      }),
    );
  }
}

function specialTraitsTab(doc: Document, data: HojaData) {
  const root = doc.querySelector(tab("specialTraits"));
  const select = root?.querySelector('select[name="system.details.originalClass"]');
  select?.replaceChildren(
    ...data.classes.slice(0, 1).map((entry) => {
      const choice = doc.createElement("option");
      choice.textContent = entry.name;
      choice.setAttribute("selected", "");
      return choice;
    }),
  );
  for (const box of root?.querySelectorAll("dnd5e-checkbox[name^='flags.dnd5e.']") ?? []) {
    const flag = box.getAttribute("name")!.slice("flags.dnd5e.".length);
    if (data.traits.includes(flag)) box.setAttribute("checked", "");
    else box.removeAttribute("checked");
  }
}

/* -------------------------------------------------------------------------- */
/*  The page                                                                   */
/* -------------------------------------------------------------------------- */

/** The sheet's HTML for this character. `template` is `hoja.html` as served. */
export function renderHoja(template: string, data: HojaData): string {
  const doc = new DOMParser().parseFromString(template, "text/html");
  const bank = iconBank(doc);

  // The page's own links resolve from its folder, wherever the iframe lives.
  const base = doc.createElement("base");
  base.href = new URL(HOJA_BASE, globalThis.location?.origin ?? "http://localhost").href;
  doc.head.prepend(base);

  // The sheet floats alone: nothing of the page's own around it, so the app shows through.
  const bare = doc.createElement("style");
  bare.textContent = "html, body { background: transparent !important; margin: 0; overflow: hidden; }";
  doc.head.append(bare);

  const form = doc.querySelector("form.application") as HTMLElement | null;
  if (form) {
    // A window placed by Foundry's canvas; here it is the page.
    form.style.position = "relative";
    form.style.left = "0";
    form.style.top = "0";
    form.style.margin = "0";
    form.style.setProperty("--dnd5e-character-background-image", `url("${data.banner}")`);
    form.style.setProperty("--dnd5e-character-header-image", "transparent");
  }

  // The window's own buttons: close, edit and "Recordatorios" talk to the page that holds the iframe.
  doc.querySelector(".window-header .preparation-warnings")?.remove();
  const reminders = doc.querySelector('.window-header [data-action="copyUuid"]');
  if (reminders) {
    reminders.setAttribute("data-action", "vision");
    reminders.setAttribute("data-tooltip", "Recordatorios");
    reminders.setAttribute("aria-label", "Recordatorios");
    reminders.setAttribute("class", "header-control fa-solid fa-lightbulb icon");
    reminders.removeAttribute("draggable");
  }
  const mode = doc.querySelector(".window-header .mode-slider");
  mode?.setAttribute("data-tooltip", "Editar en la Forja");
  mode?.setAttribute("aria-label", "Editar en la Forja");

  // Header.
  text(doc.querySelector(".window-title"), data.name);
  text(doc.querySelector(".sheet-header .document-name"), data.name);
  text(doc.querySelector(".sheet-header .class"), data.classLine);
  const badge = doc.querySelector(".sheet-header .level-badge");
  text(badge, String(data.level));
  badge?.setAttribute("aria-label", `Level ${data.level}`);
  text(doc.querySelector(".sheet-header .xp-label .value"), data.xp.value.toLocaleString("en-US"));
  text(doc.querySelector(".sheet-header .xp-label .max"), data.xp.max.toLocaleString("en-US"));
  const xpBar = doc.querySelector(".sheet-header .xp-bar") as HTMLElement | null;
  xpBar?.setAttribute("aria-valuenow", String(data.xp.value));
  xpBar?.setAttribute("aria-valuemax", String(data.xp.max));
  xpBar?.setAttribute("aria-valuetext", "0%");
  xpBar?.style.setProperty("--bar-percentage", "0%");

  for (const ability of ABILITIES) {
    const box = doc.querySelector(`.ability-scores .ability-score[data-ability="${ability}"]`);
    signed(box?.querySelector(".mod") ?? null, data.abilities[ability].modifier);
    text(box?.querySelector(".score") ?? null, String(data.abilities[ability].score));
  }

  // Sidebar.
  const portrait = doc.querySelector(".sidebar .portrait img");
  if (portrait && data.portrait) portrait.setAttribute("src", data.portrait);
  portrait?.setAttribute("alt", data.name);
  text(doc.querySelector(".sidebar .ac-badge > div"), String(data.armorClass));
  const lozenges = [...doc.querySelectorAll(".sidebar .lozenges .lozenge .value")];
  signed(lozenges[0]?.querySelector("span") ?? lozenges[0] ?? null, data.initiative);
  text(lozenges[1] ?? null, data.speed === null ? "—" : String(data.speed));
  signed(lozenges[2] ?? null, data.proficiencyBonus);
  const hp = doc.querySelector(".sidebar .meter.hit-points");
  text(hp?.querySelector(".label .value") ?? null, String(data.hitPoints));
  text(hp?.querySelector(".label .max") ?? null, String(data.hitPoints));
  hp?.querySelector('input[name="system.attributes.hp.value"]')?.setAttribute("value", String(data.hitPoints));
  const dice = doc.querySelector(".sidebar .meter.hit-dice");
  text(dice?.querySelector(".label .value") ?? null, String(data.hitDice));
  text(dice?.querySelector(".label .max") ?? null, String(data.hitDice));

  // Details: skills.
  for (const key of SKILL_KEYS) {
    const row = doc.querySelector(`${DETAILS} .skills li[data-key="${key}"]`);
    const skill = data.skills[key];
    if (!row || !skill) continue;
    proficiency(row.querySelector("proficiency-cycle"), levelOf(skill));
    text(row.querySelector(".ability"), skill.ability);
    signed(row.querySelector(".bonus"), skill.modifier);
    text(row.querySelector(".passive"), String(10 + skill.modifier));
  }

  // Tools: one row per tool, cloned from the first the page carries.
  const toolList = doc.querySelector(`${DETAILS} .tools ul`);
  const toolSample = toolList?.querySelector("li");
  if (toolList && toolSample) {
    toolList.replaceChildren(
      ...data.tools.map((tool) => {
        const row = toolSample.cloneNode(true) as Element;
        row.setAttribute("data-key", toolIdFor(tool.label) ?? tool.label);
        proficiency(row.querySelector("proficiency-cycle"), 1);
        text(row.querySelector(".ability"), tool.ability ?? "");
        text(row.querySelector(".tool-name"), tool.label);
        signed(row.querySelector(".bonus"), tool.modifier);
        return row;
      }),
    );
  }

  // Saving throws.
  for (const ability of ABILITIES) {
    const row = doc.querySelector(`${DETAILS} .saves li[data-ability="${ability}"]`);
    if (!row) continue;
    const save = data.abilities[ability].save;
    proficiency(row.querySelector("proficiency-cycle"), save.proficient ? 1 : 0);
    signed(row.querySelector(".bonus"), save.modifier);
  }

  // Type, species, background.
  const type = doc.querySelector(`${DETAILS} .pill-lg.type`);
  text(type?.querySelector(".title") ?? null, data.creatureType);
  text(type?.querySelector(".subtitle") ?? null, data.species);
  const race = doc.querySelector(`${DETAILS} .pill-lg.race`);
  text(race?.querySelector(".title") ?? null, data.species);
  text(race?.querySelector(".subtitle") ?? null, data.size);
  const background = doc.querySelector(`${DETAILS} .pill-lg.background`);
  text(background?.querySelector(".title") ?? null, data.background);
  setIcon(doc, type?.querySelector(".creature-type") ?? null, kindIconKey("species"));
  setIcon(doc, race?.querySelector("img") ?? null, speciesIconKey(data.species));
  setIcon(doc, background?.querySelector("img") ?? null, backgroundIconKey(data.background));

  pills(doc, "Armor", data.armor);
  pills(doc, "Weapons", data.weapons);
  pills(doc, "Languages", data.languages);

  featuresTab(doc, data);
  inventoryTab(doc, data, bank);
  spellsTab(doc, data, bank);
  effectsTab(doc);
  biographyTab(doc, data);
  specialTraitsTab(doc, data);

  return `<!doctype html>\n${doc.documentElement.outerHTML}`;
}

/* -------------------------------------------------------------------------- */
/*  The data                                                                   */
/* -------------------------------------------------------------------------- */

function readable(label: string): string {
  if (label.includes(" ") || !label.includes("-")) return label;
  return label
    .replace(/-s-/g, "'s ")
    .replace(/-/g, " ")
    .replace(/(^|\s)[a-z]/g, (start) => start.toUpperCase());
}

/** 5etools item types, as Foundry names them under the item. */
const ITEM_TYPES: Record<string, { label: string; group: HojaItemGroup }> = {
  LA: { label: "Light Armor", group: "equipment" },
  MA: { label: "Medium Armor", group: "equipment" },
  HA: { label: "Heavy Armor", group: "equipment" },
  S: { label: "Shield", group: "equipment" },
  RG: { label: "Ring", group: "equipment" },
  RD: { label: "Rod", group: "equipment" },
  WD: { label: "Wand", group: "equipment" },
  SCF: { label: "Spellcasting Focus", group: "equipment" },
  G: { label: "Adventuring Gear", group: "loot" },
  TG: { label: "Trade Good", group: "loot" },
  $: { label: "Treasure", group: "loot" },
  P: { label: "Potion", group: "consumable" },
  SC: { label: "Scroll", group: "consumable" },
  A: { label: "Ammunition", group: "consumable" },
  AF: { label: "Ammunition", group: "consumable" },
  FD: { label: "Food and Drink", group: "consumable" },
  EXP: { label: "Explosive", group: "consumable" },
  AT: { label: "Artisan's Tools", group: "tool" },
  T: { label: "Tool", group: "tool" },
  GS: { label: "Gaming Set", group: "tool" },
  INS: { label: "Musical Instrument", group: "tool" },
  MNT: { label: "Mount", group: "loot" },
  VEH: { label: "Vehicle", group: "loot" },
};

const CONTAINER = /\b(pack|backpack|bag|sack|pouch|case|chest|quiver|satchel|basket|barrel)\b/i;

const DAMAGE_TYPES: Record<string, "slashing" | "piercing" | "bludgeoning"> = {
  cortante: "slashing",
  perforante: "piercing",
  contundente: "bludgeoning",
  S: "slashing",
  P: "piercing",
  B: "bludgeoning",
};

function damageTypeOf(code: string | null): "slashing" | "piercing" | "bludgeoning" | null {
  return code ? (DAMAGE_TYPES[code] ?? null) : null;
}

const SIZES: Array<[RegExp, string, number]> = [
  [/tiny|diminut/i, "Tiny", 0.5],
  [/small|peque/i, "Sm", 1],
  [/large|grande/i, "Lg", 2],
  [/huge|enorme/i, "Hg", 4],
  [/gargantuan|gargant/i, "Grg", 8],
];

function sizeOf(label: string): { size: string; multiplier: number } {
  const found = SIZES.find(([pattern]) => pattern.test(label));
  return found ? { size: found[1], multiplier: found[2] } : { size: "Md", multiplier: 1 };
}

/** "1 bonus action" → "BA", as the condensed column prints it. */
function condensedTime(label: string): string {
  const lower = label.toLowerCase();
  if (/bonus/.test(lower)) return "BA";
  if (/reaction/.test(lower)) return "R";
  if (/action/.test(lower)) return "A";
  const amount = /(\d+)\s*(minute|hour|round|day)/.exec(lower);
  if (amount) return `${amount[1]}${{ minute: "m", hour: "h", round: "r", day: "d" }[amount[2] as "minute" | "hour" | "round" | "day"]}`;
  return label;
}

function spellRange(label: string): HojaSpell["range"] {
  const distance = /^(\d+)\s*(feet|foot|ft|miles?|mi)\b/i.exec(label.trim());
  if (distance) return { value: Number(distance[1]), unit: /^mi/i.test(distance[2]!) ? "mi" : "ft" };
  const word = label.trim().split(/[\s(]/)[0] ?? "";
  return word ? word[0]!.toUpperCase() + word.slice(1) : "—";
}

/** The special-trait flags this character has, by what its classes, feats and species say. */
function traitsOf(classes: HojaData["classes"], feats: string[], species: string, rulesVersion: RulesVersion): string[] {
  const levelIn = (classId: string) => classes.find((entry) => entry.classId === classId)?.level ?? 0;
  const subclassOf = (classId: string) => classes.find((entry) => entry.classId === classId)?.subclass.toLowerCase() ?? "";
  const hasFeat = (name: RegExp) => feats.some((feat) => name.test(feat));
  const traits: string[] = [];
  if (levelIn("bard") >= 2) traits.push("jackOfAllTrades");
  if (levelIn("rogue") >= 7) traits.push("reliableTalent");
  if (levelIn("monk") >= 14) traits.push("diamondSoul");
  if (levelIn("artificer") >= 6) traits.push("toolExpertise");
  if (/champion/.test(subclassOf("fighter")) && levelIn("fighter") >= (rulesVersion === "2024" ? 3 : 7)) traits.push("remarkableAthlete");
  if (hasFeat(/^alert\b/i)) traits.push("initiativeAlert");
  if (hasFeat(/^observant\b/i)) traits.push("observantFeat");
  if (hasFeat(/^tavern brawler\b/i)) traits.push("tavernBrawlerFeat");
  if (hasFeat(/^elven accuracy\b/i)) traits.push("elvenAccuracy");
  if (/halfling/i.test(species)) traits.push("halflingLucky");
  if (/goliath|firbolg|bugbear|orc/i.test(species)) traits.push("powerfulBuild");
  if (/half-orc/i.test(species)) traits.push("savageAttacks");
  return traits;
}

const BOOKS: Record<RulesVersion, string[]> = { "2024": ["XPHB", "PHB"], "2014": ["PHB", "XPHB"] };

/** Names 5etools gives a level that hands the player a choice, not a feature. */
const NOT_A_FEATURE = /^(ability score improvement|subclass feature|.+ subclass|epic boon)$|\(cost: /i;

const SUBCLASS_PREFIX = /^(The|Path of the|Oath of|College of|Circle of the|Circle of|School of|Way of the|Way of)\s+/i;

/**
 * Every class and subclass feature a character of these classes has, from the rules text,
 * in level order: Foundry gives a character each of them as an item.
 */
export function classFeaturesFrom(rules: HojaRules, classes: HojaData["classes"], rulesVersion: RulesVersion): string[] {
  const books = BOOKS[rulesVersion];
  const same = (value: unknown, expected: string) => String(value ?? "").toLowerCase() === expected.toLowerCase();
  const pick = (records: Array<Record<string, unknown>>, field: string) => {
    const book = books.find((name) => records.some((record) => same(record[field], name))) ?? String(records[0]?.[field] ?? "");
    return records.filter((record) => same(record[field], book));
  };
  const found: Array<{ name: string; level: number }> = [];
  for (const entry of classes) {
    const own = Object.values(rules.classFeature ?? {}).filter(
      (record) => same(record["className"], entry.name) && Number(record["level"]) <= entry.level,
    );
    const ofBook = pick(own, "classSource").filter((record) => same(record["source"], String(record["classSource"])));
    for (const record of ofBook) found.push({ name: String(record["name"]), level: Number(record["level"]) });
    if (!entry.subclass) continue;
    const shortName = entry.subclass.replace(SUBCLASS_PREFIX, "");
    const sub = Object.values(rules.subclassFeature ?? {}).filter(
      (record) =>
        same(record["className"], entry.name) &&
        (same(record["subclassShortName"], entry.subclass) || same(record["subclassShortName"], shortName)) &&
        Number(record["level"]) <= entry.level,
    );
    for (const record of pick(sub, "source")) {
      const name = String(record["name"]);
      if (same(name, entry.subclass) || same(name, shortName)) continue;
      found.push({ name, level: Number(record["level"]) });
    }
  }
  const names = found
    .sort((a, b) => a.level - b.level)
    .map((entry) => entry.name)
    .filter((name) => !NOT_A_FEATURE.test(name));
  return [...new Set(names)];
}

/** The 5etools record of a spell, in the edition's book first. */
function spellRecord(rules: HojaRules, name: string, rulesVersion: RulesVersion): Record<string, unknown> | null {
  const table = rules.spell;
  if (!table) return null;
  for (const book of BOOKS[rulesVersion]) {
    const record = table[`${name.toLowerCase()}|${book.toLowerCase()}`];
    if (record) return record;
  }
  return null;
}

const NUMBERS: Record<string, string> = { a: "1", an: "1", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6" };

/** What a spell reaches, read off its first paragraph the way Foundry fills its Target field. */
function spellTarget(record: Record<string, unknown> | null, range: HojaSpell["range"]): string {
  const self = typeof range === "string" && /^self$/i.test(range);
  const entries = (record?.["entries"] as unknown[] | undefined) ?? [];
  const first = entries.find((entry): entry is string => typeof entry === "string") ?? "";
  const plain = first.replace(/\{@\w+ ([^|}]+)[^}]*\}/g, "$1");
  const area = /(\d+)-foot(?:-radius)?[- ](sphere|cube|cone|line|cylinder|emanation|radius|square)/i.exec(plain);
  if (area) return `${area[1]} ft ${area[2]!.toLowerCase()}`;
  if (self) return "Self";
  const many = /up to (\w+) (willing )?creatures/i.exec(plain);
  if (many) return `${NUMBERS[many[1]!.toLowerCase()] ?? many[1]} ${many[2] ?? ""}creatures`;
  const one = /\b(a|an|one) (willing )?(creature|object|humanoid|beast|corpse|point)/i.exec(plain);
  if (one) return `1 ${one[2] ?? ""}${one[3]!.toLowerCase()}`;
  return "";
}

/** Everything the sheet prints, from the character and its derived build. */
export function hojaDataFor(
  state: BuilderState,
  build: CharacterBuild,
  rulesVersion: RulesVersion,
  rules: HojaRules = {},
): HojaData {
  const sheet = sheetDataFor(state, build, rulesVersion);
  const abilities = {} as HojaData["abilities"];
  const skills: HojaData["skills"] = {};

  for (const entry of sheet.abilities) {
    abilities[entry.id] = {
      score: entry.score,
      modifier: entry.modifier,
      save: { modifier: entry.save.modifier, proficient: entry.save.proficient, expert: false },
    };
    for (const skill of entry.skills) {
      const key = skillIdFor(skill.name);
      if (key) skills[key] = { modifier: skill.modifier, proficient: skill.proficient, expert: skill.expert, ability: skill.ability };
    }
  }

  const tools = sheet.toolProficiencies.map((label) => {
    const id = toolIdFor(label);
    const ability = id ? toolAbilityFor(id) : null;
    return {
      label,
      ability,
      modifier: (ability ? abilities[ability].modifier : 0) + sheet.proficiencyBonus,
    };
  });

  const armor = [
    sheet.armorTraining.light && "Light",
    sheet.armorTraining.medium && "Medium",
    sheet.armorTraining.heavy && "Heavy",
    sheet.armorTraining.shields && "Shields",
  ].filter((entry): entry is string => Boolean(entry));

  // Classes, from the state: the class line is a label, and the pills need ids.
  const classLabel = (classId: string) => entryById("class", rulesVersion, classId)?.label ?? readable(classId);
  const subclassLabel = (subclassId: string) =>
    subclassId
      ? (entryById("subclass", rulesVersion, subclassId, state.sourceBooks[`subclass:${subclassId}`])?.label ?? readable(subclassId))
      : "";
  const extras = state.extraClasses.filter((extra) => extra.classId && extra.level >= 1);
  const classes: HojaData["classes"] = state.classId
    ? [
        { classId: state.classId, name: classLabel(state.classId), subclass: subclassLabel(state.subclassId), level: state.level },
        ...extras.map((extra) => ({
          classId: extra.classId,
          name: classLabel(extra.classId),
          subclass: subclassLabel(extra.subclassId),
          level: extra.level,
        })),
      ]
    : [];

  // The bag: every piece, with what the catalogue says it weighs and is.
  const bag = build.choices.normalized?.equipment ?? [];
  const infoOf = (entry: (typeof bag)[number]) => (entry.itemId ? itemInfoFor(entry.itemId, rulesVersion) : null);
  const items: HojaItem[] = [];
  for (const attack of sheet.attacks) {
    const entry = bag.find((piece) => piece.label === attack.name || piece.itemId === slugOf(attack.name));
    const info = entry ? infoOf(entry) : null;
    const category = info?.weaponCategory ? `${info.weaponCategory[0]!.toUpperCase()}${info.weaponCategory.slice(1)} ` : "";
    items.push({
      name: attack.name,
      quantity: attack.quantity,
      weight: info?.weight ?? null,
      group: "weapon",
      subtitle: `${category}${attack.ranged ? "Ranged" : "Melee"} • Action`,
      icon: itemIconKey({ name: attack.name, type: info?.type ?? (attack.ranged ? "R" : "M"), rarity: info?.rarity ?? null, weaponCategory: info?.weaponCategory ?? null }),
      attack: {
        bonus: attack.attackBonus,
        damage: attack.damage,
        damageType: damageTypeOf(attack.damageType) ?? damageTypeOf(info?.damageType ?? null),
      },
    });
  }
  const armed = new Set(items.map((item) => item.name));
  for (const entry of bag) {
    const name = readable(entry.label);
    if (armed.has(entry.label) || armed.has(name) || entry.category === "weapon") continue;
    const info = infoOf(entry);
    const code = (info?.type ?? "").split("|")[0] ?? "";
    const known = ITEM_TYPES[code];
    const group: HojaItemGroup = CONTAINER.test(name) ? "container" : (known?.group ?? (entry.category === "armor" || entry.category === "shield" ? "equipment" : "loot"));
    items.push({
      name,
      quantity: entry.quantity,
      weight: info?.weight ?? null,
      group,
      subtitle: known?.label ?? (group === "container" ? "Container" : ""),
      icon: CONTAINER.test(name) && !info ? "backpack" : itemIconKey({ name, type: info?.type ?? null, rarity: info?.rarity ?? null, weaponCategory: info?.weaponCategory ?? null }),
    });
  }

  const strength = abilities.str.score;
  const { size, multiplier } = sizeOf(sheet.sizeLabel);
  const carried = items.reduce((sum, item) => sum + (item.weight ?? 0) * item.quantity, 0);

  // Spells, with what the index knows of each.
  const spells: HojaData["spells"] = sheet.spellsByLevel.map((bucket) => ({
    level: bucket.level,
    spells: bucket.spells.map((spell) => {
      const info = spellInfoFor(spell.label, rulesVersion);
      const row = rowsBySlug<SpellRow>(collections.spell, rulesVersion, slugOf(spell.label))[0];
      const school = (info?.school ?? "").toLowerCase();
      const range = spellRange(info?.rangeLabel ?? "");
      const record = spellRecord(rules, spell.label, rulesVersion);
      const saves = (record?.["savingThrow"] as string[] | undefined) ?? [];
      return {
        label: spell.label,
        prepared: spell.prepared,
        components: [...(row?.components ?? "")].map((letter) => letter.toUpperCase()).join(", "),
        time: condensedTime(info?.castingTimeLabel ?? ""),
        range,
        target: spellTarget(record, range),
        save: saves[0] && sheet.spellcasting ? { ability: saves[0].slice(0, 3).toUpperCase(), dc: sheet.spellcasting.saveDC } : null,
        school,
        attack: row && row.attack.length > 0 && sheet.spellcasting ? sheet.spellcasting.attackBonus : null,
        ritual: info?.ritual ?? false,
        concentration: info?.concentration ?? false,
        icon: spellIconKey({ name: spell.label, school: info?.school ?? "" }),
      };
    }),
  }));

  const characteristic = (spanish: string) => sheet.appearance.find((entry) => entry.label === spanish)?.value ?? "";
  const level = sheet.level;

  return {
    name: sheet.characterName || "Sin nombre",
    classLine: classes.length ? classes.map((entry) => `${entry.name} ${entry.level}`).join(" / ") : sheet.classLine,
    level,
    xp: { value: XP_THRESHOLDS[Math.max(0, level - 1)] ?? 0, max: XP_THRESHOLDS[Math.min(19, level)] ?? 355000 },
    portrait: state.coverImage,
    banner: bannerFor(state),
    abilities,
    skills,
    tools,
    armorClass: sheet.armorClass,
    initiative: sheet.initiative,
    speed: sheet.speed,
    proficiencyBonus: sheet.proficiencyBonus,
    hitPoints: sheet.hitPoints,
    hitDice: level,
    creatureType: "Humanoid",
    species: sheet.speciesLabel,
    size: sheet.sizeLabel,
    background: sheet.backgroundLabel,
    armor,
    weapons: sheet.weaponProficiencies,
    languages: sheet.languages,
    classes,
    classFeatures: [...new Set([...classFeaturesFrom(rules, classes, rulesVersion), ...sheet.classFeatures])],
    speciesTraits: sheet.speciesTraits,
    feats: sheet.feats,
    backgroundFeatures: sheet.backgroundFeatures,
    items,
    purse: { pp: sheet.purse.pp, gp: sheet.purse.gp, ep: sheet.purse.ep, sp: sheet.purse.sp, cp: sheet.purse.cp },
    encumbrance: {
      value: Math.round(carried * 10) / 10,
      max: Math.round(strength * 15 * multiplier),
      strength,
      size,
      multiplier,
    },
    attuned: sheet.attunedCount,
    spellcasting: sheet.spellcasting
      ? {
          ability: sheet.spellcasting.ability,
          attackBonus: sheet.spellcasting.attackBonus,
          saveDC: sheet.spellcasting.saveDC,
          slots: sheet.spellcasting.slots,
          pactLevel: sheet.spellcasting.pactLevel ?? null,
          prepared: spells.filter((bucket) => bucket.level > 0).flatMap((bucket) => bucket.spells).filter((spell) => spell.prepared).length,
        }
      : null,
    spells,
    alignment: sheet.alignment,
    characteristics: [
      ["Age", "Edad"], ["Height", "Altura"], ["Weight", "Peso"], ["Eyes", "Ojos"],
      ["Hair", "Pelo"], ["Skin", "Piel"], ["Gender", "Genero"], ["Faith", "Fe"],
    ].map(([label, spanish]) => ({ label: label!, value: characteristic(spanish!) })),
    personality: sheet.personality,
    appearance: state.appearance,
    biography: state.notes,
    traits: traitsOf(classes, sheet.feats, sheet.speciesLabel, rulesVersion),
  };
}
