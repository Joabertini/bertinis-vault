/**
 * "Tu turno": lo que el personaje puede hacer, leído de su propia hoja.
 *
 * Los números son los de la hoja (se comparan contra `hojaDataFor`, no contra cifras escritas a
 * mano), y lo que cuesta cada rasgo sale de su texto.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { buildCanonicalSnapshot } from "../src/lib/builder";
import { freshDraft, type BuilderState } from "../src/lib/builder-state";
import { HOJA_RULE_KINDS, hojaDataFor, type HojaRules } from "../src/lib/hoja-2024";
import { afterRest, averageOf, costOf, plain, shortRestOf, turnoFor, usesOf, withUsed } from "../src/lib/turno";

const reglas = (kind: string) => JSON.parse(readFileSync(join(process.cwd(), "public", "rules", `${kind}.json`), "utf8"));
const rules = {
  ...Object.fromEntries(HOJA_RULE_KINDS.map((kind) => [kind, reglas(kind)])),
  classTable: reglas("classTable"),
} as HojaRules;

const barbarian = (): BuilderState => ({
  ...freshDraft("5e-2024"),
  characterName: "Enrique Cavillo",
  classId: "barbarian",
  raceId: "human",
  backgroundId: "farmer",
  level: 1,
  str: 18,
  dex: 14,
  con: 14,
  int: 13,
  wis: 12,
  cha: 12,
  weaponId: "greataxe",
  extraEquipmentText: "greataxe\nhandaxe x4\nexplorer-s-pack",
});

const wizard = (): BuilderState => ({
  ...freshDraft("5e-2024"),
  characterName: "Lea",
  classId: "wizard",
  subclassId: "school-of-evocation",
  raceId: "elf",
  backgroundId: "sage",
  level: 5,
  str: 8,
  dex: 14,
  con: 14,
  int: 18,
  wis: 12,
  cha: 10,
  cantripsText: "Fire Bolt\nMage Hand\nPrestidigitation",
  spellsText: "Nv1: Magic Missile\nNv1: Shield\nNv2: Misty Step\nNv3: Fireball",
  extraEquipmentText: "Backpack\nQuarterstaff",
});

function turnoOf(state: BuilderState, estado = {}) {
  const data = hojaDataFor(state, buildCanonicalSnapshot(state), "2024", rules);
  return { data, turno: turnoFor(data, rules, "2024", estado) };
}

describe("lo que un rasgo cuesta, leído de su texto", () => {
  test("la acción, la acción adicional y la reacción salen de las palabras del texto", () => {
    expect(costOf("You can enter it as a {@variantrule Bonus Action|XPHB} if you")).toBe("bonus");
    expect(costOf("you can take a {@variantrule Reaction|XPHB} to halve")).toBe("reaction");
    expect(costOf("Your skin hardens.")).toBeNull();
    // Gana la que el texto nombra primero.
    expect(costOf("As a {@variantrule Bonus Action|XPHB} ... or a {@variantrule Reaction|XPHB}")).toBe("bonus");
  });

  test("los usos salen de la tabla de la clase, de 'dos veces' o de la competencia", () => {
    const table = { labels: ["Rages", "Rage Damage"], rows: [["2", "+2"], ["2", "+2"], ["3", "+2"]] } as never;
    const mods = { proficiency: 3, abilities: { cha: 4 } };
    expect(usesOf('in the Rages column of the Barbarian Features table', "Rage", 3, table, mods)).toBe(3);
    expect(usesOf("You can use this feature twice.", "Second Wind", 1, undefined, mods)).toBe(2);
    expect(usesOf("a number of times equal to your Proficiency Bonus", "X", 1, undefined, mods)).toBe(3);
    expect(usesOf("a number of times equal to your Charisma modifier (minimum of once)", "Bardic Inspiration", 1, undefined, mods)).toBe(4);
    expect(usesOf("It passively hardens.", "Skin", 1, undefined, mods)).toBeNull();
  });

  test("lo que un descanso corto devuelve sale del mismo texto", () => {
    expect(shortRestOf("You regain one expended use when you finish a {@variantrule Short Rest|XPHB}")).toBe("one");
    expect(shortRestOf("can't do so again until you finish a {@variantrule Short Rest|XPHB|Short} or")).toBe("all");
    expect(shortRestOf("when you finish a {@variantrule Long Rest|XPHB}")).toBeNull();
  });

  test("el marcado de 5etools se quita y los promedios ordenan", () => {
    expect(plain("As a {@variantrule Bonus Action|XPHB}, regain {@dice 1d10}")).toBe("As a Bonus Action, regain 1d10");
    expect(averageOf("1d12+4")).toBe(10.5);
    expect(averageOf("8d6")).toBe(28);
  });
});

describe("el turno de un bárbaro de nivel 1", () => {
  const { data, turno } = turnoOf(barbarian());
  const action = turno.slots.find((slot) => slot.id === "action")!;
  const bonus = turno.slots.find((slot) => slot.id === "bonus");

  test("la hacha grande va primera y lleva los números de la hoja", () => {
    const axe = action.options[0]!;
    expect(axe.name).toMatch(/greataxe/i);
    const bonusToHit = data.abilities.str.modifier + data.proficiencyBonus;
    expect(axe.attack?.formula).toBe(`1d20${bonusToHit >= 0 ? "+" : ""}${bonusToHit}`);
    expect(axe.damage?.formula.replace(/\s+/g, "")).toBe(`1d12+${data.abilities.str.modifier}`);
  });

  test("las demás acciones cierran la lista", () => {
    expect(action.options.at(-1)?.name).toBe("Otras acciones");
  });

  test("la Ira es una acción adicional con su daño de la tabla de la clase", () => {
    const rage = bonus?.options.find((option) => option.name === "Rage");
    expect(rage).toBeDefined();
    expect(rage?.small).toBe("daño");
    expect(rage?.big).toBe("+2");
  });

  test("la Ira es un recurso con los usos que dice la tabla, y un descanso corto devuelve uno", () => {
    const rage = turno.resources.find((resource) => resource.name === "Rage");
    expect(rage?.max).toBe(2);
    expect(rage?.short).toBe("one");
  });

  test("todo cuerpo a cuerpo da un ataque de oportunidad", () => {
    const opportunity = turno.reactions.find((reaction) => reaction.name === "Ataque de oportunidad");
    expect(opportunity?.roll?.formula).toMatch(/^1d20/);
  });

  test("lo que se desequipó en la hoja deja de ser una opción", () => {
    const axe = action.options[0]!;
    const { turno: unequipped } = turnoOf(barbarian(), { equipped: { [axe.id]: false } });
    const names = unequipped.slots.find((slot) => slot.id === "action")!.options.map((option) => option.name);
    expect(names).not.toContain(axe.name);
  });
});

describe("el turno de una maga de nivel 5", () => {
  const { turno } = turnoOf(wizard());
  const names = (id: "action" | "bonus") => turno.slots.find((slot) => slot.id === id)?.options.map((option) => option.name) ?? [];

  test("los trucos y los conjuros preparados caen por lo que cuestan", () => {
    expect(names("action")).toContain("Fire Bolt");
    expect(names("action")).toContain("Fireball");
    expect(names("bonus")).toContain("Misty Step");
  });

  test("Shield es una reacción, con lo que la dispara", () => {
    const shield = turno.reactions.find((reaction) => reaction.name === "Shield");
    expect(shield).toBeDefined();
    expect(shield?.when.length).toBeGreaterThan(0);
  });

  test("los espacios de conjuro son recursos con los números de la hoja", () => {
    const first = turno.resources.find((resource) => resource.id === "slot:1");
    expect(first?.max).toBe(4);
    expect(turno.resources.some((resource) => resource.id === "hd")).toBe(true);
  });
});

describe("gastar y descansar", () => {
  test("un recurso gastado queda en el estado de juego de la hoja", () => {
    const { turno } = turnoOf(barbarian());
    const rage = turno.resources.find((resource) => resource.name === "Rage")!;
    const spent = withUsed({}, rage, 1);
    expect(spent.pips?.["turno:f:Rage"]).toBe(1);
    expect(turnoOf(barbarian(), spent).turno.resources.find((resource) => resource.name === "Rage")?.used).toBe(1);
  });

  test("el descanso corto devuelve un uso de Ira y el largo, todos y la vida", () => {
    const { turno } = turnoOf(barbarian());
    const used = { hp: 3, pips: { "turno:f:Rage": 2 } };
    expect(afterRest(used, turno, "corto", 16).pips?.["turno:f:Rage"]).toBe(1);
    const long = afterRest(used, turno, "largo", 16);
    expect(long.pips?.["turno:f:Rage"]).toBe(0);
    expect(long.hp).toBe(16);
  });
});
