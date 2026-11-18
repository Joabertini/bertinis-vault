/**
 * C1: the 2024 sheet is Foundry's own, filled with the character. These check
 * that the values land where the sheet prints them, and that nothing of the
 * sample character the page was saved with survives on the Details tab.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

import { buildCanonicalSnapshot } from "../src/lib/builder";
import { freshDraft, type BuilderState } from "../src/lib/builder-state";
import { hojaDataFor, renderHoja } from "../src/lib/hoja-2024";

const template = readFileSync(resolve(process.cwd(), "public/hoja-2024/hoja.html"), "utf8");

const fighter = (): BuilderState => ({
  ...freshDraft("5e-2024"),
  characterName: "Brannoc Vell",
  classId: "fighter",
  raceId: "human",
  backgroundId: "soldier",
  level: 5,
  str: 16,
  dex: 14,
  con: 14,
  int: 10,
  wis: 12,
  cha: 8,
});

function sheet(state = fighter()) {
  const build = buildCanonicalSnapshot(state);
  const data = hojaDataFor(state, build, "2024");
  const doc = new DOMParser().parseFromString(renderHoja(template, data), "text/html");
  return { data, doc };
}

const details = (doc: Document) => doc.querySelector('section.tab[data-tab="details"]')!;

describe("la hoja 2024", () => {
  test("lleva el nombre, la clase y el nivel del personaje", () => {
    const { doc } = sheet();
    expect(doc.querySelector(".sheet-header .document-name")?.textContent).toBe("Brannoc Vell");
    expect(doc.querySelector(".sheet-header .class")?.textContent).toBe("Fighter");
    expect(doc.querySelector(".sheet-header .level-badge")?.textContent).toBe("5");
  });

  test("imprime las características y los modificadores", () => {
    const { doc, data } = sheet();
    const str = doc.querySelector('.ability-score[data-ability="str"]')!;
    expect(str.querySelector(".score")?.textContent).toBe(String(data.abilities.str.score));
    expect(str.querySelector(".mod")?.textContent).toBe(`+${data.abilities.str.modifier}`);
  });

  test("cada habilidad lleva su bonus, su pasiva y su punto de competencia", () => {
    const { doc, data } = sheet();
    for (const [key, skill] of Object.entries(data.skills)) {
      const row = details(doc).querySelector(`li[data-key="${key}"]`)!;
      expect(row.querySelector(".passive")?.textContent).toBe(String(10 + skill.modifier));
      expect(row.querySelector("proficiency-cycle")?.getAttribute("value")).toBe(
        skill.expert ? "2" : skill.proficient ? "1" : "0",
      );
    }
    expect(Object.keys(data.skills)).toHaveLength(18);
  });

  test("las salvaciones del guerrero son Fuerza y Constitución", () => {
    const { doc } = sheet();
    const proficient = [...details(doc).querySelectorAll(".saves li[data-ability]")]
      .filter((row) => row.querySelector("proficiency-cycle")?.getAttribute("value") === "1")
      .map((row) => row.getAttribute("data-ability"));
    expect(proficient.sort()).toEqual(["con", "str"]);
  });

  test("no queda nada de la personaje de muestra en Detalles", () => {
    const { doc } = sheet();
    const text = details(doc).textContent ?? "";
    for (const leftover of ["Hermit", "Cook's Utensils", "Poisoner's Kit"]) expect(text).not.toContain(leftover);
    expect(doc.querySelector(".sheet-header")?.textContent).not.toContain("Samara");
  });

  test("el banner es el de la clase cuando no hay uno propio", () => {
    const { doc } = sheet();
    const style = doc.querySelector("form.application")?.getAttribute("style") ?? "";
    expect(style).toContain("--dnd5e-character-background-image");
    expect(style).toContain("data:image/svg+xml");
  });
});
