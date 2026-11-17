import { describe, expect, test } from "vitest";

import { freshDraft } from "../src/lib/builder-state";
import { playbookFor } from "../src/lib/playbook";
import { talentPools } from "../src/lib/optional-features";

/*
 * A4 del plan de reseñas: "aparecen todas las runas" y "Giant's Might escala
 * mal". Las dos venían de los recordatorios, escritos para todos los
 * Caballeros Rúnicos a la vez.
 */

const runeKnight = (optionalFeatureIds: string[], level = 3) => ({
  ...freshDraft("5e-2014"),
  classId: "fighter",
  subclassId: "rune-knight",
  level,
  optionalFeatureIds,
});

const note = (state: ReturnType<typeof runeKnight>, name: string) =>
  playbookFor(state, null, "2014").features.find((entry) => entry.name === name);

describe("los recordatorios del Caballero Rúnico", () => {
  test("Rune Carving nombra solo las runas elegidas", () => {
    const carving = note(runeKnight(["fire-rune", "stone-rune"]), "Rune Carving");

    expect(carving?.desc).toContain("Fire Rune");
    expect(carving?.desc).toContain("Stone Rune");
    for (const other of ["Cloud", "Frost", "Hill", "Storm"]) expect(carving?.desc).not.toContain(other);
  });

  test("sin runas elegidas dice dónde elegirlas, no lista las seis", () => {
    const carving = note(runeKnight([]), "Rune Carving");

    expect(carving?.desc).toContain("Talentos");
    expect(carving?.desc).not.toContain("Storm");
  });

  test("Giant's Might va por bonificador de competencia y sube a d8 y d10", () => {
    const might = note(runeKnight([]), "Giant's Might");

    expect(might?.resource).toMatch(/competencia/i);
    expect(might?.resource).not.toMatch(/STR|FUE/);
    expect(might?.desc).toContain("1d8 a nivel 10");
    expect(might?.desc).toContain("1d10 a nivel 18");
  });
});

describe("el selector de runas respeta el nivel", () => {
  const runes = (level: number) =>
    talentPools(runeKnight([], level), "2014", "Fighter", "Rune Knight", level).find((pool) => pool.name === "Runes");

  test("a nivel 3: dos runas, Hill y Storm bloqueadas", () => {
    const pool = runes(3)!;
    expect(pool.count).toBe(2);
    const blocked = pool.options.filter((option) => !option.eligible).map((option) => option.label).sort();
    expect(blocked).toEqual(["Hill Rune", "Storm Rune"]);
  });

  test("a nivel 7: tres runas y las seis disponibles", () => {
    const pool = runes(7)!;
    expect(pool.count).toBe(3);
    expect(pool.options.every((option) => option.eligible)).toBe(true);
  });
});
