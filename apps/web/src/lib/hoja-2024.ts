/**
 * The 2024 sheet: Foundry's dnd5e character sheet, filled with a character.
 *
 * The page is `public/hoja-2024/hoja.html`: the sheet's own markup (dnd5e,
 * MIT) as Foundry renders it, with Wizards' art replaced by ours and Foundry's
 * core CSS replaced by `nucleo.css`. It is a template: this file reads it,
 * writes the character's values where the sheet prints them, and hands back
 * the HTML for an iframe, so the sheet's CSS never touches the app's.
 *
 * Owner's decision, 2026-11-17: the sheet is Foundry's, copied as it is.
 */

import { skillIdFor, toolAbilityFor, toolIdFor, type CharacterBuild } from "@bertinis-vault/contracts";
import type { RulesVersion } from "@bertinis-vault/vetools-ref";

import type { AbilityId } from "./abilities";
import type { BuilderState } from "./builder-state";
import { bannerFor } from "./class-banner";
import { sheetDataFor } from "./sheet-data";

export const HOJA_BASE = "/hoja-2024/";

const DETAILS = 'section.tab[data-tab="details"]';

export type HojaCheck = { modifier: number; proficient: boolean; expert: boolean };

export type HojaData = {
  name: string;
  /** "Warlock 1", "Fighter 5 / Wizard 2": as Foundry's header prints it. */
  classLine: string;
  level: number;
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
  classes: Array<{ name: string; subclass: string; level: number }>;
  classFeatures: string[];
  speciesTraits: string[];
  feats: string[];
  backgroundFeatures: string[];

  attacks: Array<{ name: string; quantity: number; attackBonus: number; damage: string | null; note: string }>;
  equipment: Array<{ label: string; quantity: number }>;
  purse: { pp: number; gp: number; ep: number; sp: number; cp: number };

  /** Absent for a character who casts nothing: the Spells tab goes. */
  spellcasting: { ability: AbilityId; attackBonus: number; saveDC: number; slots: Record<string, number>; pactLevel: number | null } | null;
  spells: Array<{ level: number; spells: Array<{ label: string; prepared: boolean }> }>;

  alignment: string;
  appearance: Array<{ label: string; value: string }>;
  personality: { trait: string; ideal: string; bond: string; flaw: string };
  backstory: string;
};

const ABILITIES: AbilityId[] = ["str", "dex", "con", "int", "wis", "cha"];

/** What `hoja.html` was saved with, in the order Foundry lists them. */
export const SKILL_KEYS = [
  "acr", "ani", "arc", "ath", "dec", "his", "ins", "itm", "inv",
  "med", "nat", "prc", "prf", "per", "rel", "slt", "ste", "sur",
] as const;

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

type Row = { title: string; subtitle?: string; quantity?: number; roll?: number; formula?: string | null };

const headingOf = (section: Element) => section.querySelector("h3.item-name")?.textContent?.trim() ?? "";

function section(doc: Document, tabName: string, heading: string): Element | null {
  return [...doc.querySelectorAll(`${tab(tabName)} .items-section`)].find((entry) => headingOf(entry) === heading) ?? null;
}

/** A row's columns the sheet prints from the item itself; we carry none of them, so they go. */
function blankDetails(row: Element, keep: string[] = []) {
  for (const detail of row.querySelectorAll(":scope > .item-row > .item-detail")) {
    if (detail.classList.contains("item-controls") || keep.some((name) => detail.classList.contains(name))) continue;
    detail.replaceChildren();
    detail.classList.add("empty");
  }
}

/**
 * One row per value, cloned from the first row the section was saved with.
 * A section with nothing to list is dropped rather than printed empty.
 */
