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
    const logo = doc.createElement("div");
    logo.className = "marca-logo";
    logo.textContent = "LOGO";
    form.querySelector(".window-content")?.prepend(logo);
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

  // Only Details is filled so far; the other tabs carry the sample character.
  for (const tab of doc.querySelectorAll('nav.tabs [data-action="tab"]')) {
    if (tab.getAttribute("data-tab") !== "details") tab.remove();
  }

  return `<!doctype html>\n${doc.documentElement.outerHTML}`;
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
  };
}