function fillRows(target: Element | null, rows: Row[], keep: string[] = []) {
  if (!target) return;
  const list = target.querySelector("ol.item-list");
  const sample = list?.querySelector(":scope > li.item");
  if (!list || !sample || rows.length === 0) {
    target.remove();
    return;
  }
  list.replaceChildren(
    ...rows.map((row) => {
      const item = sample.cloneNode(true) as Element;
      item.removeAttribute("data-item-id");
      // The expanded description holds the sample item's own activities.
      item.querySelector(".item-description .wrapper")?.replaceChildren();
      for (const marked of item.querySelectorAll("[data-item-id]")) marked.removeAttribute("data-item-id");
      text(item.querySelector(".item-row .name .title"), row.title);
      const subtitle = item.querySelector(".item-row .name .subtitle");
      if (row.subtitle) text(subtitle, row.subtitle);
      else subtitle?.remove();
      blankDetails(item, keep);
      if (row.quantity !== undefined) {
        const detail = item.querySelector(".item-quantity");
        detail?.classList.remove("empty");
        detail?.querySelector("input")?.setAttribute("value", String(row.quantity));
      }
      if (row.roll !== undefined) {
        const detail = item.querySelector(".item-roll");
        detail?.classList.remove("empty");
        signed(detail?.querySelector(".value") ?? null, row.roll);
      }
      if (row.formula !== undefined) {
        const detail = item.querySelector(".item-formula");
        detail?.classList.remove("empty");
        text(detail?.querySelector(".formula") ?? null, row.formula ?? "—");
        // The sample weapon's damage-type icon.
        for (const extra of detail?.querySelectorAll(".row > :not(.formula)") ?? []) extra.remove();
      }
      return item;
    }),
  );
}

function ordinal(level: number): string {
  const suffix = level === 1 ? "st" : level === 2 ? "nd" : level === 3 ? "rd" : "th";
  return `${level}${suffix}`;
}

function featuresTab(doc: Document, data: HojaData) {
  const pillList = doc.querySelector(`${tab("features")} .classes`);
  const pillSample = pillList?.querySelector(".class.pill-lg");
  if (pillList && pillSample) {
    pillList.replaceChildren(
      ...data.classes.map((entry) => {
        const pill = pillSample.cloneNode(true) as Element;
        pill.removeAttribute("data-item-id");
        pill.querySelector(".icons")?.remove();
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
  const classSection = all[0] ?? null;
  const classTitle = classSection?.querySelector("h3.item-name");
  text(classTitle ?? null, `${data.classes[0]?.name ?? "Class"} Features`);
  fillRows(classSection, data.classFeatures.map((title) => ({ title })));
  fillRows(section(doc, "features", "Species Features"), data.speciesTraits.map((title) => ({ title })));
  fillRows(section(doc, "features", "Background Features"), data.backgroundFeatures.map((title) => ({ title })));
  const other = section(doc, "features", "Other Features");
  text(other?.querySelector("h3.item-name") ?? null, "Feats");
  fillRows(other, data.feats.map((title) => ({ title })));
  section(doc, "features", "Active Abilities")?.remove();
  section(doc, "features", "Passive Abilities")?.remove();
}

function inventoryTab(doc: Document, data: HojaData) {
  // Encumbrance and containers: the Forge weighs nothing and has no bags.
  doc.querySelector(`${tab("inventory")} .top`)?.remove();
  for (const coin of ["pp", "gp", "ep", "sp", "cp"] as const) {
    doc.querySelector(`${tab("inventory")} input[name="system.currency.${coin}"]`)?.setAttribute("value", String(data.purse[coin]));
  }

  const weapons = section(doc, "inventory", "Weapons");
  const equipment = section(doc, "inventory", "Equipment");
  for (const entry of doc.querySelectorAll(`${tab("inventory")} .items-section`)) {
    if (entry !== weapons && entry !== equipment) entry.remove();
  }
  fillRows(
    weapons,
    data.attacks.map((attack) => ({
      title: attack.name,
      subtitle: attack.note,
      quantity: attack.quantity,
      roll: attack.attackBonus,
      formula: attack.damage,
    })),
    ["item-quantity", "item-roll", "item-formula"],
  );
  const armed = new Set(data.attacks.map((attack) => attack.name));
  fillRows(
    equipment,
    data.equipment.filter((entry) => !armed.has(entry.label)).map((entry) => ({ title: entry.label, quantity: entry.quantity })),
    ["item-quantity"],
  );
}

function spellsTab(doc: Document, data: HojaData) {
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
  } else card?.remove();
  // How many are prepared today is not something the build knows.
  card?.querySelector(".prepared")?.remove();

  const list = root?.querySelector(".spells-list");
  const sections = [...(list?.querySelectorAll(".items-section") ?? [])];
  const sample = section(doc, "spells", "Cantrips") ?? sections[0] ?? null;
  const pactSample = sections.find((entry) => entry.querySelector(".pips")) ?? null;
  const pipSample = pactSample?.querySelector(".pips .pip") ?? null;
  const pipsSample = pactSample?.querySelector(".pips") ?? null;
  if (!list || !sample) return;

  const built = data.spells.map((bucket) => {
    const part = sample.cloneNode(true) as Element;
    part.querySelector(".pips")?.remove();
    const pact = casting?.pactLevel === bucket.level ? (casting.slots.pact ?? 0) : 0;
    const slots = pact || (casting?.slots[String(bucket.level)] ?? 0);
    text(
      part.querySelector("h3.item-name"),
      bucket.level === 0 ? "Cantrips" : pact ? `Pact Magic — ${ordinal(bucket.level)} Level` : `${ordinal(bucket.level)} Level`,
    );
    fillRows(
      part,
      bucket.spells.map((spell) => ({ title: spell.label, subtitle: spell.prepared ? "" : "Not prepared" })),
    );
    if (bucket.level > 0 && slots > 0 && pipsSample && pipSample) {
      const pips = pipsSample.cloneNode(false) as Element;
      pips.replaceChildren(...Array.from({ length: slots }, () => pipSample.cloneNode(true) as Element));
      part.querySelector("ol.item-list")?.before(pips);
    }
    return part;
  });
  list.replaceChildren(...built);
}

function biographyTab(doc: Document, data: HojaData) {
  const values = new Map<string, string>([["Alignment", data.alignment]]);
  const keys: Array<[string, string]> = [
    ["Edad", "Age"], ["Altura", "Height"], ["Peso", "Weight"], ["Ojos", "Eyes"],
    ["Pelo", "Hair"], ["Piel", "Skin"], ["Genero", "Gender"], ["Fe", "Faith"],
  ];
  for (const [spanish, label] of keys) values.set(label, data.appearance.find((entry) => entry.label === spanish)?.value ?? "");
  for (const row of doc.querySelectorAll(`${tab("biography")} ul.characteristics > li`)) {
    const value = values.get(row.querySelector(".label")?.textContent?.trim() ?? "");
    text(row.querySelector(".value"), value?.trim() ? value : "—");
  }

  const boxes: Record<string, string> = {
    Ideals: data.personality.ideal,
    Bonds: data.personality.bond,
    Flaws: data.personality.flaw,
    "Personality Traits": data.personality.trait,
  };
  for (const box of doc.querySelectorAll(`${tab("biography")} .textbox`)) {
    const label = box.querySelector("h3 span")?.textContent?.trim() ?? "";
    const value = boxes[label];
    // The free-text "Appearance" has no field in the builder: the characteristics row carries it.
    if (value === undefined) {
      box.remove();
      continue;
    }
    box.querySelector("p")?.replaceChildren(doc.createTextNode(value.trim() || "—"));
  }

  const editor = doc.querySelector(`${tab("biography")} .editor-content`);
  if (editor) {
    const paragraphs = data.backstory.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
    editor.replaceChildren(
      ...(paragraphs.length ? paragraphs : ["—"]).map((part) => {
        const paragraph = doc.createElement("p");
        paragraph.textContent = part;
        return paragraph;
      }),
    );
  }
}

function effectsTab(doc: Document) {
  for (const entry of doc.querySelectorAll(`${tab("effects")} .items-section`)) {
    // The sheet's enchantments are items that enchant other items: nothing here makes one.
    if (/Enchantments/.test(headingOf(entry))) entry.remove();
    else entry.querySelector("ol.item-list")?.replaceChildren();
  }
}

function specialTraitsTab(doc: Document, data: HojaData) {
  const option = doc.querySelector(`${tab("specialTraits")} select[name="system.details.originalClass"]`);
  option?.replaceChildren(
    ...data.classes.slice(0, 1).map((entry) => {
      const choice = doc.createElement("option");
      choice.textContent = entry.name;
      choice.setAttribute("selected", "");
      return choice;
    }),
  );
}

/** The sheet's HTML for this character. `template` is `hoja.html` as served. */
export function renderHoja(template: string, data: HojaData): string {
  const doc = new DOMParser().parseFromString(template, "text/html");

  // The page's own links resolve from its folder, wherever the iframe lives.
  const base = doc.createElement("base");
  base.href = new URL(HOJA_BASE, globalThis.location?.origin ?? "http://localhost").href;
  doc.head.prepend(base);

  const form = doc.querySelector("form.application") as HTMLElement | null;
  if (form) {
    // A window placed by Foundry's canvas; here it is the page.
    form.style.position = "relative";
    form.style.left = "0";
    form.style.top = "0";
    form.style.margin = "0 auto";
    form.style.setProperty("--dnd5e-character-background-image", `url("${data.banner}")`);
    form.style.setProperty("--dnd5e-character-header-image", "transparent");
  }

  // The window's own buttons: close and "Recordatorios" talk to the page that holds the iframe.
  doc.querySelector(".window-header .preparation-warnings")?.remove();
  const reminders = doc.querySelector('.window-header [data-action="copyUuid"]');
  if (reminders) {
    reminders.setAttribute("data-action", "vision");
    reminders.setAttribute("data-tooltip", "Recordatorios");
    reminders.setAttribute("aria-label", "Recordatorios");
    reminders.setAttribute("class", "header-control fa-solid fa-lightbulb icon");
    reminders.removeAttribute("draggable");
  }

  // Header.
  text(doc.querySelector(".window-title"), data.name);
  text(doc.querySelector(".sheet-header .document-name"), data.name);
  text(doc.querySelector(".sheet-header .class"), data.classLine);
  const badge = doc.querySelector(".sheet-header .level-badge");
  text(badge, String(data.level));
  badge?.setAttribute("aria-label", `Level ${data.level}`);
  // The Forge keeps no experience points; an empty bar would say "0 XP".
  for (const part of doc.querySelectorAll(".sheet-header .xp-label, .sheet-header .xp-bar")) part.remove();

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
  race?.querySelector("img")?.setAttribute("alt", data.species);
  const background = doc.querySelector(`${DETAILS} .pill-lg.background`);
  text(background?.querySelector(".title") ?? null, data.background);
  background?.querySelector("img")?.setAttribute("alt", data.background);

  pills(doc, "Armor", data.armor);
  pills(doc, "Weapons", data.weapons);
  pills(doc, "Languages", data.languages);

  featuresTab(doc, data);
  inventoryTab(doc, data);
  spellsTab(doc, data);
  effectsTab(doc);
  biographyTab(doc, data);
  specialTraitsTab(doc, data);

  return `<!doctype html>\n${doc.documentElement.outerHTML}`;
}


/**
 * "Fighter 5 / Wizard 2" → one pill each; a single class is "Fighter" and its level is the character's.
 * The subclass belongs to the first class: the builder keeps one.
 */
function classesOf(classLine: string, subclass: string, level: number): HojaData["classes"] {
  const parts = classLine.split(" / ").map((part) => part.trim()).filter(Boolean);
  return parts.map((part, index) => {
    const match = /^(.*?)(?:\s+(\d+))?$/.exec(part);
    return {
      name: match?.[1] || part,
      subclass: index === 0 ? subclass : "",
      level: match?.[2] ? Number(match[2]) : level,
    };
  });
}

/** Everything the sheet prints, from the character and its derived build. */
export function hojaDataFor(
  state: BuilderState,
  build: CharacterBuild,
  rulesVersion: RulesVersion,
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

  return {
    name: sheet.characterName || "Sin nombre",
    classLine: sheet.classLine,
    level: sheet.level,
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
    hitDice: sheet.level,
    creatureType: "Humanoid",
    species: sheet.speciesLabel,
    size: sheet.sizeLabel,
    background: sheet.backgroundLabel,
    armor,
    weapons: sheet.weaponProficiencies,
    languages: sheet.languages,
    classes: classesOf(sheet.classLine, sheet.subclassLabel, sheet.level),
    classFeatures: sheet.classFeatures,
    speciesTraits: sheet.speciesTraits,
    feats: sheet.feats,
    backgroundFeatures: sheet.backgroundFeatures,
    attacks: sheet.attacks.map((attack) => ({
      name: attack.name,
      quantity: attack.quantity,
      attackBonus: attack.attackBonus,
      damage: attack.damage,
      note: [attack.damageType, ...attack.properties].filter(Boolean).join(" • "),
    })),
    equipment: sheet.equipment,
    purse: { pp: sheet.purse.pp, gp: sheet.purse.gp, ep: sheet.purse.ep, sp: sheet.purse.sp, cp: sheet.purse.cp },
    spellcasting: sheet.spellcasting
      ? {
          ability: sheet.spellcasting.ability,
          attackBonus: sheet.spellcasting.attackBonus,
          saveDC: sheet.spellcasting.saveDC,
          slots: sheet.spellcasting.slots,
          pactLevel: sheet.spellcasting.pactLevel ?? null,
        }
      : null,
    spells: sheet.spellsByLevel,
    alignment: sheet.alignment,
    appearance: sheet.appearance,
    personality: sheet.personality,
    backstory: sheet.backstory,
  };
}
